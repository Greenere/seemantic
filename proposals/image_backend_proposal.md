# Image Processing Backend — Design Proposal

> Companion to `semantic_editor_proposal.md`. Specifies the renderer module that sits
> behind `GET /export`, preview generation, and every `POST /edit` commit.

---

## 1. Scope

This document covers everything from "a param state object exists" to "pixels appear on screen or in a file". It does not cover:

- The API layer (defined in the main proposal)
- The semantic → numeric mapping (defined in §8 of the main proposal)
- AI intent parsing (LLM call, separate concern)
- SAM mask generation (separate inference service)

The boundary is clean: the image backend receives a **numeric param snapshot + optional mask** and returns **pixels**.

---

## 2. Module placement

The renderer is a **self-contained Python package** (`seemantic_renderer`) called in-process by the API server. It exposes a single function:

```python
def render(
    image_path: str,
    params: NumericParams,
    mask: np.ndarray | None = None,   # float32 H×W, 0–1
    resolution: Resolution = Resolution.FULL,
) -> np.ndarray:                       # float32 H×W×3, linear light, 0–1
    ...
```

The API server calls `render()` and encodes the result to JPEG/PNG for delivery. The renderer has **no knowledge of sessions, branches, or the API**.

**Why in-process (not a sidecar)?**
- Eliminates network latency for preview renders
- Shared memory for the image buffer (no serialization)
- Easy to extract to a separate service later — the function signature becomes an RPC boundary

**Why Python, not Node/sharp?**
- `sharp` (libvips) is excellent for basic transforms but has no tone curve API; workarounds with `linear()` and `recomb()` are imprecise
- Python gives access to `numpy` for exact per-pixel math, `rawpy` for future RAW support, and `scikit-image` / `OpenCV` for clarity/local contrast
- The API server can be Node or Python — if Node, call the renderer via a child process with a thin JSON stdio protocol (see §7)

---

## 3. Processing pipeline

**Order matters.** Applying exposure before white balance vs. after produces different results. The pipeline is fixed and documented here — params always apply in this sequence regardless of which order the user set them:

```
Input image (sRGB uint8 or float32)
        │
        ▼
1. Linearize          sRGB gamma removal → linear light float32
        │
        ▼
2. White balance      color_temp → per-channel multipliers (R, G, B)
        │
        ▼
3. Exposure           global EV shift → multiply all channels
        │
        ▼
4. Tone curve         whites, blacks, highlights, shadows → parametric curve
        │
        ▼
5. Clarity            local contrast via unsharp mask blend
        │
        ▼
6. Mask blend         if a mask is active, blend masked region with unmasked original
        │
        ▼
7. Re-encode gamma    linear → sRGB gamma
        │
        ▼
Output (float32, clipped 0–1, ready to encode as JPEG/PNG)
```

Each stage is a pure function `(array, params) → array`. Stages can be tested independently.

---

## 4. Param-to-pixel specification

### 4.1 White balance — `color_temp` (int, 2000–10000 K)

Map color temperature to per-channel multipliers using the standard D-illuminant approximation:

```python
def kelvin_to_rgb_multipliers(K: int) -> tuple[float, float, float]:
    # Tanner Helland's algorithm (fast, good enough for photo editing)
    t = K / 100
    if t <= 66:
        r = 1.0
        g = (99.4708025861 * math.log(t) - 161.1195681661) / 255
        b = 0.0 if t <= 19 else (138.5177312231 * math.log(t - 10) - 305.0447927307) / 255
    else:
        r = (329.698727446 * (t - 60) ** -0.1332047592) / 255
        g = (288.1221695283 * (t - 60) ** -0.0755148492) / 255
        b = 1.0
    return (
        np.clip(r, 0, 1),
        np.clip(g, 0, 1),
        np.clip(b, 0, 1),
    )

# Apply: multiply each channel independently
img[:,:,0] *= r_mult
img[:,:,1] *= g_mult
img[:,:,2] *= b_mult
```

The multipliers are normalized so that the green channel is always 1.0 (standard camera white balance convention), then re-normalized to keep overall luminance stable.

### 4.2 Exposure — `exposure` (float, -5.0 to +5.0 EV)

```python
img *= 2 ** exposure
```

Applied in linear light. Simple, correct, invertible.

### 4.3 Tone curve — `highlights`, `shadows`, `whites`, `blacks` (int, -100 to 100)

These four params define a **parametric tone curve** over the luminance channel (in linear light), inspired by Lightroom's parametric curve.

The curve is a smooth spline through five anchors:

| Anchor | Luminance | Effect of params |
|--------|-----------|-----------------|
| Black point | 0.0 | `blacks`: shifts this anchor up/down |
| Shadow midpoint | 0.25 | `shadows`: lifts or crushes shadow tones |
| Mid gray | 0.5 | Fixed, unaffected |
| Highlight midpoint | 0.75 | `highlights`: pulls highlights up or rolls them off |
| White point | 1.0 | `whites`: clips or expands the white point |

```python
def build_tone_curve(highlights, shadows, whites, blacks) -> np.ndarray:
    # Normalize params to [-0.25, +0.25] output shift
    h = highlights / 400   # ±100 → ±0.25
    s = shadows    / 400
    w = whites     / 400
    b = blacks     / 400

    anchors_in  = np.array([0.0,       0.25,    0.5,  0.75,      1.0])
    anchors_out = np.array([0.0 + b,   0.25 + s, 0.5, 0.75 + h, 1.0 + w])
    anchors_out = np.clip(anchors_out, 0, 1)

    # Build a monotonic cubic spline from anchors
    spline = PchipInterpolator(anchors_in, anchors_out)

    # Produce a 1D LUT (4096 entries for precision)
    lut_in = np.linspace(0, 1, 4096)
    lut_out = np.clip(spline(lut_in), 0, 1)
    return lut_out

def apply_tone_curve(img: np.ndarray, lut: np.ndarray) -> np.ndarray:
    # Apply curve to luminance only; preserve hue/saturation
    lum = 0.2126 * img[:,:,0] + 0.7152 * img[:,:,1] + 0.0722 * img[:,:,2]
    lum_new = np.interp(lum, np.linspace(0, 1, len(lut)), lut)
    scale = np.where(lum > 1e-6, lum_new / lum, 1.0)
    return img * scale[:,:,np.newaxis]
```

This preserves color while adjusting tone — the same approach used in professional grade tools.

### 4.4 Clarity — `clarity` (int, -100 to 100)

Clarity = local contrast = the image minus a blurred version of itself, blended back in.

```python
def apply_clarity(img: np.ndarray, clarity: int) -> np.ndarray:
    if clarity == 0:
        return img
    strength = clarity / 100  # -1 to +1
    radius = 25               # pixels; controls the spatial frequency targeted

    blurred = cv2.GaussianBlur(img, (0, 0), radius)
    detail = img - blurred    # high-pass layer

    # Add or subtract detail at mid-tones only (avoid clipping highlights/blacks)
    lum = 0.2126*img[:,:,0] + 0.7152*img[:,:,1] + 0.0722*img[:,:,2]
    midtone_mask = 1 - (2 * lum - 1) ** 2   # peaks at 0.5, zero at 0 and 1

    result = img + strength * detail * midtone_mask[:,:,np.newaxis]
    return np.clip(result, 0, 1)
```

Negative clarity (softening) subtracts the detail layer, useful for skin / mist effects.

---

## 5. Preview vs. export resolution strategy

Human edits have a <100ms latency target; full-resolution renders can take seconds. These are served differently:

### 5.1 Preview pipeline

On `POST /session`, the server immediately generates a **preview-resolution** copy of the image (longest edge = 1500px) and caches it in memory. All edits during the session render against this preview copy.

```
Session start:
  full_res  = load(image_path)                     # stored on disk
  preview   = resize(full_res, longest_edge=1500)  # kept in RAM

POST /edit (human):
  preview_rendered = render(preview, params)        # ~20–60ms at 1500px
  → encode as JPEG 85% → emit via WebSocket

GET /export:
  full_rendered = render(full_res, params)          # ~500ms–3s at full res
  → encode as TIFF/PNG/JPEG → serve as download
```

The **same `render()` function** handles both paths — resolution is the only difference. This guarantees preview and export are pixel-identical modulo downsampling.

### 5.2 Preview caching

Cache key: `sha256(json(params) + mask_id)`. If the same param snapshot is requested again (e.g., user switches back to a previous branch), serve from cache without re-rendering.

Cache policy: LRU, max 20 entries per session (covers the full branch tree for typical usage).

### 5.3 Async export

If `render(full_res, ...)` takes >500ms (detected by timing the preview at startup and extrapolating), export is run in a background thread:

```python
job_id = uuid4()
thread = Thread(target=render_and_store, args=(full_res, params, job_id))
thread.start()
return { "job_id": job_id, "status": "pending" }
# WebSocket emits { "event": "export_ready", "job_id": ..., "download_url": ... } on completion
```

---

## 6. Style tile mechanism

Style tiles are **pre-defined numeric param snapshots** stored in a JSON config file:

```json
// styles.json
{
  "golden": {
    "color_temp": 6800,
    "exposure": 0.3,
    "highlights": -20,
    "shadows": 15,
    "whites": 10,
    "blacks": -5,
    "clarity": 5
  },
  "noir": {
    "color_temp": 4200,
    "exposure": -0.4,
    "highlights": -40,
    "shadows": -20,
    "whites": -10,
    "blacks": -30,
    "clarity": 20
  }
  // ...
}
```

Applying a style at `strength` S is a **linear interpolation** between the current params and the style's params:

```python
def apply_style(current: NumericParams, style: NumericParams, strength: float) -> NumericParams:
    # strength: 0.0 = no change, 1.0 = full style
    return lerp(current, style, strength)
```

This means style application is deterministic, invertible, and produces no visual surprises. It also means the intermediate param state is always visible to the agent via `GET /state`.

**Authoring new styles**: design a look manually in the UI, then call `GET /state` and save the numeric params snapshot to `styles.json`. No code change needed.

**What this does NOT support**: style tiles do not use latent space or diffusion — that would require a generative model call and is out of scope for the prototype. The LUT / latent-space option is a future enhancement path, not the starting design.

---

## 7. Variant generation

`POST /variants` with `count: 4` must return 4 distinct, plausible alternatives to the current edit. Two strategies, applied together:

### 7.1 Param perturbation (fast, no LLM)

Generate N variants by sampling small random perturbations around the current params:

```python
def generate_variants(params: NumericParams, count: int, diversity: float) -> list[NumericParams]:
    variants = []
    # diversity: 0 = tight cluster, 1 = broad range
    sigma = diversity * 0.15   # as fraction of each param's range

    for _ in range(count):
        v = copy(params)
        v.color_temp  += int(np.random.normal(0, sigma * 8000))
        v.exposure    += np.random.normal(0, sigma * 10)
        v.highlights  += int(np.random.normal(0, sigma * 200))
        v.shadows     += int(np.random.normal(0, sigma * 200))
        v.clarity     += int(np.random.normal(0, sigma * 200))
        v = clamp_to_schema(v)
        variants.append(v)
    return variants
```

Perturbations are correlated (e.g., if warmth goes up, shadows also lift slightly) by using a small covariance matrix derived empirically from the style tile presets. This makes variants feel intentional rather than random.

### 7.2 Style-seeded variants (higher diversity)

When `diversity > 0.5`, seed each variant from a different style tile interpolated at low strength (0.2–0.4), then perturb from there. This produces aesthetically distinct variants rather than near-duplicates.

```python
if diversity > 0.5:
    seeds = random.sample(list(STYLES.keys()), count)
    variants = [
        generate_variant_from_seed(params, STYLES[s], diversity)
        for s in seeds
    ]
```

Each variant is rendered at preview resolution and returned as `{ branch_id, diff, preview_url }`. The rendering of all 4 variants is parallelized across threads.

---

## 8. Interface to the API server (Node bridge)

If the API server is Node.js, the renderer runs as a long-lived child process with a JSON stdio protocol:

```
Node API server                 Python renderer process
       │                                │
       │── {"job":"render", params:...} ──▶│
       │                                │  (renders in-process)
       │◀── {"job_id":..., "path":...} ──│
```

The renderer writes output images to a temp directory; Node serves them directly. This avoids base64 encoding large image buffers.

Alternatively, if the API server is Python (FastAPI), the renderer is imported as a module and called directly.

---

## 9. Dependencies

| Library | Purpose | Pinned version |
|---------|---------|----------------|
| `numpy` | Array math, all pixel operations | ≥1.26 |
| `Pillow` | Image load/save, sRGB encode/decode | ≥10.0 |
| `opencv-python-headless` | Gaussian blur for clarity (faster than Pillow) | ≥4.9 |
| `scipy` | `PchipInterpolator` for tone curve spline | ≥1.12 |
| `rawpy` | RAW file decoding (future — not needed for M3) | ≥0.21 |

No GPU dependencies in the prototype. All transforms run on CPU with `numpy` vectorization — fast enough for 1500px previews at <100ms.

---

## 10. Implementation milestones

**R1 — Core pipeline, no UI wiring**
- Implement stages 1–7 (linearize → re-encode) as pure functions
- Unit test each stage independently with known input/output pairs
- Benchmark at 1500px: target <60ms end-to-end on CPU
- Output: `seemantic_renderer` package importable by API server

**R2 — Session integration**
- Preview copy generated on `POST /session`
- `POST /edit` calls `render(preview, params)` and emits preview URL via WebSocket
- Preview cache (LRU 20 entries) implemented
- Output: human edits visible in browser as they happen

**R3 — Export pipeline**
- `GET /export` calls `render(full_res, params)` with async job pattern
- Thread pool for export jobs (max 2 concurrent)
- Output: downloadable JPEG/PNG/TIFF

**R4 — Style tiles + variants**
- `styles.json` with all 8 presets, interpolation logic
- `POST /variants` with perturbation + style-seeded strategies
- Parallel rendering of variant previews
- Output: variant strip in UI populated with real images

---

## 11. Open questions

- **Color space**: prototype works in sRGB throughout. Display-P3 and ProPhoto RGB are common in photo editing workflows — does the target user base need wider gamut? (Deferred; easy to add later via colormath.)
- **Sharpening and noise reduction**: absent from the current numeric param set. These are high-value for photo editing but require more complex algorithms (Wiener filter or BM3D for NR). Add to schema in a later sprint.
- **RAW file support**: `rawpy` gives access to full RAW data, enabling proper white balance before demosaicing. Requires defining a RAW decode stage before stage 1. Not in scope for prototype.
- **GPU acceleration**: if preview latency exceeds 100ms at full preview resolution, move clarity and tone curve stages to a WebGL shader in the browser (client-side) and keep white balance + exposure on the server. This hybrid split is a known pattern in browser-based editors (Lightroom Web does this).

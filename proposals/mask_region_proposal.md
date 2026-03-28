# Mask & Region Support — Design Proposal

> Companion to `semantic_editor_proposal.md` §M5. Specifies how masks are created
> (brush, gradient, and semantic label), stored, composited, and applied during rendering.

---

## 1. Scope

This document covers:
- How masks are created (brush tool, semantic label via SAM, gradient)
- Mask storage format and lifecycle
- How multiple masks compose
- How a mask modifies the render pipeline
- Agent API for programmatic mask creation
- The SAM integration contract

Out of scope:
- The render pipeline itself (image_backend_proposal.md §3 covers the mask blend stage)
- The `POST /mask` / `GET /mask` / `DELETE /mask` API signatures (main proposal §4)

---

## 2. Mask data model

A mask is a **float32 grayscale array** (values 0.0–1.0, H×W) where:
- `1.0` = fully selected (edit applies at 100%)
- `0.0` = not selected (edit does not apply)
- Values between = partial application (feathering, gradient)

Internally every mask is stored as this float32 array. All other representations
(PNG, RLE, brush strokes) are **source artifacts** that produce this array.

### Stored fields per mask

```python
@dataclass
class Mask:
    mask_id: str                  # e.g. "mask_001"
    label: str                    # human-readable, e.g. "sky brush"
    source: MaskSource            # see §3
    bitmap: np.ndarray            # float32 H×W, at full image resolution
    feather: float                # 0–1, applied during composite (not baked in)
    invert: bool                  # if True, effect applies to the unselected region
    coverage_pct: float           # precomputed: mean(bitmap)
    thumbnail_path: str           # JPEG thumbnail for UI display
```

`feather` is stored separately from the bitmap so it can be adjusted without
re-running SAM or re-rasterizing brush strokes. It is applied at composite time (§5).

---

## 3. Mask creation sources

### 3.1 Semantic label (SAM-based)

Input: a string like `"sky"`, `"subject"`, `"background"`, `"foreground"`.

Pipeline:

```
Label string
     │
     ▼
Grounding DINO         Text → bounding box(es) on the image
     │
     ▼
SAM 2 (MobileSAM)      Box prompt → segmentation mask (float32)
     │
     ▼
Post-process           Resize to full image resolution, apply feather
     │
     ▼
Mask bitmap (float32 H×W)
```

**Why two models?**
SAM requires a spatial prompt (point or bounding box) — it cannot take free-form text.
Grounding DINO converts the text label into a bounding box, which SAM then segments precisely.
This is the "Grounded-SAM" pipeline, well-established in the open-source ecosystem.

**Model choices:**
- Grounding DINO: `groundingdino-swint-ogc` (the standard checkpoint, ~700MB)
- SAM: `MobileSAM` for prototype (runs on CPU, ~40ms, good enough quality); upgrade to `SAM 2` if quality is insufficient or GPU is available

**Supported semantic labels for the prototype** (hardcoded set, not open-ended):

| Label | Grounding DINO text prompt |
|---|---|
| `"sky"` | `"sky . clouds"` |
| `"subject"` | `"person . animal . main subject"` |
| `"background"` | Inverse of subject mask |
| `"foreground"` | `"foreground object"` |
| `"shadows"` | Luminance-based (no SAM needed — see §3.4) |
| `"highlights"` | Luminance-based (no SAM needed — see §3.4) |
| `"midtones"` | Luminance-based (no SAM needed — see §3.4) |

**Open-ended labels** (e.g. `"the red barn"`) are out of scope for the prototype — Grounding DINO
handles them in principle but reliable quality requires testing per-image.

### 3.2 Brush mask

Input: an array of stroke objects from the UI canvas.

```python
@dataclass
class Stroke:
    points: list[tuple[float, float]]   # normalized 0–1 canvas coordinates
    radius: float                        # normalized brush radius (0–1)
    pressure: float                      # 0–1, controls opacity at stroke center
    mode: Literal["add", "erase"]
```

**Rasterization** (server-side, not in-browser):

```python
def rasterize_strokes(strokes: list[Stroke], H: int, W: int) -> np.ndarray:
    mask = np.zeros((H, W), dtype=np.float32)
    for stroke in strokes:
        points_px = [(x * W, y * H) for x, y in stroke.points]
        radius_px = stroke.radius * min(H, W)
        # Interpolate between points to avoid gaps at fast brush movement
        interpolated = interpolate_stroke_points(points_px, spacing=radius_px * 0.25)
        for px, py in interpolated:
            # Gaussian falloff within brush radius
            Y, X = np.ogrid[:H, :W]
            dist = np.sqrt((X - px)**2 + (Y - py)**2)
            contribution = np.exp(-0.5 * (dist / (radius_px * 0.4))**2) * stroke.pressure
            if stroke.mode == "add":
                mask = np.maximum(mask, contribution)
            else:  # erase
                mask = np.maximum(0, mask - contribution)
    return np.clip(mask, 0, 1)
```

The UI sends strokes to `POST /mask` with `type: "brush"` and `brush_path: [...]`.
Rasterization runs server-side so the stored bitmap is authoritative and the UI
thumbnail is generated from the server's result, not the browser's canvas drawing.

**Stroke smoothing**: the UI applies cubic spline smoothing to raw pointer events
before sending — this is a client-side concern and produces cleaner `points` arrays.
The server does not re-smooth.

### 3.3 Gradient mask

Input: two points (start, end) and a shape (`linear` or `radial`).

```python
def rasterize_gradient(
    start: tuple[float, float],   # normalized 0–1
    end: tuple[float, float],
    shape: Literal["linear", "radial"],
    H: int, W: int,
) -> np.ndarray:
    Y, X = np.mgrid[0:H, 0:W] / np.array([H, W])
    sx, sy = start
    ex, ey = end
    if shape == "linear":
        direction = np.array([ex - sx, ey - sy])
        length = np.linalg.norm(direction) + 1e-8
        direction /= length
        t = (X - sx) * direction[0] + (Y - sy) * direction[1]
        return np.clip(t / length, 0, 1).astype(np.float32)
    else:  # radial
        radius = np.sqrt((ex - sx)**2 + (ey - sy)**2)
        dist = np.sqrt((X - sx)**2 + (Y - sy)**2)
        return np.clip(1 - dist / (radius + 1e-8), 0, 1).astype(np.float32)
```

### 3.4 Luminance-based masks (shadows, highlights, midtones)

These do not use SAM — they are derived analytically from the image's luminance channel.

```python
def luminance_mask(img: np.ndarray, region: str) -> np.ndarray:
    lum = 0.2126*img[:,:,0] + 0.7152*img[:,:,1] + 0.0722*img[:,:,2]
    if region == "shadows":
        # Smooth falloff from 0 (pure black) to 0 (at 0.5)
        return np.clip(1 - lum / 0.35, 0, 1).astype(np.float32)
    elif region == "highlights":
        return np.clip((lum - 0.65) / 0.35, 0, 1).astype(np.float32)
    elif region == "midtones":
        return (1 - (2 * lum - 1)**2).astype(np.float32)   # peaks at 0.5
```

These are always computed fresh from the current image — they are not stored as
`mask_id` references because they are image-content-dependent and cheap to recompute.

---

## 4. Mask storage and lifecycle

### Storage format

```
session_data/
  {session_id}/
    masks/
      mask_001.npz          # numpy float32 array (lossless, compact)
      mask_001_thumb.jpg    # JPEG thumbnail for UI (200×133px approx)
      mask_002.npz
      mask_002_thumb.jpg
```

`.npz` is chosen over PNG because:
- Lossless float32 precision (PNG would require 16-bit encoding and lose sub-pixel values)
- `np.savez_compressed` gives ~3–5x compression over raw float32
- Fast load with `np.load`

Thumbnails are generated once at creation time and served statically.

### Mask references in state

A mask is referenced in an edit by its `mask_id` string:

```json
{
  "edit_id": "edit_a3",
  "params": { "warmth": 0.72 },
  "mask_id": "mask_001"
}
```

The mask is applied during rendering (§6). If `mask_id` is `null`, the edit applies globally.

### Lifecycle rules

- Masks are **session-scoped** — they are deleted when the session expires
- `DELETE /mask/{mask_id}` returns `409 Conflict` if any committed edit in any branch references the mask
- Masks can be referenced by edits in **multiple branches** simultaneously (non-destructive)
- Re-running `POST /mask` with the same source (e.g. same brush strokes) creates a **new mask** — there is no deduplication

---

## 5. Feathering

Feathering is applied at composite time, not baked into the stored bitmap. This allows
the feather amount to be adjusted without re-running SAM or re-rasterizing.

```python
def apply_feather(bitmap: np.ndarray, feather: float) -> np.ndarray:
    if feather == 0:
        return bitmap
    # Sigma in pixels: feather=1.0 → blur radius ~2% of image diagonal
    H, W = bitmap.shape
    sigma = feather * 0.02 * math.sqrt(H**2 + W**2)
    return cv2.GaussianBlur(bitmap, (0, 0), sigma)
```

The feathered bitmap is used only for the render call — it is never written back to disk.

---

## 6. Compositing multiple masks

An edit references at most **one mask**. But an image session may have many edits across
branches, each with different masks. The question of multiple-mask compositing arises
when the render pipeline applies the edit stack for a given branch.

**Rule**: masks are applied **per-edit**, not composed globally. Each edit's param diff
is blended into the running pixel buffer using its own mask:

```
pixel_output = sum over edits in branch:
    apply_edit(base_image, edit.params, edit.mask)
```

More precisely, the render pipeline for a branch is:

```python
def render_branch(image: np.ndarray, edits: list[Edit], masks: dict[str, Mask]) -> np.ndarray:
    result = image.copy()
    for edit in edits:
        edited = apply_params(result, edit.params)   # full-image transform
        if edit.mask_id:
            mask = apply_feather(masks[edit.mask_id].bitmap, masks[edit.mask_id].feather)
            if masks[edit.mask_id].invert:
                mask = 1 - mask
            result = result * (1 - mask[:,:,np.newaxis]) + edited * mask[:,:,np.newaxis]
        else:
            result = edited
    return result
```

This means edit order matters: a later global edit overrides an earlier masked edit in
the unmasked region. The branch history order is therefore the compositing order.

**No global mask stack**: there is no concept of "merge all masks". This keeps the model
simple and predictable for both humans and agents.

---

## 7. Agent API for programmatic masks

Brush masks are not human-only. An agent can create a brush mask programmatically
by sending stroke paths to `POST /mask`:

```json
{
  "type": "brush",
  "brush_path": [
    {
      "points": [[0.1, 0.2], [0.15, 0.25], [0.2, 0.3]],
      "radius": 0.05,
      "pressure": 1.0,
      "mode": "add"
    }
  ],
  "feather": 0.1
}
```

Agents typically prefer `type: "semantic"` (automatic segmentation) over brush paths,
but brush paths are exposed so an agent with spatial reasoning can paint precise regions.

Luminance-based regions (`"shadows"`, `"highlights"`, `"midtones"`) require no
`POST /mask` call — pass them directly as the `region` field in `POST /edit`:

```json
{ "params": { "warmth": 0.72 }, "region": "shadows" }
```

The server resolves these inline without creating a stored mask.

---

## 8. SAM integration contract

SAM runs as a **long-lived Python subprocess** (or in-process if the API server is Python).
It loads model weights once at startup (~3s) and processes requests serially.

```
API server                        SAM worker process
     │                                    │
     │── { "image_path": "...",           │
     │     "boxes": [[x1,y1,x2,y2]] } ──▶│
     │                                    │  (inference ~40ms MobileSAM)
     │◀── { "masks": [[[...float32]]] } ──│
```

Communication: JSON over stdin/stdout (same pattern as image_backend_proposal.md §8).
The image path is a shared filesystem path; mask bitmaps are returned inline as
nested float32 lists (small enough at preview resolution; full-res masks are written
to disk and path returned instead).

**Grounding DINO + SAM combined worker**: both models run in the same worker process
to avoid loading images twice. The worker accepts either a `label` (text prompt) or
`boxes` (direct box prompt) as input.

**Latency targets:**

| Mask type | Target |
|---|---|
| Luminance (shadows/highlights/midtones) | < 5ms (pure numpy) |
| Gradient | < 5ms |
| Brush rasterization | < 20ms |
| SAM (MobileSAM, CPU, 1500px) | < 150ms |
| Grounding DINO + SAM combined | < 400ms |

All mask creation calls are async from the UI perspective — the user sees a spinner
on the mask thumbnail until the WebSocket emits `{ "event": "mask_ready", "mask_id": "..." }`.

---

## 9. Dependencies

| Library | Purpose |
|---|---|
| `numpy` | Mask bitmap math |
| `opencv-python-headless` | Feathering (Gaussian blur), stroke rasterization |
| `groundingdino` | Text → bounding box (Grounded-SAM pipeline) |
| `mobile_sam` | SAM segmentation from box prompt |
| `torch` (CPU) | Required by both Grounding DINO and MobileSAM |
| `scipy` | Spline interpolation for brush stroke smoothing (if done server-side) |

GPU is optional — MobileSAM runs acceptably on CPU for the prototype. If GPU is available,
inference drops to ~10ms.

---

## 10. Implementation milestones

**S1 — Luminance and gradient masks (no SAM)**
- Implement `luminance_mask()` and `rasterize_gradient()`
- Wire `region: "shadows" | "highlights" | "midtones"` in `POST /edit` (no stored mask)
- Wire gradient mask creation via `POST /mask { type: "gradient" }`
- Integrate mask blend stage into `seemantic_renderer` (image_backend_proposal.md §3 stage 6)
- Goal: region-constrained edits work end-to-end without any ML inference

**S2 — Brush mask tool**
- Client: canvas mouse events → stroke objects → `POST /mask { type: "brush" }`
- Server: `rasterize_strokes()`, feathering, thumbnail generation, `.npz` storage
- UI: mask thumbnail in right panel; brush/erase toggle in toolbar
- Goal: human can paint a mask and see it applied to an edit

**S3 — SAM integration**
- SAM worker subprocess with Grounding DINO + MobileSAM
- `POST /mask { type: "semantic", label: "sky" }` triggers worker
- Async response via WebSocket `mask_ready` event
- Goal: user types `"sky"` and gets a precise sky mask in < 400ms

**S4 — Agent mask API + invert/feather controls**
- Expose brush path creation to agents via `POST /mask`
- Add `invert` toggle to `POST /mask` and UI mask panel
- Feather slider in UI updates mask metadata (no re-inference)
- `DELETE /mask` with 409 guard
- Goal: agents can create and reference masks; full mask lifecycle is complete

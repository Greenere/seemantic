# Aesthetic Understanding — Design Proposal

> Explores how seemantic can move beyond pixel-level param manipulation toward
> genuine compositional aesthetic reasoning. Companion to `semantic_editor_proposal.md`.

---

## 1. The core gap

Traditional photo editors — and the current seemantic design — operate on a **pixel manipulation** abstraction:
change `color_temp`, `highlights`, `clarity`. These are local operations on pixel values.

Human aesthetic judgment operates on a fundamentally different abstraction: **relational, compositional, and emergent**.
"This image feels cold and distant" is not a statement about any pixel or region — it is a statement about how
the tonal relationships, color palette, subject placement, and depth structure combine into a gestalt impression.

The gap between these two abstractions is the central unsolved problem in AI-assisted photo editing.

**What current AI does well:**
- Pixel-quality metrics (sharpness, noise, exposure correctness)
- Style transfer (texture statistics via Gram matrices)
- Semantic segmentation (what's in the image, where)
- Global aesthetic scoring (NIMA, CLIP-based aesthetic predictors)

**What current AI does poorly:**
- Identifying *which* compositional properties drive a specific aesthetic impression
- Translating an aesthetic gap into a specific, bounded set of parametric edits
- Handling the subjectivity and context-dependence of aesthetic quality
- Reasoning about *relational* properties: how the shadow region's tone relates to the highlight region,
  whether subject placement creates tension, whether the palette is harmonically coherent

---

## 2. The aesthetics pyramid

Aesthetic quality is multi-scale. A useful mental model is a pyramid of levels, each building on the one below:

```
         ▲
        /4\       Gestalt / mood
       /───\      CLIP embedding, emotional register, genre
      / 3   \     Composition
     /───────\    subject placement, color harmony, visual weight, depth
    /    2    \   Regional relationships
   /───────────\  how regions relate: tonal balance, shadow↔highlight covariance
  /      1      \ Local texture / quality
 /───────────────\grain, sharpness, bokeh, local contrast
/        0        \Pixel statistics
 ─────────────────  histogram, channel means, noise — current params live here
```

**Key insight**: aesthetics emerges from the *interactions between levels*, not from any single level.
A technically sharp, correctly exposed image (levels 0–1 correct) can be aesthetically dead if
the composition is static (level 3 broken). A compositionally powerful image can survive significant
technical imperfection. This asymmetry is why pixel-level editing tools hit a ceiling.

### Level 0 — Pixel statistics
- Histogram distribution, channel means and variance
- Directly controlled by current numeric params
- AI is very good here; this is largely a solved problem

### Level 1 — Local texture and quality
- Sharpness (Laplacian variance), noise level, bokeh quality, local contrast
- Partially addressable via `clarity` param; sharpening/NR are deferred to future params
- Measurable via standard signal quality metrics

### Level 2 — Regional relationships
- How the shadow region's luminance and color relate to the highlight region
- Color palette coherence: are the dominant colors harmonically related?
- Tonal distribution: is the histogram well-shaped for the intended mood?
- Capturable via Gram-matrix-style feature covariance (à la neural style transfer)
  over DINOv2 or CLIP patch features at multiple spatial scales
- **This is the level the current semantic sliders approximate poorly** — `warmth` and `drama`
  are 1D projections of what is actually a multi-dimensional relational structure

### Level 3 — Composition
- Subject placement (rule of thirds, golden ratio, centering)
- Visual weight distribution (is the frame balanced or intentionally imbalanced?)
- Color harmony (complementary, analogous, triadic palette relationships)
- Depth and layering (foreground / midground / background separation)
- Negative space ratio and directionality
- Requires scene understanding (subject detection, depth estimation) — cannot be derived from pixel stats alone
- **This is where parametric editing hits a hard wall**: most compositional properties
  (subject placement, framing) cannot be changed without cropping or content generation.
  Parametric tools can *support* composition (tonal separation of depth layers, color contrast
  between subject and background) but cannot *fix* it.

### Level 4 — Gestalt and mood
- Holistic emotional register: "cold and distant", "warm and intimate", "tense", "serene"
- Genre coherence: does the image look like the kind of photo it is trying to be?
- CLIP text-image similarity to mood descriptions captures this partially
- NIMA / LAION-aesthetics aesthetic score captures overall quality but not specific mood
- **This is where LLM-mediated intent lives** — the prompts users type ("golden hour feel",
  "more cinematic") are level-4 statements being translated down to level-0 edits

---

## 3. The measurement vs. control problem

The pyramid helps explain *why* an image's aesthetics feel a certain way. But for seemantic,
the actionable question is: **given an aesthetic gap, which parametric edits close it?**

These are different problems:

| Problem | Difficulty | Current state |
|---|---|---|
| Score overall aesthetic quality | Moderate | NIMA, CLIP-aesthetics work reasonably |
| Describe *why* aesthetics feel a certain way | Hard | VLMs can narrate; not structured |
| Identify *which level* the gap is at | Hard | No established approach |
| Translate gap → specific param edits | Very hard | Unsolved in general |

The control problem is hard for a structural reason: the mapping from "this image feels flat"
to "increase `clarity` by 15 and lift `shadows` to 20" is highly context-dependent and
underdetermined. Many different edit combinations might close the same aesthetic gap.

**Three approaches to the control problem, with tradeoffs:**

### 3a. LLM-mediated translation (current seemantic approach, extended)
The LLM receives not just the intent string but also an **aesthetic analysis** of the current image:

```
Current image aesthetic analysis:
- Tonal range: compressed (histogram spans 0.2–0.75, lacks deep blacks and bright whites)
- Color palette: analogous (blue-green dominant, low saturation)
- Estimated mood score: 0.38 / 1.0 (NIMA)
- Compositional notes: subject centered, low visual tension
- CLIP aesthetic distance from "golden hour": 0.61 (moderate)
```

The LLM uses this structured analysis to propose more informed param changes.
**Advantage**: works within current architecture, no new training required.
**Limitation**: the LLM must bridge from level-4 analysis to level-0 params, and this
bridge is learned implicitly from pretraining, not explicitly optimized for photo editing.

### 3b. Aesthetic embedding gradient
If you have a differentiable aesthetic scorer (NIMA or a CLIP-based aesthetic predictor),
you can compute the gradient of the score with respect to the image, then project that
gradient onto the space of achievable parametric edits:

```python
# Conceptual sketch
aesthetic_score = aesthetic_model(image)
grad_image = autograd(aesthetic_score, image)
# Project grad_image onto the achievable edit manifold
param_delta = project_to_param_space(grad_image, current_params, schema)
```

**Advantage**: directly optimizes for aesthetic quality; no LLM needed.
**Limitation**: aesthetic models are trained on average human preferences — optimizing
them tends to produce "generic beautiful" rather than the specific aesthetic the user intends.
Risks producing a kind of **aesthetic uncanny valley**: technically high-scoring but soulless.

### 3c. Reference image fingerprinting
The user provides a reference image ("make it look like this"). The system extracts a
multi-level aesthetic fingerprint from the reference and treats editing as closing the
gap between current image and reference *at each level of the pyramid*:

```
Reference fingerprint:
  Level 0: histogram shape → adjust exposure/blacks/whites to match
  Level 1: local contrast profile → adjust clarity
  Level 2: color palette (warm amber, desaturated shadows) → adjust color_temp, shadow_tint
  Level 3: (composition cannot be matched parametrically — noted, not attempted)
  Level 4: CLIP embedding distance = 0.18 (close match)
```

**Advantage**: user has direct control over the aesthetic target; avoids the subjectivity problem.
**Limitation**: requires a reference image, which users may not always have.
Also requires careful level-3 handling — composition differences should not generate
edit attempts, only diagnostic notes.

---

## 4. Composition: the hard ceiling

Level-3 composition is where parametric editing runs out of headroom. This deserves explicit acknowledgment.

**What parametric editing *can* do for composition:**
- Tonal separation: darken background to make subject "pop" (exposure + masking)
- Color contrast: shift subject color away from background (hue/saturation + masking)
- Depth emphasis: add vignette or gradient to draw attention to subject
- Mood reinforcement: match tonal choices to compositional intent

**What parametric editing *cannot* do:**
- Reframe or crop the image
- Move the subject
- Add or remove elements
- Change depth of field retroactively (without generative inpainting)

The seemantic design should be **explicit about this ceiling** rather than implying that
aesthetic improvement is unbounded. A diagnostic output like:

```
Aesthetic analysis: compositional tension is low (centered subject, symmetric framing).
This cannot be changed via parametric editing. Consider cropping or using a reference
image that shares this compositional style.
```

...is more useful than silently attempting and failing to address a level-3 gap with level-0 edits.

---

## 5. Subjectivity and personalization

Aesthetic quality is not a universal function. What reads as "beautifully moody" to one
person reads as "underexposed and depressing" to another. The pyramid helps with the
measurement problem but not the subjectivity problem.

**Three stances on subjectivity:**

### 5a. Ignore it (current approach)
Treat aesthetics as if there is a ground truth, use averaged human preference models (NIMA, LAION-aesthetics).
Works for gross quality improvements (fixing badly exposed images) but fails for style preference.

### 5b. User-provided reference (reference fingerprinting — §3c)
Sidesteps the subjectivity problem by making the user specify the target aesthetic explicitly.
This is the most pragmatic approach for a prototype — no personalization model required.

### 5c. Preference learning over session history
Track which edits the user accepts, rejects, and refines. Build a lightweight preference
model per user that weights the aesthetic dimensions differently:

```python
# After each accepted/rejected edit:
user_preference_model.update(
    edit=edit,
    outcome="accepted",  # or "rejected", "refined"
    image_context=aesthetic_fingerprint(image)
)
# Use learned weights to bias future LLM prompts:
# "This user weights color warmth heavily and is neutral on local contrast"
```

**Advantage**: learns the user's specific aesthetic vocabulary.
**Limitation**: requires session history (cold start problem for new users); adds complexity.
Deferred to post-prototype.

---

## 6. Proposed additions to the seemantic architecture

These are concrete additions the aesthetic framework motivates, ordered by implementation effort:

### 6a. Aesthetic analysis on session load (low effort)
On `POST /session`, compute and store a baseline aesthetic fingerprint:

```python
@dataclass
class AestheticFingerprint:
    nima_score: float             # 0–10, overall aesthetic quality
    clip_embedding: np.ndarray    # 512-dim, for reference comparison
    palette: list[tuple]          # 5 dominant colors (CIELAB)
    histogram_shape: str          # "compressed" | "full_range" | "clipped_highlights" | ...
    tonal_balance: str            # "low_key" | "high_key" | "balanced"
    estimated_mood: str           # CLIP nearest-neighbor from mood vocabulary
```

This is returned in `GET /state` and included in the LLM's system context for intent parsing.
No new endpoints needed; fingerprint is a property of the session state.

### 6b. Aesthetic gap endpoint (medium effort)
`GET /aesthetic/gap?branch=edit_a2&reference=<image_url_or_session_id>`

Returns a structured description of the difference between current state and a reference:

```json
{
  "level_0": { "exposure_delta": -0.4, "histogram_match": 0.72 },
  "level_1": { "clarity_delta": 12, "sharpness_match": 0.88 },
  "level_2": {
    "palette_distance": 0.31,
    "palette_suggestion": "shift toward warmer amber tones, desaturate shadows"
  },
  "level_3": {
    "composition_match": 0.45,
    "note": "Composition differences cannot be addressed via parametric editing."
  },
  "level_4": {
    "clip_distance": 0.28,
    "mood_gap": "reference is 'intimate and warm'; current is 'cool and neutral'"
  },
  "addressable_via_params": true,
  "suggested_intent": "warmer tones, lift shadows slightly, reduce overall coolness"
}
```

The `suggested_intent` field can be fed directly into `POST /edit` as an intent string —
closing the loop from aesthetic analysis to parametric edit.

### 6c. Aesthetic confidence in edit responses (low effort)
Extend the `POST /edit` response to include a predicted aesthetic delta:

```json
{
  "edit_id": "edit_a3",
  "diff": [...],
  "confidence": 0.87,
  "aesthetic_delta": {
    "nima_predicted_change": +0.3,
    "mood_movement": "toward warmer, more intimate"
  }
}
```

This gives the agent (and the human diff panel) a prediction of whether the edit
is moving toward or away from the aesthetic goal — not just whether the params are valid.

---

## 7. Open questions

These are genuinely unresolved and should be revisited as the prototype matures:

**Q1 — Is aesthetic quality decomposable?**
The pyramid implies aesthetics can be factored into separable levels. But there is a serious
argument that aesthetic quality is irreducibly holistic — that level-4 impression cannot be
reliably predicted from levels 0–3 even in combination. If this is true, the pyramid is a
useful heuristic but not a reliable engineering foundation.

**Q2 — Does optimizing aesthetic scores produce good images?**
NIMA and CLIP-aesthetic scores are trained on average human preferences over large datasets.
Optimizing them may produce "stock photo aesthetics" — technically high-scoring but generic.
The risk is an **aesthetic uncanny valley**: AI-edited images that look pleasant but soulless.
Reference image fingerprinting (§3c) may avoid this by targeting a specific aesthetic rather
than a learned average.

**Q3 — Where is the parametric ceiling, exactly?**
It is clear that composition (level 3) cannot be fully addressed via parametric editing.
It is less clear where the ceiling is within levels 0–2. Empirically: how much of the
aesthetic gap between a mediocre and a great photo can be closed by parametric edits alone?
The answer likely depends heavily on image genre. This question is worth testing early.

**Q4 — Can the LLM reliably bridge level-4 intent to level-0 params?**
The current design asks the LLM to translate "golden hour feel" into `{ color_temp: 6800, shadows: 15, ... }`.
This bridge is learned implicitly from pretraining and is not explicitly calibrated for photo editing.
The aesthetic analysis context (§6a) should improve this, but how much? Worth measuring:
run a set of intent strings through the parser with and without aesthetic context and compare
human ratings of the results.

**Q5 — How do you handle genre context?**
The same edit that improves a landscape may degrade a portrait. Aesthetic quality is
conditioned on image genre. The fingerprint includes an `estimated_mood` field but not
an explicit genre classifier. Should genre be a first-class concept in the schema?
(e.g., `GET /schema?genre=portrait` returns different semantic slider ranges)

**Q6 — Reference image copyright and privacy**
If reference image fingerprinting is implemented as a feature, users will upload images
they do not own (e.g., screenshots of Ansel Adams prints, social media photos).
The aesthetic fingerprint (embedding, palette, histogram) does not reproduce the reference
image's content — but the legal and ethical status of extracting and storing these fingerprints
from copyrighted images is unclear and should be reviewed before shipping.

**Q7 — Can the pyramid be learned end-to-end, or must it be hand-designed?**
The current proposal hand-designs the pyramid levels. An alternative is to learn a
hierarchical aesthetic representation end-to-end from human preference data.
This would require a dataset of images with human ratings at multiple levels of specificity
(not just "this image is a 7.2/10" but "the tonal balance is good but the composition is weak").
Such a dataset does not currently exist at scale.

---

## 8. Relationship to other proposals

| This proposal | Other proposal | Relationship |
|---|---|---|
| Aesthetic fingerprint on session load | `semantic_editor_proposal.md` §4 `POST /session` | Fingerprint computed and stored; returned in `GET /state` |
| Aesthetic gap endpoint | `semantic_editor_proposal.md` §4 API | New endpoint `GET /aesthetic/gap`; feeds `suggested_intent` into `POST /edit` |
| Aesthetic analysis context | `intent_parsing_proposal.md` §3 system prompt | Fingerprint added to LLM user message |
| Level-3 composition ceiling | `mask_region_proposal.md` §3.1 SAM | SAM detects subject for composition analysis; parametric ceiling noted in output |
| Level-1 texture | `image_backend_proposal.md` §4.4 clarity | Clarity addresses part of level-1; sharpening/NR deferred |

---

*This proposal is intentionally open-ended. The goal is to name the problem space precisely
enough to make good scope decisions during prototyping — not to close all questions upfront.*

# Semantic Image Editor — Prototype Proposal

> A dual-interface AI image tuning tool designed for both human operators and AI agents,
> sharing a single underlying state machine.

---

## 1. Problem statement

Traditional image editors (Lightroom-style) expose numeric, technical parameters — `color_temp: 5800K`, `highlights: -12` — that require domain expertise to use effectively. AI image tuning operates in latent/semantic space, which doesn't map 1:1 to these numeric axes.

The design challenge is twofold:

- **For humans**: bridge intent ("make it feel like golden hour") and parameters, without hiding the AI's reasoning
- **For AI agents**: expose a structured, observable, introspectable API that doesn't require pixel-level perception

Both interfaces must read and write to the same underlying state object.

---

## 2. Core architecture

```
┌─────────────────────────────────────────────┐
│              Shared state machine            │
│  { params, branch_tree, masks, history }     │
└──────────────┬──────────────────┬────────────┘
               │                  │
   ┌───────────▼──────┐  ┌────────▼───────────┐
   │   Human UI layer  │  │  Agent API layer    │
   │  (visual, drag,   │  │  (JSON, REST,       │
   │   prompt, brush)  │  │   schema-driven)    │
   └───────────────────┘  └────────────────────┘
```

A human dragging a slider and an agent POSTing `{ "warmth": 0.72 }` produce identical state mutations. The UI re-renders identically either way.

---

## 3. UI layout (human layer)

### Three-column layout

```
┌──────────────┬──────────────────────┬─────────────┐
│  Left panel  │     Canvas (center)  │ Right panel │
│  220px       │     flex: 1          │  200px      │
├──────────────┼──────────────────────┼─────────────┤
│ Edit history │  Tool strip          │ AI diff     │
│ (branch tree)│  + Image canvas      │ panel       │
│              │  + Variant strip     │             │
│ Semantic     │  + Prompt bar        │ Numeric     │
│ sliders      │                      │ sliders     │
│              │                      │             │
│ Style tiles  │                      │ Region mask │
└──────────────┴──────────────────────┴─────────────┘
```

### Left panel — intent controls (non-expert friendly)

**Edit history (branch tree)**
- Displays a visual tree, not a linear undo stack
- Every AI edit creates a named branch (e.g. `edit_a1`, `edit_b1`)
- Branches are non-destructive and coexist; the user can switch between them
- Current branch is highlighted

**Semantic sliders**
- Replace technical axes with perceptual ones:
  - `Warmth` → Cool ↔ Warm (maps to `color_temp`)
  - `Drama` → Soft ↔ Intense (maps to contrast + clarity + vignette)
  - `Mood` → Bright ↔ Moody (maps to exposure)
  - `Time` → Dawn ↔ Dusk (maps to color temperature curve)
- Sliders show gradient from pole to pole as visual affordance
- All values are `float 0–1` internally

**Style reference tiles**
- 8 preset aesthetic tiles (Golden, Coastal, Noir, Forest, Film, Fade, Vivid, Muted)
- Selecting a tile moves the image toward that aesthetic in latent space
- Strength slider (0–100%) controls interpolation distance
- Internally stored as `{ style_ref: "coastal", style_strength: 0.7 }`

### Center — canvas

**Toolbar (vertical strip)**
- Select, Brush mask, Gradient, Region select, Compare toggle

**Image canvas**
- Before/after split view: drag the divider left/right on hover when compare mode is active
- Labels "before" / "after" appear during comparison

**Variant strip**
- 4 AI-generated variants of the current edit shown as thumbnails
- One click switches the working state to that variant

**Prompt bar (bottom of canvas)**
- Natural language input: `"warmer shadows, keep highlights clean"`
- On submit → calls `/edit` with `{ intent: "..." }`
- AI interprets and writes a diff to the right panel

### Right panel — transparency + precision

**AI interpretation panel**
- Shows what the AI decided to change after a prompt, as a diff:
  ```
  Shadows     ████████░░  +warm
  Highlights  █░░░░░░░░░  ~0
  Contrast    ████░░░░░░  +mid
  ```
- Always visible — builds trust in the AI's reasoning

**Numeric sliders (advanced)**
- Direct access to: Exposure, Highlights, Shadows, Whites, Blacks, Clarity
- Updates in real-time when semantic sliders or prompts are applied

**Region mask panel**
- Displays active mask thumbnail if one is painted
- "Add mask" button activates the brush tool on the canvas
- Masks are stored as `mask_id` references, usable by both human and agent

---

## 3b. Undo model clarification

Branches and undo are **distinct mechanisms**:

- **Undo within a branch** (`Cmd+Z`) rolls back the last committed edit on the current branch. Each branch maintains a linear undo stack of its own commits. This is cheap: we just walk back `history` entries within that branch.
- **Branch switching** is non-destructive navigation — it doesn't undo anything; it changes which branch is "current". Think of it as checking out a different git branch.
- `dry_run` edits are **never** added to the undo stack, since they don't commit to state.

The UI makes this explicit: the left-panel branch tree is for navigation; `Cmd+Z` / `Cmd+Shift+Z` acts on the current branch's linear stack only.

---

## 4. Agent API (agent layer)

### Design principles

1. **Semantic params, not pixel ops** — agent writes `warmth: 0.7`, not `color_temp: 5800K`; the system translates
2. **Confidence + warnings on every response** — agent knows when intent mapped poorly and can escalate or retry
3. **Dry-run before committing** — agent previews diff and confidence score before writing to state
4. **Full observable state via GET /state** — agent never needs to infer state from visual pixels
5. **Branch IDs for non-destructive exploration** — agent can fork, explore, diff, and decide
6. **Introspectable schema via GET /schema** — agent discovers all valid params at session start

---

### Endpoints

#### `POST /session`
Create a new editing session by uploading or referencing an image. Returns a `session_id` used in all subsequent requests (via header or URL prefix).

**Request** (multipart or JSON)
```json
{
  "image_url": "https://...",   // OR use multipart file upload
  "image_id": "mountain_dusk"   // optional human-readable label
}
```

**Response**
```json
{
  "session_id": "sess_abc123",
  "image_id": "mountain_dusk",
  "state": { "...initial state with no edits..." }
}
```

All subsequent endpoints are scoped to a session. Prefix with `/session/{session_id}/` or pass `session_id` as a header.

---

#### `GET /export`
Render and return the final image for the current (or specified) branch.

**Query params**: `branch` (optional, defaults to current), `format` (`jpeg|png|tiff`), `quality` (1–100)

**Response**: Binary image stream with appropriate `Content-Type`, or a JSON `{ "download_url": "..." }` for async rendering.

Async behavior: if rendering takes >500ms, respond immediately with `{ "job_id": "...", "status": "pending" }` and emit a WebSocket event when done (see §4b).

---

#### `POST /edit`
Apply an edit. Returns new state snapshot + diff.

**Request**
```json
{
  "intent": "warmer shadows, keep highlights clean",
  "params": {
    "warmth": 0.72,
    "drama": 0.55,
    "highlight_protect": true
  },
  "region": "shadows",
  "branch_from": "edit_a2",
  "dry_run": false
}
```

All fields are optional. `intent` and `params` can be used together (agent provides both) or separately (agent provides only what it knows; system fills the rest).

**Response**
```json
{
  "edit_id": "edit_a3",
  "state": { "...full param snapshot..." },
  "diff": [
    { "param": "color_temp", "delta": 420 },
    { "param": "shadow_tint", "delta": 0.18 }
  ],
  "confidence": 0.87,
  "warnings": [],
  "preview_url": "https://..."
}
```

- `confidence`: 0–1, how cleanly intent mapped to params. Below `0.6` → agent should show human a preview or retry with refined intent.
- `dry_run: true` → computes and returns diff + confidence without committing to state. Use for multi-step planning.

---

#### `GET /state`
Read the full current state. Always available; idempotent.

**Response**
```json
{
  "image_id": "mountain_dusk",
  "current_branch": "edit_a2",
  "params": {
    "semantic": {
      "warmth": 0.65,
      "drama": 0.55,
      "mood": 0.40,
      "time": 0.72
    },
    "numeric": {
      "color_temp": 5800,
      "highlights": -12,
      "shadows": 28,
      "whites": 5,
      "blacks": -8,
      "clarity": 15
    },
    "style": {
      "style_ref": "coastal",
      "style_strength": 0.7
    }
  },
  "history": [
    { "id": "origin", "label": "Original", "children": ["edit_a1", "edit_b1"] },
    { "id": "edit_a1", "parent": "origin", "intent": "warm prompt" },
    { "id": "edit_a2", "parent": "edit_a1", "intent": "warmer + contrast" },
    { "id": "edit_b1", "parent": "origin", "intent": "noir branch" }
  ],
  "masks": [],
  "constraints": {
    "locked_params": []
  }
}
```

---

#### `POST /variants`
Generate N alternative edits from the current state (used to populate the variant strip).

**Request**
```json
{
  "branch_from": "edit_a2",
  "count": 4,
  "diversity": 0.3   // 0 = subtle variations, 1 = broad aesthetic range
}
```

**Response**
```json
{
  "variants": [
    { "branch_id": "variant_a2_1", "diff": [...], "preview_url": "..." },
    { "branch_id": "variant_a2_2", "diff": [...], "preview_url": "..." }
  ]
}
```

Each variant is a real branch in the tree — clicking a variant in the UI simply switches the current branch to it.

---

#### `POST /mask`
Create a region mask, either from a painted path or a semantic label resolved via SAM.

**Request**
```json
{
  "type": "semantic",          // "semantic" | "brush" | "gradient"
  "label": "sky",              // for "semantic" type
  "brush_path": null,          // for "brush" type: array of {x, y, radius} strokes
  "feather": 0.05              // edge softness, 0–1
}
```

**Response**
```json
{
  "mask_id": "mask_001",
  "thumbnail_url": "...",
  "coverage_pct": 0.34         // fraction of image pixels covered
}
```

#### `GET /mask/{mask_id}`
Returns mask metadata and thumbnail. The actual mask bitmap is served as a PNG at `thumbnail_url`.

#### `DELETE /mask/{mask_id}`
Removes a mask. Fails with `409` if any committed edit references this mask.

---

#### `GET /diff`
Compare two branches and return a param-level diff.

**Query params**: `branch_a`, `branch_b`

**Response**
```json
{
  "branch_a": "edit_a3",
  "branch_b": "edit_b2",
  "diff": [
    { "param": "warmth",    "a": 0.72, "b": 0.40, "delta": -0.32 },
    { "param": "color_temp","a": 6200, "b": 4800, "delta": -1400 }
  ],
  "similarity": 0.61   // 1 = identical params, 0 = maximally different
}
```

The agent uses this to pick a winner branch without needing pixel-level comparison.

---

#### `GET /schema`
Returns all valid parameters, types, ranges, and enum values. Agent calls this once at session start.

**Response (excerpt)**
```json
{
  "semantic_params": {
    "warmth":  { "type": "float", "min": 0, "max": 1, "maps_to": "color_temp 3200–7500K" },
    "drama":   { "type": "float", "min": 0, "max": 1, "maps_to": "contrast + clarity + vignette" },
    "mood":    { "type": "float", "min": 0, "max": 1, "maps_to": "exposure + brightness" },
    "time":    { "type": "float", "min": 0, "max": 1, "maps_to": "color temperature curve" },
    "style_ref": {
      "type": "enum",
      "values": ["golden", "coastal", "noir", "forest", "film", "fade", "vivid", "muted"]
    },
    "region": {
      "type": "enum",
      "values": ["shadows", "highlights", "midtones", "sky", "subject", "background"],
      "also_accepts": "mask_id (string)"
    }
  },
  "numeric_params": {
    "color_temp":  { "type": "int",   "min": 2000,  "max": 10000 },
    "highlights":  { "type": "int",   "min": -100,  "max": 100 },
    "shadows":     { "type": "int",   "min": -100,  "max": 100 },
    "whites":      { "type": "int",   "min": -100,  "max": 100 },
    "blacks":      { "type": "int",   "min": -100,  "max": 100 },
    "clarity":     { "type": "int",   "min": -100,  "max": 100 },
    "exposure":    { "type": "float", "min": -5.0,  "max": 5.0  }
  }
}
```

---

### Error response format

All endpoints return errors in a consistent envelope:

```json
{
  "error": {
    "code": "PARAM_OUT_OF_RANGE",
    "message": "warmth must be between 0 and 1, got 1.4",
    "param": "warmth",
    "received": 1.4
  }
}
```

Common codes:

| Code | HTTP | Meaning |
|---|---|---|
| `PARAM_OUT_OF_RANGE` | 422 | Value outside schema bounds |
| `UNKNOWN_PARAM` | 422 | Param not in schema |
| `LOCKED_PARAM` | 409 | Param is in `locked_params` |
| `MASK_NOT_FOUND` | 404 | Referenced `mask_id` doesn't exist |
| `BRANCH_NOT_FOUND` | 404 | `branch_from` doesn't exist |
| `CONFIDENCE_TOO_LOW` | 200 | Edit processed but `confidence < 0.3`; treat as soft warning, not error |
| `RENDER_PENDING` | 202 | Export job queued; poll or await WebSocket event |

---

### Agent decision loop (pseudocode)

```python
# 1. Session start — discover the schema
schema = GET /schema

# 2. Read current state
state = GET /state

# 3. Plan edits with dry_run
for each intended_edit:
    preview = POST /edit { ...params, dry_run: True }
    if preview.confidence < 0.6:
        escalate_to_human(preview)  # show diff, ask for approval
    elif preview.warnings:
        refine_intent_and_retry()

# 4. Commit approved edits
result = POST /edit { ...params, dry_run: False, branch_from: state.current_branch }

# 5. Compare branches
diff = GET /diff?branch_a=edit_a3&branch_b=edit_b2
# score each param delta against the goal vector to pick a winner
# (no pixel reading required — pure param comparison)
```

---

## 4b. Real-time update model

The human UI and the agent API share state. When the agent mutates state, the UI must re-render without polling.

**Mechanism: WebSocket connection per session**

```
ws://host/session/{session_id}/events
```

All state mutations (from agent or human) emit an event:

```json
{
  "event": "state_changed",
  "source": "agent",           // "agent" | "human"
  "edit_id": "edit_a3",
  "diff": [...],
  "current_branch": "edit_a3"
}
```

Other event types: `variant_ready`, `export_ready`, `agent_plan_started`, `agent_plan_cancelled`.

**Concurrency / conflict model:**

- State writes are **serialized** server-side (last write wins within a branch).
- If a human drags a slider while an agent plan is in-flight:
  1. Server emits `agent_plan_cancelled` to the agent's WebSocket.
  2. Human's write commits immediately.
  3. Agent receives the cancellation, reads the new `/state`, and re-plans if desired.
- There is **no optimistic locking** in the prototype — this is acceptable for single-user sessions. Multi-user collaboration would require CRDTs or explicit lock tokens (deferred).

---

## 5. Human-in-the-loop handoff

The agent escalates to a human when:

| Condition | Agent action |
|---|---|
| `confidence < 0.6` | Surface preview + diff to human, request approval |
| `warnings` non-empty | Explain the conflict (e.g. "boosting warmth will clip highlights"), ask human to choose |
| `locked_params` conflict | Inform human which constraint is blocking, ask them to unlock or adjust goal |
| Multi-step plan with >3 edits | Show the full plan as a dry-run sequence before executing |

Human override: at any point the human can drag a slider or type a prompt — this writes directly to state and cancels any pending agent plan.

---

## 6. Suggested prototype stack

| Layer | Suggestion |
|---|---|
| Frontend | React + Tailwind. Canvas = `<canvas>` or WebGL for image ops. |
| State management | Zustand or Redux — single store shared by UI and API mock |
| API mock (local dev) | Express.js or FastAPI with in-memory state, fake image transforms |
| Image processing | `sharp` (Node) or `Pillow` (Python) for actual param-to-pixel ops |
| AI intent → params | Call an LLM with the schema as context; parse structured JSON response |
| Region segmentation | SAM (Segment Anything) for `"region": "sky"` → mask conversion |

---

## 7. Prototype milestones

**M0 — Session + transport layer**
- `POST /session` with image upload (or URL reference)
- WebSocket `/events` stub that broadcasts all state mutations
- `GET /export` returning the unedited source image (no transforms yet)
- Goal: end-to-end plumbing exists before any editing logic

**M1 — State machine + API skeleton**
- Implement `/state`, `/schema`, `/edit` (dry_run + commit), `/diff`, `/variants` with in-memory store
- No real image processing yet; fake diff responses
- Goal: agent can run the full decision loop against mock data

**M2 — Human UI shell**
- Three-column layout with semantic sliders, prompt bar, diff panel
- Wired to the same state store as the API
- Before/after compare view

**M3 — Real image operations**
- Implement `seemantic_renderer` package per `image_backend_proposal.md` (milestones R1–R4)
- Wire numeric params to the renderer pipeline (linearize → white balance → exposure → tone curve → clarity)
- Semantic → numeric mapping layer (weighted linear lookup table, see §8)
- Style tile blending via param interpolation

**M4 — AI intent parsing**
- LLM call: `intent string + schema → { params, confidence }`
- Confidence thresholding + human escalation flow

**M5 — Region & mask support**
- Brush mask tool in UI
- SAM integration for semantic region names (`"sky"`, `"subject"`)
- Region-constrained edits

---

## 8. Key design decisions to revisit during prototyping

- **Confidence scoring**: simple cosine similarity of intent embedding vs param diff, or ask the LLM to self-report?
- **Branch storage**: in-memory tree (fine for prototype) vs persistent (needed for async agent workflows)
- **Style tiles**: pre-baked LUT files, or latent-space vectors that the AI interpolates at edit time?
- **Semantic → numeric mapping**: Start with a hard-coded linear lookup table for the prototype — each semantic axis is a weighted sum over numeric params (e.g., `warmth` → `color_temp * 0.8 + shadow_tint * 0.2`). This is fast, deterministic, and trivially invertible (numeric → semantic read-back). Replace with a learned mapping only if the hard-coded one proves too rigid. The table itself lives in a JSON config file so UX iteration doesn't require code changes.
- **Real-time vs async**: human edits should be real-time (<100ms); agent edits can be async with a progress indicator

---

*Generated from design exploration session. Ready for agent-assisted prototyping.*

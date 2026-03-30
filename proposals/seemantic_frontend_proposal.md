# Seemantic Frontend — Scope Proposal

> Companion to `semantic_editor_proposal.md`. Defines the frontend-only prototype,
> especially a properly constrained M0 that proves the interaction model without
> implying backend, rendering, or agent completeness.

---

## 1. Goal

The frontend prototype should answer one question well:

**Can Seemantic present semantic image-editing controls in a way that feels legible,
coherent, and agent-compatible before any real image processing exists?**

This means the frontend is not trying to prove image quality, transport architecture,
or AI correctness yet. Its job is to validate the editing surface and the shared state
shape that both humans and agents will eventually use.

---

## 2. Product question for M0

M0 should prove a single loop:

1. The user can inspect the current edit state.
2. The user can change semantic controls.
3. The rest of the UI updates consistently from that shared state.

If we can do that cleanly, we have enough signal to move on. If we cannot, adding
prompting, masks, variants, or transport layers will only add noise.

---

## 3. Frontend M0 scope

M0 is a **frontend-only interaction prototype**. It should include only the smallest set
of surfaces needed to validate the shared editing model.

### In scope

- A stable editor shell with a clear primary workspace
- A single in-memory editor store that represents the shared state object
- Four semantic controls:
  - `warmth`
  - `drama`
  - `mood`
  - `time`
- A lightweight state-inspection surface showing how semantic values map into visible UI
- One preview surface using a mocked image or placeholder artwork
- Minimal branch context:
  - show the current branch label
  - optionally allow switching between 2-3 mocked branches
- Basic prompt input as a **UI affordance only**
  - text can be entered
  - submit can update mocked state or show a mocked interpretation
  - no real intent parsing is required

### Success criteria

- The editing surface feels understandable within a few seconds
- Semantic controls feel like the primary interaction model, not a thin layer over technical sliders
- A single state update produces consistent UI changes everywhere it appears
- The codebase establishes a clean boundary between domain state and visual components

---

## 4. Explicitly out of scope for M0

The following should not be treated as frontend-M0 requirements:

- Real image rendering or pixel operations
- Before/after split comparison
- Variant generation or variant strip interaction
- Mask creation, brush tools, or region selection workflows
- WebSocket transport or session lifecycle plumbing
- File upload flows
- Export flows
- Real LLM-backed prompt interpretation
- Schema discovery, REST wiring, or agent transport contracts
- Full numeric-control parity with a future pro editor
- Undo/redo behavior beyond what is needed for local prototype comfort

These are all reasonable later milestones, but each adds surface area without helping us
answer the core M0 question.

---

## 5. Recommended M0 layout

The initial frontend should bias toward clarity over completeness.

### Recommended structure

**Left column**
- Semantic controls
- Optional compact branch switcher

**Center column**
- Mocked image preview
- Prompt bar

**Right column**
- State inspection panel
- Optional mocked AI interpretation card

This is intentionally smaller than the full product layout in `semantic_editor_proposal.md`.
The right side is for transparency and debugging, not advanced editing depth yet.

---

## 6. State model for the frontend prototype

The frontend should use one local store that resembles the eventual shared state machine,
but only includes fields that the prototype truly exercises.

### Required state

```ts
type FrontendM0State = {
  currentBranchId: string;
  prompt: string;
  semantic: {
    warmth: number;
    drama: number;
    mood: number;
    time: number;
  };
  ui: {
    selectedPreviewId: string;
  };
  branches: Array<{
    id: string;
    label: string;
  }>;
  mockedInterpretation: Array<{
    label: string;
    direction: "up" | "down" | "neutral";
    amount: number;
  }>;
};
```

### State design principles

- Keep the store small enough to understand in one read
- Prefer explicit fields over future-proof abstractions
- Only model interactions the user can actually perform in M0
- Avoid adding API-shaped fields just because they may exist later

This is important: the frontend prototype should be **honest about what it knows**.
Pretending to support a fuller backend contract too early will create confusing fake complexity.

---

## 7. UX principles

### 7.1 Semantic-first

The first thing a user should notice is that the editor speaks in perceptual language,
not technical jargon.

### 7.2 Transparent, not overloaded

We should expose enough internal state to build trust, but not so much that M0 becomes
an imitation of Lightroom plus an agent console.

### 7.3 Mock behavior should feel intentional

If prompting and interpretation are mocked, they should still look deliberate:
- stable sample outputs
- no fake spinners implying real inference
- clear labels like `Mock interpretation`

### 7.4 Design for future dual-use

Even though M0 is human-facing, component boundaries should still reflect the eventual
shared model:
- controls dispatch state changes
- panels read from state
- no component owns hidden business logic that would later need to move server-side

---

## 8. Proposed milestone breakdown

### F0 — Frontend M0: interaction prototype

- Editor shell with left / center / right structure
- In-memory state store
- Four semantic sliders
- Mock preview surface
- Prompt input with mocked interpretation
- Small state inspection panel

**Goal**: prove the semantic editing loop and establish the frontend architecture.

### F1 — Frontend refinement

- Improve visual hierarchy and interaction polish
- Tighten copy, labels, and control affordances
- Add local undo/redo if it materially helps evaluation
- Add lightweight responsive behavior for laptop screens

**Goal**: make the prototype feel intentional enough for product review and user feedback.

### F2 — Advanced frontend surfaces

- Before/after compare
- Numeric controls
- Branch tree visualization
- Variant strip
- Mask entry points

**Goal**: expand the interface only after F0 proves the core model is worth deepening.

### F3 — API-connected frontend

- Replace mock state transitions with real session/state endpoints
- Wire prompt submission to backend behavior
- Reflect server-authored diffs and constraints in the UI

**Goal**: preserve the validated interaction model while swapping in real system behavior.

---

## 9. What “done” looks like for frontend M0

Frontend M0 is done when:

- We can demo the semantic editing loop end-to-end in the browser
- The scope can be explained in one sentence: "This is a UI/state prototype, not a renderer"
- New contributors can quickly find where state lives and how interactions flow
- Nobody mistakes the prototype for a partially finished full editor

That last point matters. A well-scoped M0 should create confidence, not ambiguity.

---

## 10. Relationship to the main proposal

`semantic_editor_proposal.md` describes the full product direction: shared state,
human and agent surfaces, API design, rendering pipeline, and later milestones.

This frontend proposal narrows only the **client-side prototyping track**:

- It keeps the semantic-editor vision intact
- It reduces M0 to a credible first slice
- It defers transport, rendering, and agent sophistication until the UI model is proven

If there is a conflict between the breadth of the main proposal and the implementation
scope of frontend M0, this document should win for frontend planning.

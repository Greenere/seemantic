# Aesthetic DSL — Design Proposal

> Specifies a domain-specific language for expressing photographic aesthetic intent
> at the right level of abstraction — above raw params, below natural language.
> Companion to `aesthetic_design_proposal.md` and `intent_parsing_proposal.md`.

---

## 1. Motivation

The current intent parsing pipeline makes one large, untestable leap:

```
"warmer shadows, keep highlights clean"  →  LLM  →  { color_temp: 6800, shadow_tint: 0.18, ... }
```

Natural language is at aesthetic level 4; params are at level 0. The LLM bridges five levels
of abstraction in a single implicit step, which is hard to validate, debug, or improve incrementally.

An aesthetic DSL inserts a structured intermediate representation:

```
natural language  →  LLM  →  AestheticDSL  →  compiler  →  params
```

Each step is smaller, independently testable, and operates at a coherent abstraction level.
The DSL also becomes the canonical representation for diffs, style reuse, and agent introspection —
the human-readable layer that currently does not exist between intent and params.

---

## 2. Design principles

- **Declarative**: express *what* the aesthetic should be, not *how* to achieve it
- **Photographer-vocabulary**: primitives map to how photographers actually talk about images
- **Composable**: styles can extend, override, and blend with each other
- **Tolerant**: partial specs are valid; unspecified properties inherit from current state
- **Bidirectional**: params can be read back into DSL (for diffs and introspection)
- **Ceiling-aware**: composition directives that exceed parametric capability emit annotations rather than silently failing

---

## 3. Syntax

### 3.1 Full example

```
@extends film-noir
@strength 0.6

tone {
  shadows:    warm(amber) lift(+slight)
  highlights: cool(slight) protect roll-off(gentle)
  midtones:   contrast(+mid)
}

palette {
  dominant:  warm-amber
  accent:    desaturated-teal
  harmony:   split-complementary
}

mood: intimate cinematic

region sky {
  tone.exposure:    -0.5ev
  tone.saturation:  -20
}

region subject {
  tone:        pop
  separation:  from-background(+luminance)
}

composition {
  emphasis:  subject
  depth:     layered
}
```

### 3.2 Minimal example

Not all blocks are required. A valid minimal edit:

```
tone {
  shadows: warm(amber)
}
```

Unspecified properties are unchanged from current state.

---

## 4. Formal grammar

```
program         ::= directive* block*

directive       ::= '@extends' style_name
                  | '@strength' number          // 0.0–1.0, scales all directives

block           ::= 'tone'        '{' tone_stmt* '}'
                  | 'palette'     '{' palette_stmt* '}'
                  | 'mood'        ':' mood_keyword+
                  | 'region'      region_label '{' region_stmt* '}'
                  | 'composition' '{' comp_stmt* '}'

// ── Tone block ──────────────────────────────────────────────────────────────

tone_stmt       ::= tone_zone ':' tone_directive+

tone_zone       ::= 'shadows' | 'highlights' | 'midtones' | 'global'

tone_directive  ::= 'warm' arg_list?             // increase warmth
                  | 'cool' arg_list?             // decrease warmth
                  | 'lift' strength?             // raise luminance
                  | 'crush' strength?            // lower luminance / deepen blacks
                  | 'protect'                    // prevent clipping
                  | 'roll-off' rolloff_type?     // gentle/hard transition at boundary
                  | 'contrast' strength?         // increase local contrast (clarity)
                  | 'exposure' signed_ev         // explicit EV delta
                  | 'saturation' signed_int      // explicit saturation delta

rolloff_type    ::= '(' 'gentle' | 'hard' ')'

// ── Palette block ────────────────────────────────────────────────────────────

palette_stmt    ::= 'dominant' ':' color_ref
                  | 'accent'   ':' color_ref
                  | 'harmony'  ':' harmony_keyword

color_ref       ::= color_keyword | 'none' | 'monochrome'

color_keyword   ::= 'warm-amber' | 'cool-blue' | 'desaturated-teal'
                  | 'forest-green' | 'dusty-rose' | 'golden' | 'crimson'
                  // extensible via palette config file

harmony_keyword ::= 'complementary' | 'split-complementary' | 'analogous'
                  | 'triadic' | 'achromatic' | 'monochromatic'

// ── Mood ─────────────────────────────────────────────────────────────────────

mood_keyword    ::= 'intimate' | 'cinematic' | 'editorial' | 'documentary'
                  | 'romantic' | 'tense' | 'serene' | 'dramatic' | 'nostalgic'
                  | 'raw' | 'polished' | 'ethereal' | 'gritty'

// ── Region block ─────────────────────────────────────────────────────────────

region_label    ::= 'sky' | 'subject' | 'background' | 'foreground'
                  | 'shadows' | 'highlights' | 'midtones'
                  | mask_id                     // "mask_001" — reference to stored mask

region_stmt     ::= 'tone' '.' tone_zone ':' tone_directive+
                  | 'tone' ':' 'pop'            // shorthand: local contrast lift + slight exposure
                  | 'separation' ':' 'from-background' '(' '+luminance' | '+color' ')'
                  | 'tone' '.' 'exposure'  ':' signed_ev
                  | 'tone' '.' 'saturation' ':' signed_int

// ── Composition block ────────────────────────────────────────────────────────

comp_stmt       ::= 'emphasis'  ':' comp_target
                  | 'depth'     ':' 'layered' | 'flat'
                  | 'vignette'  ':' strength

comp_target     ::= 'subject' | 'background' | 'sky' | 'none'

// ── Shared terminals ─────────────────────────────────────────────────────────

arg_list        ::= '(' arg (',' arg)* ')'
arg             ::= value | ident '=' value

strength        ::= '(' ('+' | '-') intensity ')'
intensity       ::= 'slight' | 'mid' | 'strong' | 'gentle'  // maps to 0.2 / 0.5 / 1.0 / 0.15

signed_ev       ::= ('+' | '-') number 'ev'
signed_int      ::= ('+' | '-') integer

style_name      ::= ident                        // resolved against styles.json
mask_id         ::= '"mask_' integer '"'
```

---

## 5. Compiler: DSL → params

The compiler walks the AST and resolves each directive to numeric param deltas,
accumulating them in a `ParamDelta` object. Directives are applied in declaration order;
later directives in the same tone zone override earlier ones for the same underlying param.

### 5.1 Strength resolution

```python
INTENSITY_SCALE = {
    "gentle": 0.15,
    "slight": 0.25,
    "mid":    0.55,
    "strong": 1.0,
}

def resolve_strength(intensity: str | None, default: float = 0.55) -> float:
    if intensity is None:
        return default
    return INTENSITY_SCALE[intensity]
```

The `@strength` directive applies a global multiplier to all resolved deltas at the end.

### 5.2 Tone directive resolution

Each directive maps to one or more param deltas. All values are *deltas from current state*,
not absolute values — the compiler reads current params from state before resolving.

```python
TONE_RESOLVERS = {
    # (zone, directive) → { param: delta_formula }
    ("shadows",    "warm"):     lambda s: { "shadow_tint": +0.15 * s, "color_temp": +300 * s },
    ("shadows",    "cool"):     lambda s: { "shadow_tint": -0.12 * s, "color_temp": -200 * s },
    ("shadows",    "lift"):     lambda s: { "shadows": +25 * s },
    ("shadows",    "crush"):    lambda s: { "shadows": -20 * s, "blacks": -15 * s },
    ("highlights", "warm"):     lambda s: { "highlight_tint": +0.1 * s, "whites": +8 * s },
    ("highlights", "cool"):     lambda s: { "highlight_tint": -0.1 * s },
    ("highlights", "protect"):  lambda _: { "highlights": -20, "highlight_protect": True },
    ("highlights", "roll-off"): lambda s: { "highlights": -15 * s, "whites": -10 * s },
    ("midtones",   "contrast"): lambda s: { "clarity": +20 * s },
    ("global",     "exposure"): lambda ev: { "exposure": ev },        # ev is the signed float
    ("*",          "saturation"): lambda v: { "saturation": v },
}
```

`split-tone` in the palette block activates shadow_tint and highlight_tint with opposing signs,
independently of any `warm`/`cool` in the tone block.

### 5.3 Palette resolution

```python
PALETTE_RESOLVERS = {
    "warm-amber":       { "color_temp": +500, "shadow_tint": +0.1 },
    "cool-blue":        { "color_temp": -600 },
    "desaturated-teal": { "saturation": -15, "hue_shift": +15 },  # toward teal
    "monochrome":       { "saturation": -100 },
    "golden":           { "color_temp": +800, "highlights": +5, "shadows": +10 },
}

HARMONY_RESOLVERS = {
    "split-complementary": "activate_split_tone",   # handled in tone pipeline
    "achromatic":           { "saturation": -80 },
    "analogous":            None,  # diagnostic only — no param mapping
}
```

Color harmony keywords that cannot be achieved via available params emit a compiler annotation:
*"analogous harmony cannot be enforced via parametric editing; palette shift applied only."*

### 5.4 Mood resolution

Mood keywords compile to named param bundles defined in `styles.json`:

```json
{
  "cinematic":  { "clarity": 8,  "contrast": 12, "saturation": -8, "vignette": 0.2 },
  "intimate":   { "color_temp": 200, "shadows": 10, "clarity": -5, "vignette": 0.15 },
  "editorial":  { "contrast": 20, "clarity": 15, "saturation": -5 },
  "nostalgic":  { "color_temp": 300, "saturation": -20, "fade": 0.15 }
}
```

Multiple mood keywords are blended by averaging their param bundles, weighted equally.
`mood: intimate cinematic` → average of both bundles, then scale by `@strength`.

### 5.5 Region directive resolution

Region directives resolve the same way as tone directives but are tagged with a `mask_id`
or a luminance-based mask selector. The resolved delta is passed to the renderer with the mask:

```python
@dataclass
class MaskedParamDelta:
    delta: dict[str, float]
    mask_selector: str          # mask_id, "shadows", "highlights", "sky", etc.
```

`separation: from-background(+luminance)` triggers a mask-constrained edit:
darken background using the subject mask's inverse, at a strength proportional to the
directive's strength modifier.

`tone: pop` is a shorthand that expands to:
```
tone.midtones: contrast(+mid)
tone.global:   exposure(+0.15ev)
```
applied within the region mask only.

### 5.6 Composition directive resolution

```python
COMPOSITION_RESOLVERS = {
    "emphasis:subject":    [
        MaskedParamDelta({"exposure": -0.4, "clarity": -5}, mask_selector="background"),
        ParamDelta({"vignette": 0.25}),
    ],
    "emphasis:sky":        [
        MaskedParamDelta({"exposure": +0.3, "saturation": +5}, mask_selector="sky"),
    ],
    "depth:layered":       [
        # tonal separation between subject and background
        MaskedParamDelta({"exposure": +0.2, "clarity": +8}, mask_selector="subject"),
        MaskedParamDelta({"exposure": -0.3}, mask_selector="background"),
    ],
    "vignette":            lambda s: ParamDelta({"vignette": s}),
}
```

Composition directives that require subject detection (`emphasis: subject`, `depth: layered`)
trigger an implicit `POST /mask { type: "semantic", label: "subject" }` if no subject mask
exists in the session. The compiler suspends and resumes after the mask is ready
(async, notified via WebSocket `mask_ready` event).

### 5.7 Compiler output

```python
@dataclass
class CompilerResult:
    params: NumericParams               # fully resolved absolute param values
    masked_edits: list[MaskedParamDelta]  # region-constrained sub-edits
    annotations: list[str]              # what could/couldn't be achieved
    ceiling_hits: list[str]             # directives that exceeded parametric capability
    dsl_ast: ASTNode                    # stored in state for read-back
    confidence: float                   # 0–1, how cleanly DSL mapped to params
```

**Example annotation output:**

```
✓ tone.shadows warm(amber):   shadow_tint +0.12, color_temp +240
✓ tone.highlights protect:    highlights -20, highlight_protect true
✓ mood intimate cinematic:    blended param bundle applied
⚠ palette harmony analogous:  no param mapping available — noted only
⚠ composition depth layered:  partial — tonal separation applied;
                               spatial reframing not possible via params
```

---

## 6. Bidirectional: params → DSL (read-back)

Given a param snapshot, the read-back pass generates a DSL description.
This is used for:
- The diff panel (DSL diff instead of param diff)
- Agent introspection (`GET /state` can return DSL alongside params)
- Style tile generation (extract DSL from manually tuned looks)

### 6.1 Read-back rules

Each param (or correlated param group) maps back to the nearest DSL expression:

```python
READBACK_RULES = [
    # Rules are evaluated in order; first match wins
    # (condition, dsl_output)
    (lambda p: p.shadow_tint > 0.08 and p.color_temp > 5500,
        "tone.shadows: warm(amber)"),
    (lambda p: p.shadow_tint < -0.08,
        "tone.shadows: cool"),
    (lambda p: p.shadows > 15,
        "tone.shadows: lift(+slight)" if p.shadows < 25 else "tone.shadows: lift(+mid)"),
    (lambda p: p.blacks < -15 and p.shadows < -10,
        "tone.shadows: crush(+mid)"),
    (lambda p: p.highlights < -15 and p.whites < -5,
        "tone.highlights: protect roll-off(gentle)"),
    (lambda p: p.clarity > 12,
        "tone.midtones: contrast(+mid)"),
    (lambda p: p.saturation < -15,
        "palette.dominant: desaturated"),
    (lambda p: p.vignette > 0.15,
        "composition.vignette: (+mid)"),
    # ... etc.
]
```

Read-back is approximate — it is a best-effort description, not a lossless inversion.
The stored `dsl_ast` on committed edits is the authoritative record; read-back is used
only for edits made via direct param manipulation (sliders, numeric panel) that bypassed the DSL.

### 6.2 DSL diff in the right panel

The AI diff panel currently shows:

```
Shadows     ████████░░  +warm
Highlights  █░░░░░░░░░  ~0
Contrast    ████░░░░░░  +mid
```

With DSL read-back, the panel shows alongside or instead:

```diff
- tone.shadows: neutral
+ tone.shadows: warm(amber) lift(+slight)
  tone.highlights: protect roll-off(gentle)   [unchanged]
+ tone.midtones: contrast(+mid)
```

Both representations are shown — the bar chart for quick visual scanning, the DSL diff
for precise understanding. The DSL diff is also what agents receive in `POST /edit` responses
(as `dsl_diff` field alongside `diff`).

---

## 7. Style library and @extends

Named styles are defined in `styles.json` as DSL source strings (not param blobs):

```json
{
  "film-noir": {
    "dsl": "tone { shadows: crush(strong) cool(slight) highlights: protect contrast(+strong) } palette { dominant: monochrome harmony: achromatic } mood: tense dramatic",
    "compiled_params": { "..." }   // cached compilation; invalidated when DSL changes
  },
  "golden-hour": {
    "dsl": "tone { shadows: warm(amber) lift(+slight) highlights: warm(+slight) protect } palette { dominant: warm-amber harmony: analogous } mood: intimate",
    "compiled_params": { "..." }
  }
}
```

`@extends film-noir` copies the base style's AST into the current program as the first block.
Subsequent blocks override specific properties (last declaration wins, like CSS).

`@extends film-noir @strength 0.6` scales the base style's compiled param deltas by 0.6
before applying the current program's overrides. This is equivalent to the style tile
strength slider in the main proposal — now expressed as a DSL directive.

**User-defined styles**: after creating a look manually (sliders + prompts), a user can
call `POST /style { name: "my-preset", branch_id: "edit_a5" }`. The server runs the
read-back pass on `edit_a5`'s params, generates DSL source, and saves it to `styles.json`.
The style is then available as `@extends my-preset` in future sessions.

---

## 8. LLM integration

The LLM in `intent_parsing_proposal.md` currently outputs `{ params, confidence, warnings }`.
With the DSL, it instead outputs a DSL program string, which is then compiled server-side.

### 8.1 Updated LLM tool definition

```python
tools = [{
    "name": "propose_aesthetic",
    "description": "Express the desired aesthetic change as a DSL program.",
    "input_schema": {
        "type": "object",
        "properties": {
            "dsl": {
                "type": "string",
                "description": "A valid AestheticDSL program expressing the intended edit."
            },
            "reasoning": {
                "type": "string",
                "description": "One sentence explaining the aesthetic intent behind the DSL."
            },
            "confidence": {
                "type": "number",
                "description": "0–1. How clearly the user's intent mapped to DSL expressions."
            },
            "warnings": {
                "type": "array",
                "items": { "type": "string" }
            }
        },
        "required": ["dsl", "reasoning", "confidence", "warnings"]
    }
}]
```

The DSL grammar is included in the system prompt as a reference card (abbreviated, not the full BNF):

```
# AestheticDSL quick reference

tone { shadows|highlights|midtones|global: <directives> }
  directives: warm, cool, lift, crush, protect, roll-off(gentle|hard),
              contrast(+slight|+mid|+strong), exposure(±Nev), saturation(±N)

palette { dominant: <color>, accent: <color>, harmony: <type> }
  colors: warm-amber, cool-blue, desaturated-teal, golden, monochrome, none
  harmony: complementary, split-complementary, analogous, achromatic

mood: intimate | cinematic | editorial | nostalgic | tense | serene | dramatic | ...

region <sky|subject|background|shadows|highlights|midtones|"mask_id"> { ... }

composition { emphasis: subject|sky|none, depth: layered|flat, vignette: (+slight|...) }

@extends <style_name>   // inherit a named style
@strength 0.0–1.0       // scale all effects
```

### 8.2 Why DSL output is more reliable than param output

The LLM reasons in aesthetic concepts, not in numeric ranges. Asking it to output
`"shadow_tint": 0.18` requires it to know that 0.18 is the right magnitude for "slightly warm shadows".
Asking it to output `tone.shadows: warm(amber) lift(+slight)` lets it reason at the level
it was trained on — how photographers describe tonal choices — and delegates magnitude
resolution to the compiler, which applies consistent, tested scaling.

Grammar validation (before compilation) catches errors at parse time with specific messages:
*"Unknown tone directive: 'brighten' — did you mean 'lift'?"*

---

## 9. Open questions

**Q1 — User-facing or internal?**
The biggest unresolved design choice: do photographers write DSL directly, or is it
purely an internal representation (LLM → DSL → params, user never sees it)?

- **Internal only**: lower design bar, still gets all reliability and diffing benefits.
  DSL is visible in the diff panel as read-only output.
- **User-facing**: photographers can write and save DSL programs directly, which is
  powerful for advanced users. Requires a much more polished language (good error
  messages, syntax highlighting, an in-app editor, documentation).

For the prototype: internal only. Expose DSL source in the diff panel as read-only.
Revisit user-facing editing in a later sprint.

**Q2 — How complete does the primitive set need to be before it's useful?**
The grammar above covers tone, palette, mood, region, and composition.
But "warm shadows" can mean different things: warmer color temperature overall,
or a split-tone effect with amber tint in the shadows only. The compiler's resolution
of `warm(amber)` in the shadows zone makes a specific choice. Is this the right choice
for all contexts, or does it need a richer vocabulary?

Risk: an incomplete primitive set forces the LLM to use approximate expressions,
which produces systematic errors in the compiled params. Mitigant: test the most
common intent strings against expected param outputs before launch.

**Q3 — How is the DSL versioned?**
If the grammar or compiler evolves (e.g. `warm` starts mapping to different param weights),
stored DSL programs in session history may compile to different params than they did originally.
Options:
- Store both DSL source and compiled params — recompilation is optional, not automatic
- Version the grammar (`@version 1.0` directive) and run old programs against their grammar version
- Accept drift as acceptable for a prototype (simple, but not production-safe)

**Q4 — Handling params not representable in DSL**
Some numeric params may not have DSL counterparts (e.g. if a new `fade` param is added
to the schema before a DSL primitive is designed for it). These params are still settable
via the numeric panel and `POST /edit params-only` mode. The DSL simply doesn't express them.
How is this surfaced to agents that introspect state via DSL? Return both DSL and raw params
in `GET /state` and let agents use whichever representation is appropriate.

**Q5 — Composition directives and SAM latency**
`composition { emphasis: subject }` triggers an implicit SAM segmentation call if no
subject mask exists. This adds up to 400ms to the compile→render path. Should composition
directives be asynchronous (compile without them, apply when mask is ready)
or synchronous (block compilation until mask is ready)?
Leaning toward async with a two-phase commit: compile without composition,
render preview immediately, apply composition edit as a follow-up edit when mask arrives.

**Q6 — DSL as a target for agent planning**
An agent running a multi-step edit plan could express its entire plan as a sequence
of DSL programs before executing any of them — a "plan diff" that is human-readable
and approvable before execution. This would be a significant improvement over the
current dry_run sequence described in `semantic_editor_proposal.md` §5.
Worth specifying as an agent workflow extension once the core DSL is stable.

---

## 10. Relationship to other proposals

| This proposal | Other proposal | Relationship |
|---|---|---|
| DSL → params compiler | `image_backend_proposal.md` render pipeline | Compiler output feeds `render()` as `NumericParams` + `list[MaskedParamDelta]` |
| LLM outputs DSL string | `intent_parsing_proposal.md` §2 tool definition | Replaces `propose_edit` tool with `propose_aesthetic` tool |
| Composition directives trigger SAM | `mask_region_proposal.md` §3.1 | Implicit SAM call; compiler suspends pending `mask_ready` event |
| DSL diff in right panel | `semantic_editor_proposal.md` §3 AI interpretation panel | DSL diff replaces or augments the bar-chart diff display |
| `@extends` and style library | `semantic_editor_proposal.md` §3 style reference tiles | Style tiles are now DSL programs, not opaque param blobs |
| `POST /style` from session | `aesthetic_design_proposal.md` §5c preference learning | User-defined styles are a lightweight form of aesthetic preference capture |

---

## 11. Implementation milestones

**D1 — Grammar + parser**
- Implement the formal grammar as a PEG parser (e.g. `lark` in Python)
- Parse all examples in this document without errors
- Unit test: 20 valid programs, 10 programs with intentional syntax errors (test error messages)

**D2 — Core compiler (tone + mood)**
- Implement `TONE_RESOLVERS` and `MOOD_RESOLVERS`
- `@extends` and `@strength` support
- Output: `NumericParams` delta + `annotations` list
- Unit test: for each tone directive, assert expected param delta within ±5%

**D3 — Region and palette directives**
- `PALETTE_RESOLVERS` and `region` block compilation
- Luminance-based mask selectors (no SAM yet — use `mask_region_proposal.md` §3.4)
- `MaskedParamDelta` output wired into renderer

**D4 — Composition directives + SAM integration**
- `COMPOSITION_RESOLVERS` with implicit SAM mask creation
- Async two-phase compile (render without composition, apply when mask ready)
- `ceiling_hits` annotations for unachievable directives

**D5 — Read-back (params → DSL)**
- Implement `READBACK_RULES` covering all current numeric params
- Wire into diff panel (DSL diff display)
- Wire into `GET /state` response as `dsl_description` field

**D6 — LLM integration**
- Replace `propose_edit` tool with `propose_aesthetic` tool in `intent_parsing_proposal.md`
- Add DSL grammar reference card to LLM system prompt
- Validation: parse LLM output before compilation; inject grammar errors into retry loop
- A/B test: compare param output vs DSL output on 50 intent strings, score by human raters

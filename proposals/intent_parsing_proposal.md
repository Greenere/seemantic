# AI Intent Parsing — Design Proposal

> Companion to `semantic_editor_proposal.md` §M4. Specifies how a natural language
> intent string becomes a validated, confidence-scored param diff committed to state.

---

## 1. Scope

This document covers the pipeline from the moment a user or agent submits an intent string
(e.g. `"warmer shadows, keep highlights clean"`) to the moment a validated `{ params, confidence, warnings }`
object is returned to the caller.

Out of scope:
- How the API receives and routes the request (main proposal)
- How params are rendered to pixels (image_backend_proposal.md)
- Mask/region resolution from semantic labels (mask_region_proposal.md)

---

## 2. Model and API

**Model**: `claude-sonnet-4-6` via the Anthropic API.

Rationale: intent parsing requires nuanced language understanding (compound intent,
implicit references to current state, domain-specific photography vocabulary) and
reliable structured output. Haiku is fast but misses nuance; Opus is overkill for
a single-turn structured extraction task. Sonnet is the right balance.

**Structured output mechanism**: Anthropic tool use (function calling).
The LLM is given a single tool definition `propose_edit` and instructed to call it.
This guarantees a typed, schema-validated response — no JSON parsing fragility.

```python
tools = [{
    "name": "propose_edit",
    "description": "Propose a set of image parameter changes based on the user's intent.",
    "input_schema": {
        "type": "object",
        "properties": {
            "params": {
                "type": "object",
                "description": "Numeric param deltas or absolute values to apply.",
                "additionalProperties": True
            },
            "reasoning": {
                "type": "string",
                "description": "One sentence explaining which params were changed and why."
            },
            "confidence": {
                "type": "number",
                "description": "0–1. How clearly the intent mapped to specific params. "
                               "Use < 0.6 when intent is ambiguous or contradictory."
            },
            "warnings": {
                "type": "array",
                "items": { "type": "string" },
                "description": "List of conflicts or trade-offs the user should know about."
            },
            "sub_intents": {
                "type": "array",
                "description": "If the intent contains multiple distinct directives, split them here.",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": { "type": "string" },
                        "params": { "type": "object" },
                        "region": { "type": "string" }
                    }
                }
            }
        },
        "required": ["params", "reasoning", "confidence", "warnings"]
    }
}]
```

---

## 3. Prompt design

### 3.1 System prompt

```
You are an image editing assistant. Your job is to translate a photographer's natural
language editing intent into precise numeric parameter changes for a photo editor.

You will be given:
1. The current parameter state of the image
2. The photographer's intent string
3. The full parameter schema (valid ranges, what each param controls)

Rules:
- Only output params that should change. Do not repeat params that stay the same.
- Output absolute values, not deltas (e.g. "shadows": 25, not "shadows": +10).
- Stay within schema ranges for every param. Never output an out-of-range value.
- If the intent is relative ("a bit warmer"), interpret it relative to the current value.
- If the intent contains a region qualifier ("warmer in the shadows"), set the region
  field in the relevant sub_intent. Do not apply region-specific edits to global params.
- If the intent would require a trade-off (e.g. lifting shadows will reduce contrast),
  add a warning string explaining it.
- Confidence rules:
    - 0.9+: intent maps cleanly to specific params, no ambiguity
    - 0.7–0.9: reasonable interpretation, minor assumptions made
    - 0.5–0.7: intent is vague or partially contradictory — state your assumption
    - < 0.5: intent is unclear or contradicts locked params — explain in warnings
```

### 3.2 User message

The user message is assembled programmatically each call:

```python
def build_user_message(intent: str, state: SessionState, schema: Schema) -> str:
    return f"""
Intent: "{intent}"

Current parameter state:
{json.dumps(state.params.numeric, indent=2)}

Semantic state (for reference):
{json.dumps(state.params.semantic, indent=2)}

Locked params (do not change these):
{json.dumps(state.constraints.locked_params)}

Full parameter schema:
{json.dumps(schema, indent=2)}
"""
```

Passing current state is critical — "a bit warmer" is meaningless without knowing the
current `color_temp`. Passing locked params prevents the LLM from proposing changes
that would be rejected server-side.

---

## 4. Confidence scoring

The open question from the main proposal is resolved here: **dual-source confidence**.

The LLM self-reports a `confidence` value (0–1) as part of its tool call output.
This is validated and potentially penalized by a server-side rule engine:

```python
def compute_final_confidence(
    llm_confidence: float,
    proposed_params: dict,
    schema: Schema,
    state: SessionState,
) -> tuple[float, list[str]]:
    penalties = []
    warnings = []

    # Penalty: any proposed param is near its schema boundary (may clip)
    for param, value in proposed_params.items():
        bounds = schema.get_bounds(param)
        headroom = min(value - bounds.min, bounds.max - value) / (bounds.max - bounds.min)
        if headroom < 0.05:
            penalties.append(0.1)
            warnings.append(f"{param} is near its limit ({value}); further edits in this direction won't have effect.")

    # Penalty: proposed change is very large (> 60% of range) in a single step
    for param, value in proposed_params.items():
        current = state.params.numeric.get(param, 0)
        param_range = schema.get_bounds(param).max - schema.get_bounds(param).min
        if abs(value - current) / param_range > 0.6:
            penalties.append(0.15)
            warnings.append(f"{param} change is large; consider a dry_run preview first.")

    # Penalty: proposed params conflict with locked_params
    for param in proposed_params:
        if param in state.constraints.locked_params:
            penalties.append(0.5)
            warnings.append(f"{param} is locked and cannot be changed.")

    final = max(0.0, llm_confidence - sum(penalties))
    return final, warnings
```

The final confidence is the LLM's self-reported value minus server-side penalties.
This means the LLM and the rule engine are both checks — neither alone is sufficient.

**Thresholds** (same as main proposal, now grounded here):

| Final confidence | Action |
|---|---|
| ≥ 0.8 | Auto-commit if `dry_run: false` |
| 0.6–0.8 | Commit, but surface reasoning and warnings to UI |
| 0.4–0.6 | Force `dry_run`, show diff to human, require approval |
| < 0.4 | Reject edit, return error with explanation, ask for clarification |

---

## 5. Compound and conflicting intent

"Warmer shadows, keep highlights clean" contains two directives:
1. Increase warmth in the shadow region
2. Protect highlights (a constraint, not a param change)

The LLM splits these into `sub_intents`:

```json
{
  "params": { "shadow_tint": 0.18 },
  "confidence": 0.82,
  "warnings": [],
  "reasoning": "Increased shadow warmth via shadow_tint; highlight_protect flag set.",
  "sub_intents": [
    {
      "description": "warmer shadows",
      "params": { "shadow_tint": 0.18 },
      "region": "shadows"
    },
    {
      "description": "keep highlights clean",
      "params": { "highlight_protect": true },
      "region": "highlights"
    }
  ]
}
```

The server applies `sub_intents` sequentially in order using the same pipeline as
a regular edit. If any sub_intent has confidence < threshold, the entire compound
edit is flagged — not just the failing sub-intent.

**Conflicting intent** (e.g. "make it more dramatic but also softer"):
- The LLM is instructed to detect contradiction and lower confidence accordingly
- It must emit a warning string naming the conflict
- The server does not attempt to resolve the conflict — it surfaces it to the human

---

## 6. Intent modes

`POST /edit` supports three modes depending on what the caller provides:

| Mode | Caller provides | Server behavior |
|---|---|---|
| **Intent-only** | `intent` string, no `params` | Full LLM call; server derives all params |
| **Params-only** | `params` dict, no `intent` | Skip LLM; validate params against schema; confidence = 1.0 |
| **Hybrid** | Both `intent` and `params` | LLM receives both; it uses caller's params as a starting point and fills gaps. Confidence reflects how well they agree. |

Hybrid mode is useful for agents that have partial knowledge: the agent knows
`warmth: 0.72` but wants the LLM to infer what else "golden hour" implies.

---

## 7. Retry logic

```python
MAX_RETRIES = 2

async def parse_intent_with_retry(intent, state, schema) -> ParseResult:
    for attempt in range(MAX_RETRIES + 1):
        result = await call_llm(intent, state, schema)

        # Validate all proposed params are in schema
        invalid = [p for p in result.params if p not in schema.all_params]
        out_of_range = [
            p for p, v in result.params.items()
            if not schema.in_range(p, v)
        ]

        if not invalid and not out_of_range:
            return result

        if attempt < MAX_RETRIES:
            # Inject validation errors into next call as a correction message
            correction = build_correction_message(invalid, out_of_range, schema)
            result = await call_llm_with_correction(intent, state, schema, correction)
        else:
            # Final attempt still invalid — return with confidence = 0 and error
            return ParseResult(
                params={},
                confidence=0.0,
                warnings=[f"Could not map intent to valid params after {MAX_RETRIES + 1} attempts."],
                reasoning="Parsing failed."
            )
```

Correction messages are injected as an assistant/user turn pair, not a new system prompt,
so the LLM sees its own invalid output and the specific validation errors in context.

---

## 8. Latency budget

| Step | Target |
|---|---|
| Build user message | < 1ms |
| LLM API call (Sonnet) | 800ms–2s (network + TTFT) |
| Server-side confidence scoring | < 5ms |
| Total intent-parse latency | < 2.5s p95 |

Intent parsing is inherently async — the UI shows a spinner and receives the result
via WebSocket `state_changed` event when done. The <100ms real-time target applies
only to direct slider/param edits, not LLM-mediated intent.

---

## 9. Dependencies

| Component | Choice |
|---|---|
| LLM | `claude-sonnet-4-6` via `anthropic` Python SDK |
| Structured output | Anthropic tool use (function calling) |
| Validation | Pydantic model mirroring the schema JSON |
| Retry orchestration | `tenacity` for exponential backoff on API errors (rate limits, 529s) |

---

## 10. Implementation milestones

**I1 — LLM call + structured output**
- System prompt + user message assembly
- Tool use call returning `propose_edit`
- Pydantic validation of response
- Unit tests with mocked LLM responses covering: simple intent, compound intent, out-of-range params

**I2 — Confidence scoring + retry**
- Server-side penalty rules (boundary, large change, locked param)
- Retry loop with correction message injection
- Threshold-based auto-commit vs escalation logic

**I3 — Hybrid mode + sub_intent application**
- Params-only fast path (no LLM call)
- Hybrid mode: pass caller params into user message
- Sequential sub_intent application with per-sub_intent dry_run

**I4 — Integration with `/edit` endpoint**
- Wire into `POST /edit` request handler
- Emit `reasoning` and `warnings` in response and via WebSocket diff panel
- End-to-end test: intent string → state mutation → UI diff display

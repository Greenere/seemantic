# Seemantic [under construction]

Seemantic is a semantic image editor prototype designed around a shared editing model for both humans and AI agents. This repository currently contains proposal documents plus an M0 frontend-only editor scaffold built with TypeScript, React, and Vite.

## Current Scope

The current implementation is intentionally limited to a frontend prototype:

- Three-column semantic editor layout
- Mocked branch history and variant selection
- Semantic and numeric control panels
- Prompt input and AI diff inspection surface
- Shared editor state wired through a modular React structure

There is no backend, rendering pipeline, or real image-editing engine connected yet.

## Repository Layout

```text
.
├── frontend/               # Frontend application workspace
├── proposals/              # Product and architecture proposals
└── README.md
```

Frontend-specific setup, commands, and structure live in [frontend/README.md](./frontend/README.md).

## M0 Goals

This M0 is meant to establish:

- A clean frontend project structure
- A modular editor UI aligned with the proposal
- A shared state model that can later connect to agent and backend APIs
- A safe place to iterate on interaction design before implementing rendering

## Related Proposals

- [Semantic Editor Proposal](./proposals/semantic_editor_proposal.md)
- [Seemantic Frontend Proposal](./proposals/seemantic_frontend_proposal.md)
- [Aesthetic DSL Proposal](./proposals/aesthetic_dsl_proposal.md)

## Next Likely Steps

- Connect the UI to a real session/state model
- Add routing or workspace/session boundaries if needed
- Introduce design tokens and reusable component patterns
- Wire prompt actions and branches to real editing behavior
- Add tests and linting once the interaction model settles

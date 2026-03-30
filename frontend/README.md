# Frontend

This folder contains the M0 frontend-only prototype for the Seemantic editor. It is built with TypeScript, React, and Vite, and is organized around a modular editor shell that mirrors the semantic editor proposal.

## Tech Stack

- TypeScript
- React
- Vite

## App Structure

```text
frontend/
├── src/
│   ├── app/                # App bootstrap and global styles
│   ├── domain/             # Editor types, config, and mock data
│   ├── features/           # Major UI feature areas
│   ├── shared/             # Reusable UI building blocks
│   └── state/              # Shared editor state store
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Setup

Install dependencies, including the local Vite dependency declared in `package.json`:

```bash
npm install
```

If you specifically want a global Vite install on your machine, you can also run:

```bash
npm install -g vite
```

For this project, the local `npm install` is the recommended approach.

## Development

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Current M0 Scope

- Three-column semantic editor layout
- Mocked branch history and variant selection
- Semantic and numeric control panels
- Prompt input and AI diff inspection surface
- Shared editor state wired through a modular React structure

There is no backend, rendering pipeline, or real image-editing engine connected yet.

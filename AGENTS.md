# Agent Guidelines for Ski Tripper

## Project Overview

React + Appwrite ski trip management. JavaScript only (no TypeScript). Bun for package management, bundling, and dev server.

## Package Manager

Use **Bun**: `bun install`, `bun run dev`, `bun run build`, `bun run test`

## Build/Lint/Test Commands

```bash
bun run dev          # Dev server (watch + API)
bun run build        # Production build
bun run preview      # Preview production build
bun run test         # Run all tests
bun run test src/Field.test.jsx --test-name-pattern="renders the label"  # Single test
bun run lint         # StandardJS (auto-fixes)
bun run format       # Prettier
```

## File-Scoped Commands

| Task      | Command                              |
| --------- | ------------------------------------ |
| Test file | `bun run test path/to/file.test.jsx` |
| Lint file | `bun run lint path/to/file.jsx`      |

## Commit Attribution

AI commits MUST include:

```
Co-Authored-By: (agent name and attribution byline)
```

## Code Style

- No TypeScript, no CSS modules
- One global CSS file (`src/index.css`) — all component styles inline JS objects
- No semicolons, ESM imports only
- 2-space indent, single quotes, trailing commas
- Styles as `const [name]Styles` objects at bottom of file
- Shared styles in `src/theme.js`: `colors`, `fonts`, `borders`, `formStyles`, `authStyles`, `fieldStyles`

## Components

- One component per file, filename matches component name, default export only
- Functional components with hooks only
- Destructure props in signature: `function App({ accountGet = _account.get.bind(_account) })`
- No Context API, Redux, Zustand — data flows via callback props (`onCreated`, etc.)
- Let errors propagate — catch at ErrorBoundary

## Appwrite

- Frontend env vars: `PUBLIC_APPWRITE_*` (exposed to browser)
- Admin env vars: `APPWRITE_API_KEY` (server-side only)
- Never import Appwrite client directly in components — use helpers from `backend.js`
- Database helpers listed in `src/backend.js`

## Testing

- Bun test runner + React Testing Library + `@testing-library/user-event`
- Test files: `ComponentName.test.jsx` alongside `ComponentName.jsx`
- `import { describe, it, expect, mock } from 'bun:test'`
- Use `@testing-library/jest-dom` matchers
- happy-dom globals in `src/test-setup.js`
- Prefer dependency injection over mocks

## File Structure

See `src/` directory. Key files: `main.jsx`, `App.jsx`, `backend.js`, `theme.js`

## DO NOT

- Use TypeScript or CSS files/modules
- Use external state management (Redux, Zustand, etc.)
- Add server-side rendering or API routes
- Import Appwrite client directly in components
- Use `console.error` — throw errors instead

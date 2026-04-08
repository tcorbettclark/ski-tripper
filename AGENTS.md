# Agent Guidelines for Ski Tripper

## Package Manager

Use **Bun**: `bun install`, `bun run dev`, `bun run build`, `bun run test`

## File-Scoped Commands

| Task | Command |
|------|---------|
| Lint | `bun run lint path.to/file.ts` |
| Test | `bun run test path/to/file.test.ts` |

## Code Style

- TypeScript with strict mode
- Styles as `const [name]Styles` objects at bottom of file
- Shared styles in `src/theme.ts`
- Use camelCase for names (NOT PascalCase)

## Components

- One component per file, filename matches component name, default export only
- Functional components with hooks only
- No Context API, Redux, Zustand — data flows via callback props (`onCreated`, etc.)
- Let errors propagate — catch at ErrorBoundary

## Appwrite

- Frontend env vars: `PUBLIC_APPWRITE_*` (exposed to browser)
- Admin env vars: `APPWRITE_API_KEY` (server-side only)
- Never import Appwrite client directly in components — use helpers from `src/backend.ts`

## Testing

- Bun test runner + React Testing Library + `@testing-library/user-event`
- Test files: `ComponentName.test.tsx` alongside `ComponentName.tsx`
- `import { describe, it, expect, mock } from 'bun:test'`
- Use built-in Bun test matchers (`toBeNull`, `toHaveAttribute`, etc.)
- happy-dom globals in `src/test-setup.ts`

## DO NOT

- Use CSS files/modules
- Use external state management (Redux, Zustand, etc.)
- Add server-side rendering or API routes
- Import Appwrite client directly in components
- Use `console.error` — throw errors instead

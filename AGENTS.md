# Agent Guidelines for Ski Tripper

## General

Agree simple "done criteria" up-front.

Long-term quality over speed. Small steps compound into big and sustainable progress.

Keep changes small and focussed:
- One logical change per commit
- If a task feels too large, break it into subtasks and track progress with todo tool
- Prefer multiple small commits over one large commit
- Run ALL feedback loops after each change, not at the end

Before committing, check "done criteria" satisfiedand run ALL feedback loops:

| Task                   | Command                               |
| ---------------------- | ------------------------------------- |
| Linting and formatting | `bun run check <path.to/file.ts>`     |
| Type checking          | `bun run typecheck <path.to/file.ts>` |
| Testing                | `bun run test <path.to/file.test.ts>` |

Without a file path, these commands run on the entire project.

If any fail, fix issues first before committing.

## Package Manager

Use **Bun**: `bun install`, `bun run dev`, `bun run build`, `bun run test`

## Code Style

- TypeScript with strict mode
- Error handling: React ErrorBoundary only catches synchronous render-phase errors, so async event handlers **must** catch errors and show an inline actionable message. Use `try/catch/finally` — reset loading states in `finally`, set error state in `catch`. Display errors using `formStyles.error` from `src/theme.ts`. Never swallow errors silently (`.catch(() => {})`).
- Styles as `const [name]Styles` objects at bottom of file
- Shared styles in `src/theme.ts`
- Use camelCase for names (NOT PascalCase)

## Components

- One component per file, filename matches component name, default export only
- Functional components with hooks only
- No Context API, Redux, Zustand — data flows via callback props (`onCreated`, etc.)
- Async event handlers must catch errors and display inline messages — ErrorBoundary cannot catch async errors

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
- `render()` is async and must be awaited in asynchronous tests. For components with async `useEffect` that sets state, wrap `render()` in `act()` to flush React's update queue before `waitFor`. Without this, `waitFor` polls repeatedly waiting for state to settle (slow tests).

## DO NOT

- Use CSS files/modules
- Use external state management (Redux, Zustand, etc.)
- Add server-side rendering or API routes
- Import Appwrite client directly in components
- Use `console.error` — throw errors instead

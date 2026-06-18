# Agent Guidelines for Ski Tripper

## General

Transform tasks into verifiable success criteria.

Use TDD unless trivial.

Before making changes:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

Keep changes small and focussed:
- One logical change per commit
- If a task feels too large, break it into subtasks and track progress with todo tool
- Prefer multiple small commits over one large commit
- Run ALL feedback loops after each change, not at the end

## Feedback Loops

Check for and try to fix type issues, linting, formatting, and import sorting: `bun run check-and-fix <path.to/file.ts>`

Testing: `bun run test <path.to/file.test.ts>`

Without a file path, these commands run on the entire project.

## Code Style

- TypeScript with strict mode
- Styles as `const [name]Styles` objects at bottom of file
- Shared styles in `src/theme.ts`
- Use PascalCase for React components and camelCase for all other names.

## Components

- One component per file, filename matches component name, default export only
- No Context API, Redux, Zustand — data flows via callback props (`onCreated`, etc.)
- Do not add server-side rendering or API routes

## Error Handling 

- Throw errors instead of `console.error`
- React ErrorBoundary only catches synchronous render-phase errors, so async event handlers **must** catch errors and show an inline actionable message.
- Use `try/catch/finally` — reset loading states in `finally`, set error state in `catch`.
- Display errors using `formStyles.error` from `src/theme.ts`.
- Never swallow errors silently (`.catch(() => {})`).

## Environment Variables

- Frontend env vars exposed to the browser have the `PUBLIC_` prefix.
- Server-side admin env vars have no `PUBLIC_` prefix, e.g. `POCKETBASE_ADMIN_EMAIL`

## Testing

- Bun test runner + React Testing Library + `@testing-library/user-event`
- Test files: `ComponentName.test.tsx` alongside `ComponentName.tsx`
- `import { describe, it, expect, mock } from 'bun:test'`
- Use built-in Bun test matchers (`toBeNull`, `toHaveAttribute`, etc.)
- happy-dom globals in `src/test-setup.ts`
- Wrap render() in act() for components with async effects.
- Test responsive behaviour by mocking `src/useIsSmallScreen.ts` (never set window innerWidth property as fragile).

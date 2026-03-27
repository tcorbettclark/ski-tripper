# Agent Guidelines for Ski Tripper

## Project Overview

A React + Appwrite ski trip management web app for trip proposals and voting. Uses Bun as package manager, bundler, and dev server. JavaScript only (no TypeScript).

## Build/Lint/Test Commands

```bash
# Install dependencies
bun install

# Start development server (watch mode + API server)
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run a single test file
bun run test src/Field.test.jsx

# Run a single test by name
bun run test src/Field.test.jsx --test-name-pattern="renders the label"

# Lint (StandardJS — auto-fixes)
bun run lint

# Format (Prettier)
bun run format
```

## Code Style Guidelines

### General

- **JavaScript only** — no TypeScript, no CSS modules
- **One global CSS file** (`src/index.css`) for resets and Google Fonts import only — all component styles are inline JS objects
- **No semicolons** — StandardJS enforced
- **ESM imports** — use `import`/`export` exclusively

### Formatting

- 2-space indentation
- Single quotes for strings
- Trailing commas in multiline imports/objects
- Max line length: 100 characters (StandardJS default)
- Run `bun run lint` and `bun run format` before committing

### Imports

```javascript
// Group by: React → third-party → local, no empty lines between groups
import { useEffect, useState, useCallback } from "react";
import { account as _account } from "./backend";
import AuthForm from "./AuthForm";
import { colors, fonts, borders } from "./theme";
```

### Components

- One component per file, filename matches component name
- Default export only
- Use functional components with hooks
- Destructure props in function signature: `function App({ accountGet = _account.get })`
- Component-specific styles defined as a `const [name]Styles` object at the bottom of the file

### Styling Pattern

```javascript
const headerStyles = {
  bar: { display: "flex", padding: "0 48px" },
  title: { fontSize: "22px", fontWeight: "600" },
};

return (
  <header style={headerStyles.bar}>
    <span style={headerStyles.title}>Title</span>
  </header>
);
```

Shared styles live in `src/theme.js`:

- `colors` — palette (accent: `#3bbde8`, bgPrimary: `#07111f`, error: `#ff6b6b`, etc.)
- `fonts` — body, display, mono
- `borders` — subtle, card, muted, accent
- `formStyles`, `authStyles`, `fieldStyles` — reusable component style objects

### State Management

- React hooks only (`useState`, `useEffect`, `useCallback`, `useMemo`)
- No Context API, Redux, Zustand, or external state libraries
- Data flows via callback props (`onCreated`, `onUpdated`, `onDeleted`)
- Use `useCallback` for stable callback references in `useEffect` deps

### Error Handling

- Let errors propagate — catch at component boundary (ErrorBoundary component)
- Throwing strings is acceptable for simple validation errors
- Backend functions throw descriptive Error objects for auth/permission failures
- Appwrite errors should be caught and re-thrown with user-friendly messages

### Naming Conventions

| Thing         | Convention                  | Example                      |
| ------------- | --------------------------- | ---------------------------- |
| Components    | PascalCase                  | `CreateTripForm`             |
| Files         | Match component             | `CreateTripForm.jsx`         |
| Functions     | camelCase                   | `createTrip`, `listTrips`    |
| Constants     | camelCase                   | `DATABASE_ID` (module-level) |
| Style objects | camelCase + `Styles` suffix | `headerStyles`, `formStyles` |
| CSS vars      | N/A (no CSS)                | —                            |

### Appwrite Conventions

- Environment variables for client config:
  - `PUBLIC_APPWRITE_ENDPOINT`, `PUBLIC_APPWRITE_PROJECT_ID`, `PUBLIC_APPWRITE_DATABASE_ID`
  - `PUBLIC_APPWRITE_TRIPS_COLLECTION_ID`, `PUBLIC_APPWRITE_PARTICIPANTS_COLLECTION_ID`, `PUBLIC_APPWRITE_PROPOSALS_COLLECTION_ID`, `PUBLIC_APPWRITE_POLLS_COLLECTION_ID`, `PUBLIC_APPWRITE_VOTES_COLLECTION_ID`
  - `PUBLIC_APPWRITE_READ_USERS_API_KEY` (read-only, intentionally exposed)
- Server-side admin operations use `APPWRITE_API_KEY` (not prefixed)
- Frontend vars must use `PUBLIC_` prefix (Bun's `--env 'PUBLIC_*'` flag exposes them)
- Document-level permissions per user (read/write scoped to `userId`)
- Database helpers: `listTrips`, `getTrip`, `getTripByCode`, `createTrip`, `updateTrip`, `deleteTrip`, `joinTrip`, `leaveTrip`, `listParticipatedTrips`, `getCoordinatorParticipant`, `getUserById`, `createProposal`, `listProposals`, `getProposal`, `updateProposal`, `deleteProposal`, `submitProposal`, `rejectProposal`, `createPoll`, `closePoll`, `listPolls`, `upsertVote`, `listVotes`

### Testing

- Use Bun's test runner + React Testing Library (`@testing-library/react`)
- Test file naming: `ComponentName.test.jsx` alongside `ComponentName.jsx`
- Use `render*` helper with default no-op props, override only what's tested
- `import { describe, it, expect, mock } from 'bun:test'`
- Use `@testing-library/user-event` for user interactions
- Use `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveValue`, etc.)
- happy-dom globals registered in `src/test-setup.js`
- prefer dependency injection over mocks

### File Structure

```
src/
  main.jsx              # Entry point
  App.jsx               # Root: auth flow, routing
  backend.js            # Appwrite client + all DB helpers
  theme.js              # Shared style constants
  index.css             # Global reset + Google Fonts import only
  test-setup.js         # Jest-dom matchers + happy-dom setup
  randomProposal.js     # Static list of random proposal data
  AuthForm.jsx          # Combined login/signup
  Header.jsx            # App header with navigation
  Trips.jsx             # Trip list container
  TripOverview.jsx      # Trip detail/overview view
  CreateTripForm.jsx
  EditTripForm.jsx
  TripTable.jsx
  TripRow.jsx
  JoinTripForm.jsx
  Proposals.jsx
  ProposalsTable.jsx
  ProposalsRow.jsx
  ProposalViewer.jsx
  CreateProposalForm.jsx
  EditProposalForm.jsx
  Poll.jsx              # Poll container (list/vote/results)
  PollVoting.jsx        # Stepper-based vote UI
  PollResults.jsx       # Poll results display
  Field.jsx             # Reusable form field
  ErrorBoundary.jsx
  [*.test.jsx]          # Tests alongside source files
```

### DO NOT

- Use TypeScript
- Add CSS files or CSS modules
- Use external state management (Redux, Zustand, etc.)
- Add server-side rendering or API routes
- Import Appwrite client directly in components — use helpers from `backend.js`
- Use `console.error` for errors — throw instead

---
date: 2026-03-30
topic: typescript-migration
status: validated
---

## Problem Statement

The project is pure JavaScript with no type safety. As the codebase grows, this leads to:

- Runtime errors from typos or incorrect data shapes
- No IDE autocompletion for props, function params, or return types
- Difficulty refactoring safely

## Constraints

- **Bun is the package manager** — Bun has built-in TypeScript support, no extra transpilation needed
- **JavaScript files become `.tsx`/`.ts`** — React components use `.tsx`, helpers use `.ts`
- **No TypeScript errors allowed** — strict mode for maximum safety
- **Keep existing patterns** — inline styles, no Context API, callback props for data flow

## Approach

**Gradual migration** — rename files and add types incrementally:

1. Add TypeScript config and dependencies
2. Create type definitions file (`src/types.ts`) with all interfaces
3. Rename files systematically (`.js` → `.ts`, `.jsx` → `.tsx`)
4. Add type annotations to components and backend

This avoids a big-bang rewrite and validates as we go.

## Architecture

### New File: `src/types.ts`

All domain interfaces centralized:

```typescript
// Appwrite document wrapper
interface AppwriteDocument {
  $id: string;
  $createdAt: string;
  $updatedAt?: string;
}

// Core entities
interface Trip extends AppwriteDocument {
  code: string;
  description: string;
}

interface Participant extends AppwriteDocument {
  ParticipantUserId: string;
  ParticipantUserName: string;
  tripId: string;
  role: "coordinator" | "participant";
}

interface Proposal extends AppwriteDocument {
  tripId: string;
  ProposerUserId: string;
  ProposerUserName: string;
  state: "DRAFT" | "SUBMITTED" | "REJECTED";
  resortName: string;
  country: string;
  altitudeRange: string;
  nearestAirport: string;
  transferTime: string;
  accommodationName: string;
  accommodationUrl?: string;
  approximateCost: string;
  description: string;
}

interface Poll extends AppwriteDocument {
  tripId: string;
  PollCreatorUserId: string;
  PollCreatorUserName: string;
  state: "OPEN" | "CLOSED";
  proposalIds: string[];
}

interface Vote extends AppwriteDocument {
  pollId: string;
  tripId: string;
  VoterUserId: string;
  proposalIds: string[];
  tokenCounts: number[];
}

interface User {
  $id: string;
  name: string;
  email: string;
}

// List response wrapper
interface DocumentList<T> {
  documents: T[];
}
```

### Component Props Pattern

Each component gets its own interface named `[ComponentName]Props`:

```typescript
// Example: Field.tsx
interface FieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  variant?: "default" | "auth";
}
```

### Backend Function Types

The `backend.ts` exports typed function signatures.

## File Changes

| File                         | Change                                   |
| ---------------------------- | ---------------------------------------- |
| `tsconfig.json`              | New — strict mode, JSX support           |
| `src/types.ts`               | New — all interfaces                     |
| `src/backend.ts`             | Rename from `.js` + add types            |
| `src/theme.ts`               | Rename from `.js` + add types            |
| `src/main.tsx`               | Rename from `.jsx`                       |
| `src/App.tsx`                | Rename from `.jsx` + add props interface |
| `src/ErrorBoundary.tsx`      | Rename from `.jsx` + add types           |
| `src/Field.tsx`              | Rename from `.jsx` + add props interface |
| `src/AuthForm.tsx`           | Rename + add props interface             |
| `src/Header.tsx`             | Rename + add props interface             |
| `src/Trips.tsx`              | Rename + add props interface             |
| `src/TripTable.tsx`          | Rename + add props interface             |
| `src/TripRow.tsx`            | Rename + add props interface             |
| `src/TripOverview.tsx`       | Rename + add props interface             |
| `src/CreateTripForm.tsx`     | Rename + add props interface             |
| `src/JoinTripForm.tsx`       | Rename + add props interface             |
| `src/EditTripForm.tsx`       | Rename + add props interface             |
| `src/ParticipantList.tsx`    | Rename + add props interface             |
| `src/Proposals.tsx`          | Rename + add props interface             |
| `src/ProposalsTable.tsx`     | Rename + add props interface             |
| `src/ProposalsRow.tsx`       | Rename + add props interface             |
| `src/CreateProposalForm.tsx` | Rename + add props interface             |
| `src/EditProposalForm.tsx`   | Rename + add props interface             |
| `src/ProposalViewer.tsx`     | Rename + add props interface             |
| `src/Poll.tsx`               | Rename + add props interface             |
| `src/PollVoting.tsx`         | Rename + add props interface             |
| `src/PollResults.tsx`        | Rename + add props interface             |
| `src/randomProposal.ts`      | Rename from `.js`                        |
| Test files                   | Keep `.test.jsx` extension               |

## Data Flow

```
src/types.ts (interfaces)
       ↓
       ├──→ Components (import Props interfaces)
       ├──→ backend.ts (import entity interfaces)
       └──→ App.tsx (wires everything together)
```

## Error Handling Strategy

- TypeScript catches type errors at compile time
- Runtime errors still propagate to ErrorBoundary
- Components validate props with TypeScript — no prop-types runtime needed

## Testing Strategy

- Test files remain `*.test.jsx` — Bun test runner handles JSX natively
- No changes to test infrastructure needed
- Types verified during development, not in tests

## Open Questions

1. Should we keep the `.test.jsx` extension or rename to `.test.tsx`? — Keep as `.test.jsx` since tests don't need type checking and changing all of them adds noise without benefit.

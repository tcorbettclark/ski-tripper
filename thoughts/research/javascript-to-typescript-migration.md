---
date: 2026-03-30T12:34:49+01:00
git_commit: 5ff49d6f2e1ce2757d382c9260f7053264f16407
branch: clean-try-agentic-on-typescript-migration
repository: ski-tripper
topic: "JavaScript to TypeScript Migration with Biome"
tags: [research, codebase, typescript, biome, migration, refactor]
last_updated: 2026-03-30
---

## Ticket Synopsis

Migrate the entire codebase from JavaScript to TypeScript to benefit from type safety, clearly defined interfaces, better linting, and AST searching for agentic programming. Additionally, replace StandardJS and Prettier with Biome (a combined linting and formatting tool).

**Requirements:**

- No JavaScript remaining (all .js/.jsx → .ts/.tsx)
- Updated and passing tests
- No StandardJS and no Prettier; replaced by Biome

## Summary

The codebase is a React + Appwrite ski trip management application using **JavaScript only** (no TypeScript), **Bun** for package management, and **StandardJS + Prettier** for linting/formatting. The migration involves:

1. **Converting 48 files** from .js/.jsx to .ts/.tsx (22 components + 5 non-component .js files + 21 test files)
2. **Installing TypeScript** and type definitions (@types/react, @types/react-dom, etc.)
3. **Configuring Biome** to replace StandardJS and Prettier
4. **Adding type definitions** for Appwrite SDK, threewords, and happy-dom

Key architectural patterns to preserve:

- Dependency injection via default parameters (for testability)
- Inline style objects (no CSS modules)
- Shared styles in `theme.js`
- Default exports only
- Class-based ErrorBoundary

## Detailed Findings

### 1. File Inventory

**Component Files (22 `.jsx` → `.tsx`):**

| Component                | Test File                     | Purpose                                  |
| ------------------------ | ----------------------------- | ---------------------------------------- |
| `App.jsx`                | `App.test.jsx`                | Root component with auth routing         |
| `AuthForm.jsx`           | `AuthForm.test.jsx`           | Login/signup form                        |
| `CreateProposalForm.jsx` | `CreateProposalForm.test.jsx` | New proposal form                        |
| `CreateTripForm.jsx`     | `CreateTripForm.test.jsx`     | New trip form                            |
| `EditProposalForm.jsx`   | `EditProposalForm.test.jsx`   | Edit proposal form                       |
| `EditTripForm.jsx`       | `EditTripForm.test.jsx`       | Edit trip form                           |
| `ErrorBoundary.jsx`      | —                             | Error catching wrapper (class component) |
| `Field.jsx`              | `Field.test.jsx`              | Reusable form field                      |
| `Header.jsx`             | —                             | Navigation header                        |
| `JoinTripForm.jsx`       | `JoinTripForm.test.jsx`       | Join trip by code                        |
| `ParticipantList.jsx`    | `ParticipantList.test.jsx`    | Trip participants list                   |
| `Poll.jsx`               | `Poll.test.jsx`               | Poll voting                              |
| `PollResults.jsx`        | `PollResults.test.jsx`        | Poll results display                     |
| `PollVoting.jsx`         | `PollVoting.test.jsx`         | Poll voting component                    |
| `ProposalViewer.jsx`     | `ProposalViewer.test.jsx`     | Single proposal view                     |
| `Proposals.jsx`          | `Proposals.test.jsx`          | Proposals container                      |
| `ProposalsRow.jsx`       | `ProposalsRow.test.jsx`       | Single proposal row                      |
| `ProposalsTable.jsx`     | `ProposalsTable.test.jsx`     | Proposals table                          |
| `TripOverview.jsx`       | `TripOverview.test.jsx`       | Trip detail view                         |
| `TripRow.jsx`            | `TripRow.test.jsx`            | Single trip row                          |
| `TripTable.jsx`          | `TripTable.test.jsx`          | Trips table                              |
| `Trips.jsx`              | `Trips.test.jsx`              | Trips list container                     |

**Non-Component JS Files (5 → .ts):**

| File                | Purpose                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| `backend.js`        | Appwrite database helpers (363 lines)                                       |
| `backend.test.js`   | Tests for backend helpers                                                   |
| `theme.js`          | Shared styles (colors, fonts, borders, formStyles, authStyles, fieldStyles) |
| `randomProposal.js` | Random proposal generation utility                                          |
| `test-setup.js`     | Test configuration (happy-dom globals)                                      |

**Entry Point:**
| File | Purpose |
|------|---------|
| `main.jsx` | React app entry point |

**Total: 49 files to convert**

### 2. Component Patterns to Preserve in TypeScript

#### Dependency Injection via Default Parameters

**Pattern:** Components receive dependencies as default parameters in the function signature.

**App.jsx:31-41:**

```javascript
function App ({
  accountGet = defaultAccountGet,
  deleteSession = defaultDeleteSession,
  listTrips = defaultListTrips,
  listParticipatedTrips = defaultListParticipatedTrips,
  listTripParticipants = defaultListTripParticipants,
  updateTrip = defaultUpdateTrip,
  deleteTrip = defaultDeleteTrip,
  leaveTrip = defaultLeaveTrip,
  getCoordinatorParticipant = defaultGetCoordinatorParticipant
}) {
```

**Default binding (App.jsx:21-29):**

```javascript
const defaultAccountGet = _account.get.bind(_account);
const defaultDeleteSession = _account.deleteSession.bind(_account, "current");
const defaultListTrips = _listTrips.bind(_listTrips);
```

**In TypeScript:** These patterns work well with typed function parameters. Dependencies should be typed as function types.

#### Inline Style Objects

All styles are defined as `const [Name]Styles` objects at the bottom of files using theme.js tokens.

**ErrorBoundary.jsx:35-70:**

```javascript
const styles = {
  container: {
    padding: "80px 48px",
    maxWidth: "960px",
    margin: "0 auto",
    fontFamily: fonts.body,
    textAlign: "center",
  },
  emoji: { fontSize: "48px", margin: "0 0 16px" },
  // ...
};
```

**In TypeScript:** Style objects can use `React.CSSProperties` type for type safety.

#### Theme Usage

**theme.js** exports named constants: `colors`, `fonts`, `borders`, `formStyles`, `authStyles`, `fieldStyles`.

**In TypeScript:** These can be typed with interfaces or inline type annotations.

#### Default Exports Only

Per convention, each file has a single default export.

**In TypeScript:** Component functions will be `export default function ComponentName(...)` with explicit return types where needed.

### 3. Key Types Needed

#### Appwrite Types

The `backend.js` uses Appwrite SDK types:

- `Client`, `Account`, `Databases` - from `appwrite` package
- Document types returned from queries (TRIPS, PARTICIPANTS, PROPOSALS, POLLS, VOTES collections)

**Existing document structure (backend.js:22-27):**

```javascript
const DATABASE_ID = process.env.PUBLIC_APPWRITE_DATABASE_ID;
const TRIPS_COLLECTION_ID = process.env.PUBLIC_APPWRITE_TRIPS_COLLECTION_ID;
const PARTICIPANTS_COLLECTION_ID =
  process.env.PUBLIC_APPWRITE_PARTICIPANTS_COLLECTION_ID;
const PROPOSALS_COLLECTION_ID =
  process.env.PUBLIC_APPWRITE_PROPOSALS_COLLECTION_ID;
const POLLS_COLLECTION_ID = process.env.PUBLIC_APPWRITE_POLLS_COLLECTION_ID;
const VOTES_COLLECTION_ID = process.env.PUBLIC_APPWRITE_VOTES_COLLECTION_ID;
```

**In TypeScript:** Need interfaces for:

- Trip document
- Participant document (with ParticipantUserId, ParticipantUserName, tripId, role)
- Proposal document (with ProposerUserId, ProposerUserName, tripId, state)
- Poll document (with PollCreatorUserId, PollCreatorUserName, state, proposalIds)
- Vote document (with VoterUserId, pollId, proposalIds, tokenCounts)

#### React Types

- `React.Component` - for ErrorBoundary (class component)
- `React.CSSProperties` - for inline styles
- `React.FormEvent` - for form handlers
- `React.ChangeEvent` - for input changes
- Hook types: `useState`, `useEffect`, `useCallback`

#### App Types

User object from Appwrite account:

```javascript
// AuthForm.jsx usage
const user = await accountGet();
// user has: $id, name, email
```

### 4. Test Patterns

**Dependency injection for tests (App.test.jsx:10-19):**

```javascript
function renderApp(props = {}) {
  return render(
    <App
      accountGet={() => Promise.resolve(defaultUser)}
      deleteSession={() => Promise.resolve()}
      listTrips={() => Promise.resolve({ documents: [] })}
      {...props}
    />,
  );
}
```

**Mock factory pattern (backend.test.js:26-35):**

```javascript
function makeDb(overrides = {}) {
  return {
    listDocuments: mock(() => Promise.resolve({ documents: [] })),
    createDocument: mock(() =>
      Promise.resolve({ $id: "new-id", name: "New Trip" }),
    ),
    // ...
  };
}
```

**In TypeScript:** Tests will need:

- Typed mock functions
- Interface for mock database
- Proper typing of render props

### 5. Configuration Changes Required

#### package.json Changes

**Remove:**

- `standard` (StandardJS)
- `prettier`

**Add:**

- `typescript`
- `@types/react`
- `@types/react-dom`
- `@types/node` (for process.env typing)
- biome (replaces both lint and format)

**Update scripts:**

```json
{
  "scripts": {
    "lint": "biome lint --write .",
    "format": "biome format --write ."
  }
}
```

**Update lint-staged:**

```json
{
  "lint-staged": {
    "*.{ts,tsx}": "biome lint --write --ignore .agents"
  }
}
```

#### New Files Needed

1. `tsconfig.json` - TypeScript configuration
2. `biome.json` - Biome configuration (replaces .prettierrc, .eslintrc, etc.)

### 6. Migration Order Recommendation

1. **Phase 1:** Set up TypeScript
   - Install TypeScript and type dependencies
   - Create `tsconfig.json`
   - Configure build tool for TypeScript

2. **Phase 2:** Set up Biome
   - Install Biome
   - Create `biome.json`
   - Remove StandardJS and Prettier
   - Update package.json scripts

3. **Phase 3:** Convert non-component JS files
   - `theme.js` → `theme.ts` (no dependencies, pure exports)
   - `randomProposal.js` → `randomProposal.ts`
   - `backend.js` → `backend.ts` (most critical types)
   - `test-setup.js` → `test-setup.ts`

4. **Phase 4:** Convert components
   - Start with `ErrorBoundary.jsx` (class component, simpler types)
   - Then `Field.jsx` (simple, used widely)
   - Then `Header.jsx` (no props)
   - Work through forms, then tables, then containers
   - End with `App.jsx` (most complex)

5. **Phase 5:** Convert test files
   - Convert in same order as components
   - Update mock types and render helpers

## Code References

### Components with Dependency Injection

- `src/App.jsx:21-41` - Default bindings and props
- `src/AuthForm.jsx:11-14` - Auth dependencies
- `src/TripOverview.jsx` - Trip detail with multiple deps
- `src/Proposals.jsx` - Proposals container

### Inline Style Patterns

- `src/ErrorBoundary.jsx:35-70` - Styles object pattern
- `src/theme.js:1-179` - Theme exports
- `src/Field.jsx:13` - Variant styles from theme

### Test Patterns

- `src/App.test.jsx:10-19` - renderApp helper with DI
- `src/backend.test.js:26-35` - makeDb factory
- `src/test-setup.js:1-18` - Happy-dom setup

### Backend API Functions (backend.js)

- `getCoordinatorParticipant` (line 29)
- `listTripParticipants` (line 37)
- `listTrips` (line 45)
- `createTrip` (line 96)
- `joinTrip` (line 160)
- `createProposal` (line 200)
- `createPoll` (line 260)
- `upsertVote` (line 316)

## Architecture Insights

### Strengths of Current Architecture

1. **Dependency injection via default params** - Excellent for testing, should be preserved
2. **Inline styles with theme tokens** - Consistent design system, easy to type
3. **Small, focused components** - Easier to migrate incrementally
4. **Centralized backend helpers** - Single place for Appwrite calls, typed interfaces will help
5. **Co-located tests** - Easy to maintain 1:1 mapping during migration

### TypeScript Migration Benefits

1. **Appwrite document types** - Explicit interfaces for all collection documents
2. **Component prop types** - Catch mismatches at compile time
3. **Form event types** - `React.FormEvent<HTMLFormElement>` etc.
4. **Hook generic types** - `useState<User | null>` etc.
5. **Backend function signatures** - Explicit parameter and return types

### Potential Challenges

1. **ErrorBoundary is a class component** - `React.Component` typing is different
2. **Dynamic style properties** - Some style objects may have string/number unions
3. **Mock function types** - bun:test `mock()` needs compatible typing approach
4. **process.env in theme.js** - Needs TypeScript environment typing

## Historical Context (from thoughts/)

- `thoughts/tickets/refactor-2.md` - This ticket (status: empty)
- `thoughts/research/2026-03-28_refactor-remove-getUserById-calls.md` - Related refactor research showing component patterns

## Related Research

- `thoughts/research/2026-03-28_refactor-remove-getUserById-calls.md` - Contains detailed component analysis and prop patterns

## Open Questions

1. Should Appwrite SDK types be used/extended or custom interfaces created? - Use Appwrite SDK types, extending if needed.
2. Should ErrorBoundary remain a class component in TypeScript (works fine) or be converted? - Remain a class component.
3. How to handle `@testing-library/user-event` typing? - ??
4. Should `threewords` package have TypeScript types or should local types be created? - Use types from threewords package if they exist, otherwise create local types.
5. Should `process.env.PUBLIC_*` have runtime type validation added? - No

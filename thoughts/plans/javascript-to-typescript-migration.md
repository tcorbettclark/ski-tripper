# JavaScript to TypeScript Migration with Biome

## Overview

Migrate the entire codebase from JavaScript to TypeScript and replace StandardJS + Prettier with Biome. This enables type safety, better linting, and improved AST searching for agentic programming.

## Current State Analysis

**Existing Stack:**

- JavaScript only (no TypeScript) in 49 files (43 `.jsx` + 5 `.js` + 1 `main.jsx`)
- StandardJS for linting, Prettier for formatting
- Bun for package management, bundling, and testing
- React 18 + Appwrite SDK

**What's Missing:**

- No `tsconfig.json`
- No TypeScript type definitions
- No Biome configuration

**Key Constraints Discovered:**

- Dependency injection via default parameters (must preserve for testability)
- Inline style objects using `React.CSSProperties`
- Class-based ErrorBoundary (remains as class in TypeScript)
- Default exports only per component

## Desired End State

- All source files use `.ts`/`.tsx` extensions
- TypeScript type checking passes with no errors
- Biome replaces StandardJS and Prettier for linting and formatting
- All existing tests pass
- No JavaScript files remain in `src/`

### Key Discoveries:

- **Dependency injection pattern** (`src/App.jsx:21-41`): Functions bound to backend helpers passed as default params
- **Style pattern** (`src/ErrorBoundary.jsx:35-70`): `const styles = {...}` objects using theme tokens
- **Backend pattern** (`src/backend.js:1-363`): Appwrite SDK wrappers with document CRUD operations
- **Test pattern** (`src/backend.test.js:26-35`): `makeDb()` factory creating mock objects with `mock()`

## What We're NOT Doing

- Converting CSS files (none exist — all styles are inline JS objects)
- Adding runtime type validation for `process.env.PUBLIC_*`
- Converting class components to functional (ErrorBoundary stays as class)
- Switching from Bun to another package manager
- Adding vitest or changing test framework (continuing with bun:test)

## Implementation Approach

**Migration Order:**

1. Install tooling (TypeScript, Biome) with no code changes
2. Create configuration files (tsconfig.json, biome.json)
3. Convert files with no dependencies first (theme, randomProposal)
4. Convert backend.js (types needed by components)
5. Convert components leaf-to-root (ErrorBoundary → Field → Header → Forms → Tables → Containers → App)
6. Convert tests alongside their components
7. Remove old tooling and finalize

**Type Strategy:**

- Appwrite document types: Custom interfaces (Trip, Participant, Proposal, Poll, Vote)
- Component props: Explicit TypeScript interfaces
- Hooks: Typed generics (useState<User | null>, etc.)
- Style objects: `React.CSSProperties`

## Phase 1: Tooling Setup

### Overview

Install TypeScript, type definitions, and Biome. Configure build tools. No code changes.

### Changes Required:

#### 1. Install Dependencies

**File**: `package.json`
**Changes**: Remove StandardJS and Prettier, add TypeScript and Biome

```json
{
  "devDependencies": {
    "@happy-dom/global-registrator": "^20.8.9",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "biome": "^0.5.0",
    "globals": "^17.4.0",
    "husky": "^9.1.7",
    "lint-staged": "^16.4.0",
    "node-appwrite": "^22.1.3"
  }
}
```

Remove: `standard`, `prettier`

#### 2. Create TypeScript Configuration

**File**: `tsconfig.json` (new)
**Changes**: Create base TypeScript configuration for React browser app

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["node", "react", "react-dom"]
  },
  "include": ["src"]
}
```

#### 3. Create Biome Configuration

**File**: `biome.json` (new)
**Changes**: Configure Biome to replace StandardJS and Prettier

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "warn",
        "noUnusedImports": "warn"
      },
      "style": {
        "useImportType": "force"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineEnding": "lf",
    "quoteStyle": "single"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5"
    }
  }
}
```

#### 4. Update package.json Scripts

**File**: `package.json`
**Changes**: Update lint and format scripts

```json
{
  "scripts": {
    "lint": "biome lint --write .",
    "format": "biome format --write ."
  }
}
```

#### 5. Update lint-staged Configuration

**File**: `package.json`
**Changes**: Update lint-staged to use Biome for TypeScript files

```json
{
  "lint-staged": {
    "*.{ts,tsx}": "biome lint --write --ignore .agents",
    "*.{md,json,jsonc}": "biome format --write"
  }
}
```

### Success Criteria:

#### Automated Verification:

- [x] `bun ls biome` shows Biome installed
- [x] `bun ls typescript` shows TypeScript installed
- [x] `cat tsconfig.json` shows valid configuration
- [x] `cat biome.json` shows valid configuration

---

## Phase 2: Convert Non-Component JS Files

### Overview

Convert utility files that have no dependencies on components. These establish foundational types.

### Changes Required:

#### 1. theme.js → theme.ts

**File**: `src/theme.js` → `src/theme.ts`
**Changes**: Add TypeScript types to exports

```typescript
export const colors: { ... } = { ... }
export const fonts: { ... } = { ... }
export const borders: { ... } = { ... }
export const formStyles: { ... } = { ... }
export const authStyles: { ... } = { ... }
export const fieldStyles: { ... } = { ... }
```

#### 2. randomProposal.js → randomProposal.ts

**File**: `src/randomProposal.js` → `src/randomProposal.ts`
**Changes**: Add TypeScript types to function signature

```typescript
export function randomProposal(count: number = 5): string[] {
  // implementation unchanged
}
```

#### 3. test-setup.js → test-setup.ts

**File**: `src/test-setup.js` → `src/test-setup.ts`
**Changes**: Add type for happy-dom globals

```typescript
import type { Window } from "happy-dom";

declare const window: Window & typeof globalThis;
// ... rest of setup unchanged
```

#### 4. backend.js → backend.ts

**File**: `src/backend.js` → `src/backend.ts`
**Changes**: Add interfaces and types for all Appwrite documents and functions

**Document Interfaces:**

```typescript
interface TripDocument {
  $id: string;
  code: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  $createdAt: string;
  $updatedAt: string;
}

interface ParticipantDocument {
  $id: string;
  ParticipantUserId: string;
  ParticipantUserName: string;
  tripId: string;
  role: "coordinator" | "participant";
  $createdAt: string;
}

interface ProposalDocument {
  $id: string;
  tripId: string;
  ProposerUserId: string;
  ProposerUserName: string;
  state: "DRAFT" | "SUBMITTED" | "REJECTED" | "APPROVED";
  title: string;
  description: string;
  $createdAt: string;
}

interface PollDocument {
  $id: string;
  tripId: string;
  PollCreatorUserId: string;
  PollCreatorUserName: string;
  state: "OPEN" | "CLOSED";
  proposalIds: string[];
  $createdAt: string;
}

interface VoteDocument {
  $id: string;
  pollId: string;
  tripId: string;
  VoterUserId: string;
  proposalIds: string[];
  tokenCounts: number[];
  $createdAt: string;
}
```

**Function Signatures:**

```typescript
export function getCoordinatorParticipant(
  tripId: string,
  db?: Databases,
): Promise<{ documents: ParticipantDocument[] }>;

export async function listTrips(
  ParticipantUserId: string,
  db?: Databases,
): Promise<{
  documents: TripDocument[];
  coordinatorUserIds: Record<string, string>;
}>;

export async function createTrip(
  ParticipantUserId: string,
  ParticipantUserName: string,
  data: Partial<TripDocument>,
  db?: Databases,
): Promise<TripDocument>;
// ... etc for all functions
```

#### 5. backend.test.js → backend.test.ts

**File**: `src/backend.test.js` → `src/backend.test.ts`
**Changes**: Add TypeScript types to mock factory and test assertions

```typescript
interface MockDb {
  listDocuments: ReturnType<typeof mock>
  createDocument: ReturnType<typeof mock>
  getDocument: ReturnType<typeof mock>
  updateDocument: ReturnType<typeof mock>
  deleteDocument: ReturnType<typeof mock>
}

function makeDb(overrides: Partial<MockDb> = {}): MockDb {
  return { ... }
}
```

### Success Criteria:

#### Automated Verification:

- [x] `bun run tsc --noEmit` passes for theme.ts, randomProposal.ts, test-setup.ts
- [x] `bun run tsc --noEmit` passes for backend.ts
- [x] `bun run test src/backend.test.ts` passes

---

## Phase 3: Convert Components

### Overview

Convert React components from JSX to TSX. Convert in dependency order: simplest first, App last.

### Conversion Order:

1. `main.jsx` → `main.tsx`
2. `ErrorBoundary.jsx` → `ErrorBoundary.tsx` (class component)
3. `Field.jsx` → `Field.tsx`
4. `Header.jsx` → `Header.tsx`
5. Form components (AuthForm, CreateTripForm, JoinTripForm, CreateProposalForm, EditTripForm, EditProposalForm)
6. Table components (TripRow, TripTable, ProposalsRow, ProposalsTable)
7. List components (ParticipantList, PollResults, PollVoting, ProposalViewer)
8. Container components (Trips, Proposals, Poll, TripOverview)
9. `App.jsx` → `App.tsx`

### Component Type Patterns:

#### Simple Component (Header.tsx)

```typescript
interface HeaderProps {
  view: string;
  tripName: string;
  tripDetailTab: string;
  onViewAllTrips: () => void;
  onTripDetailTabChange: (tab: string) => void;
  userName: string;
  onLogout: () => void;
}

export default function Header({
  view,
  tripName,
  tripDetailTab,
  onViewAllTrips,
  onTripDetailTabChange,
  userName,
  onLogout,
}: HeaderProps) {
  // implementation
}
```

#### Form Component with Events

```typescript
interface FieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  variant?: "default" | "auth" | "trip" | "proposal";
}

export default function Field({
  label,
  type = "text",
  value,
  onChange,
  error,
  variant = "default",
}: FieldProps) {
  // implementation
}
```

#### Container with Dependency Injection

```typescript
interface AppProps {
  accountGet?: () => Promise<User>;
  deleteSession?: () => Promise<void>;
  listTrips?: (userId: string) => Promise<ListTripsResult>;
  // ... other injected dependencies
}

interface User {
  $id: string;
  name?: string;
  email: string;
}

export default function App({
  accountGet = defaultAccountGet,
  deleteSession = defaultDeleteSession,
  listTrips = defaultListTrips,
  // ... destructure with defaults
}: AppProps) {
  // implementation
}
```

### Success Criteria:

#### Automated Verification:

- [x] `bun run tsc --noEmit` passes for all components
- [x] All component tests pass: `bun run test`

---

## Phase 4: Convert Test Files

### Overview

Convert test files from JSX to TSX alongside their components.

### Conversion Pattern:

**Before (App.test.jsx):**

```javascript
function renderApp(props = {}) {
  return render(
    <App accountGet={() => Promise.resolve(defaultUser)} {...props} />,
  );
}
```

**After (App.test.tsx):**

```typescript
import type { User } from '../App'

function renderApp(props: Partial<AppProps> = {}) {
  return render(
    <App
      accountGet={() => Promise.resolve(defaultUser as User)}
      {...props}
    />
  )
}
```

### Success Criteria:

#### Automated Verification:

- [x] `bun run tsc --noEmit` passes for all test files
- [x] All tests pass: `bun run test`

---

## Phase 5: Finalize

### Overview

Remove old tooling, verify Biome works end-to-end, ensure no JavaScript remains.

### Changes Required:

#### 1. Remove Old Configuration Files

**Files to remove** (if they exist):

- `.eslintrc` (if any)
- `.prettierrc`
- `.prettierignore`

#### 2. Verify No JavaScript Remains

**Bash check:**

```bash
find src -name "*.js" -o -name "*.jsx" | grep -v node_modules
```

Expected output: (empty)

#### 3. Verify Build Works

**Bash:**

```bash
bun run build
```

Expected: Build succeeds, outputs to dist/

### Success Criteria:

#### Automated Verification:

- [x] `find src -name "*.js" -o -name "*.jsx" | grep -v node_modules` returns empty
- [x] `bun run build` succeeds
- [x] `bun run test` passes
- [x] `bun run lint` passes (no StandardJS errors)
- [x] `bun run format` works

#### Manual Verification:

- [ ] App loads correctly in browser
- [ ] Can create a trip
- [ ] Can view proposals
- [ ] Can vote on poll

---

## Testing Strategy

### Unit Tests

- All existing tests should pass after conversion
- Focus on verifying type-correctness by ensuring no `any` escapes

### Integration Tests

- Full test suite via `bun run test`
- Build test via `bun run build`

### Migration Testing

1. Run `bun run test` before migration (baseline)
2. Phase 1: Verify no changes to test behavior
3. Phase 2: Run `bun run tsc --noEmit` after each file
4. Phase 3-4: Run full test suite after component conversion
5. Phase 5: Final verification

## Performance Considerations

- TypeScript type checking adds no runtime overhead
- Biome is faster than StandardJS + Prettier combined
- Build time should remain similar with Bun

## Migration Notes

### Handling threewords Package

The `threewords` package imports JSON files for adjectives and nouns:

```javascript
import adjectives from "threewords/data/adjectives.json";
import nouns from "threewords/data/nouns.json";
```

In TypeScript, add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true
  }
}
```

### process.env Typing

TypeScript doesn't know about `process.env.PUBLIC_*`. These are injected at build time by Bun. No changes needed — the `--env 'PUBLIC_*'` flag in the build script handles this.

## References

- Original ticket: `thoughts/tickets/refactor-2.md`
- Research: `thoughts/research/2026-03-30_javascript-to-typescript-migration.md`
- Component patterns: `src/App.jsx:21-41` (dependency injection)
- Style patterns: `src/ErrorBoundary.jsx:35-70` (inline styles)
- Backend patterns: `src/backend.js:1-363` (Appwrite helpers)
- Test patterns: `src/backend.test.js:26-35` (mock factory)

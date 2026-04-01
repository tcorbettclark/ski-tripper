---
type: debt
priority: medium
created: 2026-04-01T00:00:00Z
status: reviewed
tags: [refactoring, naming, backend, frontend]
keywords: [documents, TripRow, ProposalRow, PollRow, VoteRow, return types]
patterns: [return type signatures, destructuring, property access]
---

# DEBT-001: Rename generic "documents" property to specific type names

## Description

Replace generic `documents` property in function return types with specific names that match the data type (e.g., `documents: TripRow[]` → `trips: TripRow[]`). This affects all backend functions and their callers across the codebase.

## Context

The codebase uses a generic `documents` property in return types like `{ documents: TripRow[] }`, `{ documents: ProposalRow[] }`, etc. This makes it harder to understand what data is being returned without looking at the implementation.

## Scope

### Files to update:

**Core backend:**
- `src/backend.ts` - All function return types and local variables

**Backend tests:**
- `src/backend.test.ts` - All test assertions

**Frontend components (prop types and usage):**
- `src/App.tsx`
- `src/Trips.tsx`
- `src/TripOverview.tsx`
- `src/TripRow.tsx`
- `src/TripTable.tsx`
- `src/Proposals.tsx`
- `src/Poll.tsx`
- `src/JoinTripForm.tsx`
- `src/ParticipantList.tsx`

**Component tests:**
- `src/App.test.tsx`
- `src/Trips.test.tsx`
- `src/TripOverview.test.tsx`
- `src/TripRow.test.tsx`
- `src/TripTable.test.tsx`
- `src/Proposals.test.tsx`
- `src/Poll.test.tsx`
- `src/JoinTripForm.test.tsx`
- `src/ParticipantList.test.tsx`

### Naming convention:

| Return type | Property name | Local variable |
|-------------|---------------|----------------|
| `TripRow[]` | `trips` | `trips` |
| `ProposalRow[]` | `proposals` | `proposals` |
| `PollRow[]` | `polls` | `polls` |
| `VoteRow[]` | `votes` | `votes` |
| `ParticipantRow[]` | `participants` | `participants` |

## Research Context

### Keywords to Search
- `documents` - Generic property name to replace
- `TripRow`, `ProposalRow`, `PollRow`, `VoteRow` - Specific row types
- `{ documents:` - Return type signatures
- `result.documents` - Usage sites

### Patterns to Investigate
- Return type signatures: `Promise<{ documents: Type[] }>`
- Destructuring: `const { documents } = await ...`
- Property access: `result.documents.length`, `result.documents[0]`
- Prop type definitions in React components

## Success Criteria

### Automated Verification
- [ ] `bun run lint` passes with no errors
- [ ] `bun run typecheck` passes with no failures
- [ ] `bun run test` passes with no failures

### Manual Verification
- [ ] Code is more readable with specific property names
- [ ] No lingering `documents` references in the affected files

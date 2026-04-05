---
date: 2026-04-04T18:57:30+01:00
git_commit: c34f0271fc3fb0c07b58f3ac80b662ebd46714a1
branch: alice
repository: ski-tripper.alice
topic: "Redesign proposals as card grid with search and filter"
tags: [research, codebase, proposals, grid, card, filter, search, responsive]
last_updated: 2026-04-04
---

## Ticket Synopsis

This research investigates how to replace the existing proposals table (`ProposalsTable.tsx`) and modal viewer (`ProposalViewer.tsx`) with a responsive card grid layout. The new design should display all proposal information inline (no modal needed), support fuzzy search across all fields, provide a 3-state filter for DRAFT/SUBMITTED/REJECTED statuses, and work responsively without pagination. The implementation must follow existing codebase conventions: no CSS files, inline styles only, functional components with hooks, data flow via callback props, and use of theme colors/fonts.

## Summary

The codebase uses a **container pattern** where parent components manage state and pass data/callbacks to children. Proposals are currently displayed in a table format with a separate modal viewer. The new card grid design will consolidate these into a single view with inline card details. The architecture supports callback-based data flow (`onCreated`, `onUpdated`, `onDeleted`, `onSubmitted`, `onRejected`), has existing patterns for button-based filters (tab navigation), and uses CSS Grid for 2-column layouts. However, **no responsive grid implementations exist** in the codebase, so a new pattern must be created using `gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'`. The `Proposal` type contains all required fields (no optionals) including `proposerUserName` (denormalized for performance). Permission checks (`isOwner`, `isCoordinator`) and status badges are well-established in `ProposalsRow.tsx` and can be directly reused.

## Detailed Findings

### Current Component Architecture

#### Proposals.tsx (`src/Proposals.tsx:1-283`)
- **Role**: Container component managing state and rendering table/grid
- **State Management**: 
  - `proposals: Proposal[]` - Array of all proposals (line 68)
  - `loading: boolean` - Initial mount loading (line 69)
  - `showCreateForm: boolean` - Toggle create form (line 70)
  - `isCoordinator: boolean` - Permission flag (line 74)
  - `proposalsLoading: boolean` - Fetch loading (line 71)
  - `proposalsError: string` - Fetch error message (line 73)
- **Data Fetching**: Effect at lines 84-113 fetches proposals + coordinator status in parallel
- **Callback Props**: Lines 115-131 define handlers that update local state:
  - `handleCreated`: Prepends new proposal
  - `handleUpdated`: Maps over proposals to update by ID
  - `handleDeleted`: Filters out deleted proposal
  - `handleSubmitted`: Updates proposal state to SUBMITTED
  - `handleRejected`: Updates proposal state to REJECTED
- **Unmount Safety**: `mountedRef` prevents state updates post-unmount (line 75)
- **Container Pattern**: Max-width 960px, centered, padding 40px 48px

#### ProposalsTable.tsx (`src/ProposalsTable.tsx:1-122`)
- **Role**: Renders proposals in table format with empty state
- **Current Implementation**: Lines 54-83 render table with `<thead>` and `<tbody>`
- **Empty State**: Lines 48-50 return paragraph with custom message
- **Modal State**: Line 46 maintains `viewingIndex` for ProposalViewer
- **Passes to ProposalsRow**: All callbacks, permissions, and action functions
- **Will Be Replaced**: By ProposalsGrid with same prop interface

#### ProposalsRow.tsx (`src/ProposalsRow.tsx:1-291`)
- **Role**: Renders single proposal row with conditional action buttons
- **Permission Logic** (lines 51-55):
  ```typescript
  const isOwner = userId === proposal.proposerUserId
  const isDraft = proposal.state === 'DRAFT'
  const canAct = isOwner && isDraft
  const canReject = isCoordinator && proposal.state === 'SUBMITTED'
  ```
- **Action Availability**:
  - View: Available for non-REJECTED proposals (line 130)
  - Edit: Only for `canAct` (owner + DRAFT) (line 137)
  - Submit: Only for `canAct` (owner + DRAFT) (line 144)
  - Delete: Only in EditProposalForm (not direct button)
  - Reject: Only for `canReject` (coordinator + SUBMITTED) (line 155)
- **Badge Styling** (lines 251-286):
  - `badgeDraft`: Gray background, `textSecondary` color
  - `badgeSubmitted`: Blue background, `accent` color
  - `badgeRejected`: Red background, `error` color
- **Will Be Replaced**: By ProposalCard with inline display of all fields

#### ProposalViewer.tsx (`src/ProposalViewer.tsx:1-327`)
- **Role**: Modal viewer showing all proposal details
- **Fields Displayed** (lines 62-138):
  - Counter (e.g., "1 of 5")
  - Resort name
  - Country
  - Status badge
  - Altitude range
  - Nearest airport
  - Transfer time
  - Approximate cost
  - Accommodation (name + optional link)
  - Description
  - Proposed by (proposerUserName)
- **Grid Layout**: 2-column layout with `gridTemplateColumns: '1fr 1fr'` (line 264)
- **Full-Width Fields**: Accommodation, description use `gridColumn: '1/-1'`
- **Navigation**: Arrow buttons and swipe gestures for carousel
- **Will Be Removed**: Content moves to ProposalCard

### Proposal Type and Data Structure

#### Proposal Interface (`src/types.d.ts:19-39`)
```typescript
export interface Proposal {
  $id: string
  $createdAt: string
  $updatedAt: string
  proposerUserId: string
  proposerUserName: string
  tripId: string
  state: 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED'
  title: string
  description: string
  resortName: string
  startDate: string
  endDate: string
  nearestAirport: string
  transferTime: string
  accommodationName: string
  accommodationUrl: string
  altitudeRange: string
  country: string
  approximateCost: string
}
```
- **No Optional Fields**: All fields are required
- **State Enum**: Union type with 4 literal string values
- **User Denormalization**: `proposerUserName` stored at creation time for read optimization
- **No Computed Fields**: All fields come directly from database

#### Backend Operations (`src/backend.ts`)
- **createProposal** (lines 433-470): Creates DRAFT, requires participant verification
- **listProposals** (lines 472-490): Fetches all proposals for trip, ordered by `$createdAt` DESC
- **updateProposal** (lines 508-540): Owner-only, DRAFT-only, sanitizes protected fields
- **deleteProposal** (lines 542-563): Owner-only, DRAFT-only
- **submitProposal** (lines 565-589): Owner-only, DRAFT-only, transitions to SUBMITTED
- **rejectProposal** (lines 591-621): Coordinator-only, SUBMITTED-only, transitions to REJECTED
- **Authorization**: All operations verify participant access via `_verifyParticipant()`

### UI/UX Patterns

#### Filter UI Pattern (Tab Navigation)
- **Found In**: `src/Header.tsx:46-80, 131-158`
- **Implementation**: Button group with active/inactive states
- **State Management**: Parent-controlled via callback prop
- **Styling**:
  - Active: `background: 'rgba(59,189,232,0.12)'`, color: `colors.accent`, fontWeight: 600
  - Inactive: `background: 'transparent'`, color: `colors.textSecondary`, fontWeight: 500
  - Both: `padding: '6px 16px'`, `borderRadius: '6px'`, no border
- **Type Safety**: Union type literal `'overview' | 'proposals' | 'poll'`
- **Reusable Pattern**: Can be adapted for `statusFilter: 'all' | 'DRAFT' | 'SUBMITTED' | 'REJECTED'`

#### Card Component Pattern
- **Found In**: `src/TripOverview.tsx:141-214`, `src/ProposalViewer.tsx:185-226`
- **Structure**:
  ```typescript
  <div style={styles.card}>
    <div style={styles.cardHeader}>{/* Title + Actions */}</div>
    <div style={styles.details}>{/* Content rows */}</div>
  </div>
  ```
- **Styling**:
  - Background: `colors.bgCard` (#0d1e30)
  - Border: `borders.card` (1px solid rgba(100,190,230,0.12))
  - Border radius: 8px-14px
  - Padding: 20px-28px
- **Detail Rows**:
  - Label: uppercase, `textSecondary` color, `minWidth: '100px'`, letterSpacing 0.08em
  - Value: regular case, `textData` color, fontSize 14px

#### Empty State Pattern
- **Found In**: `src/ProposalsTable.tsx:48-50, 96-103`, `src/TripTable.tsx:21-23, 48-55`
- **Implementation**: Early return with styled paragraph
- **Styling**: `color: textSecondary`, `fontStyle: 'italic'`, centered, padding 60px 40px
- **Default Message**: "No proposals yet. Create one above."
- **Customizable**: `emptyMessage` prop allows override

#### Loading Pattern
- **Found In**: `src/Proposals.tsx:69, 71, 75, 154, 191`
- **Two-Tier Loading**:
  - `loading`: Initial mount (returns early)
  - `proposalsLoading`: Data fetch (conditional inline)
- **Styling**: Plain text "Loading…" or "Loading proposals…", centered, `textSecondary` color
- **Mounted Ref**: Prevents state updates after unmount

#### Error Pattern
- **Local Errors**: `src/Proposals.tsx:73, 106-109, 192-196`
  - Stored in state: `proposalsError`
  - Displayed inline with `colors.error`
  - Caught in try/catch within effect
- **Global Errors**: `src/ErrorBoundary.tsx:27-44`
  - Catches runtime/uncaught errors
  - Full-page display with "Try again" button
  - Wraps each main view in App.tsx

### Grid and Layout Patterns

#### CSS Grid Implementations
- **Fixed 2-Column**: `src/ProposalViewer.tsx:264`
  - `gridTemplateColumns: '1fr 1fr'` - Always 2 columns
  - Gap: `16px 24px` (row gap, column gap)
  - Not responsive
- **Fixed 3-Column**: `src/PollResults.tsx:73`
  - `gridTemplateColumns: '1fr 2fr auto'` - Proportional columns
  - Not responsive
- **FlexWrap Pattern**: `src/ProposalsRow.tsx:197-201`
  - `display: 'flex'`, `flexWrap: 'wrap'`, `gap: '8px'`
  - Natural wrapping on narrow screens

#### Container Pattern
- **Found In**: `src/Proposals.tsx:218-224`, `src/Trips.tsx:114-118`, `src/Poll.tsx:306-311`
- **Pattern**: 
  ```typescript
  container: {
    padding: '40px 48px',
    maxWidth: '960px',
    margin: '0 auto',
    fontFamily: fonts.body,
  }
  ```
- **Responsive**: Width expands to 960px max, centered, padding reduces naturally on narrow viewports

#### No Media Queries
- **Found**: No `@media` rules anywhere in codebase
- **Responsive Approach**: Intrinsic responsive design via:
  - `maxWidth` constraints
  - `width: '100%'` with percentages
  - `flexWrap: 'wrap'`
  - `minHeight: '100vh'` for viewport fill
- **Recommendation**: Use `gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'` for responsive grid

### Search and Filter Logic

#### Input Normalization Pattern
- **Found In**: `src/JoinTripForm.tsx:41`
- **Pattern**: `code.trim().toLowerCase()` before search
- **Case-Insensitive Matching**: Use `.toLowerCase()` on both input and comparison values

#### Client-Side Filtering Pattern
- **Found In**: `src/Poll.tsx:108`
- **Pattern**: 
  ```typescript
  const filtered = items.filter(item => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return item.field?.toLowerCase().includes(query)
  })
  ```
- **Multi-Field Search**: Combine with OR conditions:
  ```typescript
  proposal.resortName?.toLowerCase().includes(query) ||
  proposal.country?.toLowerCase().includes(query) ||
  proposal.description?.toLowerCase().includes(query)
  ```

### Responsive Design

#### Viewport Handling
- **No Viewport Hooks**: Codebase uses no `window.innerWidth` calculations
- **Touch Support**: `src/ProposalViewer.tsx:35-47` implements swipe gestures with 50px threshold
- **Touch-Friendly Buttons**: All use `onClick` handlers, work on touch devices
- **No Hover Dependencies**: One instance in `src/TripRow.tsx:43-44` uses hover (potential issue)

#### Container Width Constraints
- **960px**: Main content containers (Proposals, Trips, Poll, TripOverview)
- **560px**: Modal cards (ProposalViewer)
- **420px**: Auth forms
- **Pattern**: Max-width centers content, full width below max

### Styling and Theme

#### Color Palette (`src/theme.ts:1-9`)
```typescript
colors = {
  accent: '#3bbde8',      // Primary action color (bright blue)
  error: '#ff6b6b',       // Destructive/error color (red)
  bgPrimary: '#07111f',  // Page background
  bgCard: '#0d1e30',     // Card background (lighter blue)
  bgInput: '#060f1b',    // Form inputs (darker)
  textPrimary: '#edf6fc', // Headings
  textSecondary: '#6a94ae', // Labels, muted text
  textData: '#b0cedf',   // Data values, regular text
}
```

#### Border Definitions (`src/theme.ts:18-24`)
```typescript
borders = {
  subtle: '1px solid rgba(100,190,230,0.1)',  // Separators
  card: '1px solid rgba(100,190,230,0.12)',   // Card borders
  muted: '1px solid rgba(100,190,230,0.15)',  // Button borders
  accent: '1px solid rgba(59,189,232,0.3)',   // Active/selected
}
```

#### Style Object Pattern
- **Location**: Bottom of each component file
- **Declaration**: `const styles = { ... } as const`
- **Usage**: `style={styles.propertyName}`
- **Theme Import**: `import { colors, borders, fonts } from './theme'`

## Code References

### Component Files
- `src/Proposals.tsx:68-283` - Container component with state management
- `src/ProposalsTable.tsx:13-122` - Current table view (to be replaced)
- `src/ProposalsRow.tsx:12-291` - Current row component (to be replaced)
- `src/ProposalViewer.tsx:5-327` - Current modal viewer (to be removed)

### Type Definitions
- `src/types.d.ts:19-39` - Proposal interface definition

### Backend Operations
- `src/backend.ts:433-470` - createProposal function
- `src/backend.ts:472-490` - listProposals function
- `src/backend.ts:508-540` - updateProposal function
- `src/backend.ts:542-563` - deleteProposal function
- `src/backend.ts:565-589` - submitProposal function
- `src/backend.ts:591-621` - rejectProposal function

### UI Patterns
- `src/Header.tsx:46-80, 131-158` - Tab filter UI pattern
- `src/TripOverview.tsx:141-214` - Card layout pattern
- `src/ProposalsRow.tsx:251-286` - Status badge styling
- `src/ProposalViewer.tsx:264-267` - 2-column grid pattern
- `src/ProposalsTable.tsx:48-50` - Empty state pattern

### Theme Resources
- `src/theme.ts:1-23` - Colors, fonts, borders
- `src/theme.ts:25-67` - formStyles export
- `src/theme.ts:128-160` - fieldStyles export

## Architecture Insights

### Component Hierarchy
Current:
```
App.tsx
  └─> Proposals.tsx (container)
       ├─> CreateProposalForm.tsx (form)
       └─> ProposalsTable.tsx (table)
            ├─> ProposalsRow.tsx (row)
            │    └─> EditProposalForm.tsx (inline edit)
            └─> ProposalViewer.tsx (modal)
```

Proposed:
```
App.tsx
  └─> Proposals.tsx (container)
       ├─> CreateProposalForm.tsx (form)
       └─> ProposalsGrid.tsx (grid)
            └─> ProposalCard.tsx (card)
                 └─> EditProposalForm.tsx (inline edit)
```

### Data Flow Pattern
1. **Parent Container** (Proposals) fetches data and manages state
2. **Callback Props** flow down: `onCreated`, `onUpdated`, `onDeleted`, `onSubmitted`, `onRejected`
3. **Child Components** call callbacks to trigger parent state updates
4. **No Global State**: All state managed locally, errors propagate to ErrorBoundary

### Permission Flow
```
user.$id → Proposals → isCoordinator (from getCoordinatorParticipant)
     ↓
ProposalsTable/ProposalsGrid
     ↓
ProposalsRow/ProposalCard
     ├─> isOwner = userId === proposal.proposerUserId
     ├─> isDraft = proposal.state === 'DRAFT'
     └─> canAct = isOwner && isDraft
          canReject = isCoordinator && proposal.state === 'SUBMITTED'
```

### Style Organization
- **Global Theme**: `src/theme.ts` exports colors, fonts, borders
- **Component Styles**: `const styles = { ... } as const` at file bottom
- **Inline Application**: `style={styles.propertyName}`
- **Composition**: `style={{ ...styles.base, color: colors.accent }}`

### Test Patterns
- **Framework**: Bun test runner + React Testing Library
- **Files**: `ComponentName.test.tsx` alongside `ComponentName.tsx`
- **Imports**: `import { describe, it, expect, mock } from 'bun:test'`
- **User Interaction**: `@testing-library/user-event` for realistic interactions
- **Matchers**: `@testing-library/jest-dom` matchers

## Historical Context (from thoughts/)

### Related Research
- `thoughts/research/javascript-to-typescript-migration.md` - Documents TypeScript migration including proposal components
- `thoughts/research/refactor-remove-getUserById-calls.md` - Shows how `proposerUserName` was denormalized into Proposal documents to avoid N+1 queries

### Design Decisions
- `thoughts/designs/typescript-migration-design.md:60-74` - Defines Proposal interface with all fields
- `thoughts/tickets/feature_proposal_cards_grid.md` - Feature ticket with complete requirements

### Implementation Patterns
- `thoughts/plans/remove-getUserById-calls.md` - Pattern for passing names as props instead of fetching
- `thoughts/reviews/remove-getUserById-calls-review.md` - Verified no getUserById calls in proposal components

## Implementation Recommendations

### 1. Grid Layout
Use CSS Grid with auto-fit for responsive columns:
```typescript
const styles = {
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px 24px',
  },
} as const
```
This creates a responsive grid that adapts from 1 column (mobile) to 2-3 columns (desktop) without media queries.

### 2. Search Implementation
Add search state and filter logic in ProposalsGrid:
```typescript
const [searchQuery, setSearchQuery] = useState('')
const filteredProposals = proposals.filter(p => {
  const query = searchQuery.toLowerCase().trim()
  if (!query) return true
  return (
    p.resortName?.toLowerCase().includes(query) ||
    p.country?.toLowerCase().includes(query) ||
    p.description?.toLowerCase().includes(query) ||
    p.proposerUserName?.toLowerCase().includes(query) ||
    p.nearestAirport?.toLowerCase().includes(query) ||
    p.accommodationName?.toLowerCase().includes(query)
  )
})
```

### 3. Status Filter
Adapt tab navigation pattern from Header.tsx:
```typescript
const [statusFilter, setStatusFilter] = useState<'all' | 'DRAFT' | 'SUBMITTED' | 'REJECTED'>('all')
const statusFilteredProposals = filteredProposals.filter(p => {
  if (statusFilter === 'all') return true
  return p.state === statusFilter
})
```

### 4. ProposalCard Structure
```typescript
<div style={styles.card}>
  <div style={styles.header}>
    <div>
      <h3 style={styles.resortName}>{proposal.resortName}</h3>
      <div style={styles.meta}>
        <span>{proposal.country}</span>
        <span style={badgeStyle}>{proposal.state}</span>
      </div>
    </div>
    {/* Action buttons based on permissions */}
  </div>
  <div style={styles.grid}>
    {/* All fields from ProposalViewer */}
  </div>
</div>
```

### 5. Permission Buttons
Reuse logic from ProposalsRow.tsx:
- View button: Hidden for REJECTED proposals
- Edit button: Show for `isOwner && isDraft`
- Submit button: Show for `isOwner && isDraft`
- Reject button: Show for `isCoordinator && proposal.state === 'SUBMITTED'`
- Delete button: In edit form only (not direct card action)

### 6. Empty States
Two scenarios:
- No proposals at all: "No proposals yet. Create one above."
- No proposals match filter/search: "No proposals match your search. Try different criteria."

### 7. Delete Confirmation
Add modal state in ProposalCard:
```typescript
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
// Render confirmation modal/overlay when showDeleteConfirm === true
```

## Related Research
- `thoughts/research/javascript-to-typescript-migration.md` - TypeScript architecture and patterns
- `thoughts/research/refactor-remove-getUserById-calls.md` - User name denormalization approach

## Open Questions

1. **Accommodation Links**: Should accommodation URLs open in new tabs? Current ProposalViewer uses `<a href={...}>↗ link</a>` without target attribute. - Yes

2. **Sort Stability**: Ticket specifies alphabetical sort by resortName. Should this be case-insensitive localeCompare or simple toLowerCase comparison? - simple toLowerCase

3. **Delete Confirmation UI**: What should the delete confirmation modal/overlay look like? Should it follow the ProposalViewer modal pattern (fixed backdrop, centered card)? - Yes

4. **Empty State Actions**: Should empty state include a "Create Proposal" button when no proposals exist, or just rely on the toolbar button? - Rely on the toolbar button

5. **Search Debounce**: Should search input be debounced to avoid unnecessary re-renders, or is immediate filtering acceptable for ~20 proposals? - debounced

6. **Long Field Values**: How should very long descriptions or accommodation names be handled? Truncate with ellipsis, or allow full width? - allow full width

7. **Mobile Touch Targets**: Are 6px 16px button paddings sufficient for touch targets (32px minimum recommended)? Should mobile have larger buttons? - Use 6px 16px button paddings for now

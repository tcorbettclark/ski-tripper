---
type: feature
priority: medium
created: 2026-04-04T00:00:00Z
status: reviewed
tags: [ui, proposals, grid, cards, responsive, search, filter]
keywords: [Proposals, ProposalsTable, ProposalViewer, grid, card, filter, search, fuzzy, DRAFT, SUBMITTED, REJECTED]
patterns: [card layout, grid layout, status filter, fuzzy search, responsive design, alpha sort]
---

# FEATURE: Redesign proposals as card grid with search and filter

## Description
Replace the existing proposals table and proposal viewer with a responsive grid of proposal cards. Each card should display all proposal details (same as current viewer) in a card format arranged in a flow layout that works on different screen sizes. Include a fuzzy search box and a 3-state filter for DRAFT/SUBMITTED/REJECTED statuses.

## Context
Currently, proposals are displayed in a table format (ProposalsTable) with a separate modal viewer (ProposalViewer) when clicking "View". The current design makes it difficult to compare proposals quickly and doesn't work well on different screen sizes. The redesign should make all proposal information immediately visible without requiring a separate view, improve comparison capabilities, and work responsively across devices.

## Requirements

### Functional Requirements
- Display proposals as individual cards in a responsive grid layout
- Each card must show all information currently in ProposalViewer:
  - Resort name
  - Country
  - Status badge (DRAFT/SUBMITTED/REJECTED)
  - Altitude range
  - Nearest airport
  - Transfer time
  - Approximate cost
  - Accommodation name (with link if available)
  - Description
  - Proposed by (proposer name)
- Cards should include edit and delete buttons where applicable
- Edit button: Only visible for DRAFT proposals, only for the proposal owner
- Delete button: Only visible for the proposal owner, requires confirmation dialog
- Reject button: Only visible for trip coordinators on SUBMITTED proposals
- Sort proposals alphabetically (case-insensitive) by resort name
- Provide a 3-state filter control: DRAFT, SUBMITTED, REJECTED
  - User can filter to see only proposals in selected state
  - Filter applies in addition to search query
  - All users can access all filter states (including REJECTED)
- Provide a fuzzy search box that searches across all fields
- Show appropriate empty state messages when no proposals match filter/search
- Maintain existing "New Proposal" and "Random" buttons at the top

### Non-Functional Requirements
- Responsive grid layout that adapts to viewport width
- Performance: Support up to ~20 proposals without pagination
- Accessibility: Keyboard navigation support
- Mobile-friendly: Works well on touch devices (no hover states required)
- Follow existing theme colors, fonts, and borders from src/theme.ts
- Component file naming: ProposalsGrid.tsx, ProposalCard.tsx
- One component per file with default export
- Functional components with hooks only
- No state management libraries (no Context API, Redux, Zustand)
- Data flows via callback props (onUpdated, onDeleted, onSubmitted, onRejected)
- Let errors propagate to ErrorBoundary

## Current State
- `ProposalsTable.tsx`: Table component showing proposals in rows
- `ProposalsRow.tsx`: Individual row component with actions
- `ProposalViewer.tsx`: Modal viewer showing full proposal details
- `Proposals.tsx`: Parent component managing state and rendering table
- All fields visible: resortName, country, state (DRAFT/SUBMITTED/REJECTED), proposerUserName, altitudeRange, nearestAirport, transferTime, approximateCost, accommodationName, accommodationUrl, description

## Desired State
- `ProposalsGrid.tsx`: Grid container component (replaces ProposalsTable)
- `ProposalCard.tsx`: Individual card component (replaces ProposalsRow and ProposalViewer)
- `Proposals.tsx`: Updated to render grid instead of table
- Remove ProposalsTable.tsx, ProposalsRow.tsx, and ProposalViewer.tsx
- Keep existing "New Proposal" and "Random" buttons
- Add fuzzy search box and status filter above grid
- Grid adapts column count based on viewport width
- Cards show all details inline (no separate viewer needed)

## Research Context

### Keywords to Search
- ProposalsTable - Current table implementation to replace
- ProposalViewer - Current viewer modal to replace
- ProposalsRow - Current row component to replace
- Proposals - Parent component to update
- grid - Grid layout patterns in codebase
- card - Card component patterns
- filter - Filter/filtering UI patterns
- search - Search/fuzzy search patterns
- responsive - Responsive design patterns

### Patterns to Investigate
- Grid layout implementation - How to structure responsive grid
- Card component structure - Component organization
- Fuzzy search implementation - Client-side search logic
- Filter state management - Managing filter/search state
- Action button authorization - Owner/coordinator permission patterns from ProposalsRow
- Status badges - Badge styling patterns from ProposalsRow
- Empty state handling - Empty message patterns from ProposalsTable

### Key Decisions Made
- Use viewport width for responsive column count (no user control)
- Alphabetical sorting (case-insensitive) by resortName - fixed order
- Fuzzy search matching all fields - no highlighting
- Filter states: DRAFT, SUBMITTED, REJECTED - all visible to all users
- No persistent filter/search state (not in URL)
- No bulk actions
- No comparison features beyond viewing all in grid
- No expand/collapse - all details visible
- No pagination/infinite scroll (max ~20 proposals)
- Delete requires confirmation dialog
- No submission date or rejection reason display
- No loading state while filtering

## Success Criteria

### Automated Verification
- [ ] Bun test passes: `bun run test src/ProposalsGrid.test.tsx`
- [ ] Bun test passes: `bun run test src/ProposalCard.test.tsx`
- [ ] Existing tests still pass: `bun run test src/Proposals.test.tsx`
- [ ] Type check passes: `bunx tsc --noEmit`
- [ ] Lint passes: `bun run lint`

### Manual Verification
- [ ] Proposals display as cards in responsive grid layout
- [ ] Cards show all proposal fields (same as current viewer)
- [ ] Edit button appears only for DRAFT proposals owned by current user
- [ ] Delete button appears only for proposals owned by current user
- [ ] Delete shows confirmation dialog before removing
- [ ] Reject button appears only for coordinators on SUBMITTED proposals
- [ ] Filter control shows DRAFT/SUBMITTED/REJECTED options
- [ ] Filter correctly shows only proposals in selected state
- [ ] Fuzzy search box searches across all fields
- [ ] Search works in combination with status filter
- [ ] Proposals sorted alphabetically (case-insensitive)
- [ ] Grid adapts column count to viewport width
- [ ] Works on mobile/tablet/desktop viewports
- [ ] Empty state shows appropriate message when no proposals match
- [ ] "New Proposal" and "Random" buttons remain at top
- [ ] No hover states (touch-friendly)
- [ ] Colors/fonts match existing theme

## Related Information
- See src/theme.ts for color palette, fonts, and borders
- See src/types.d.ts for Proposal interface
- See src/backend.ts for proposal CRUD operations
- Current implementation handles isOwner and isCoordinator checks
- Status badges already styled in ProposalsRow (badgeDraft, badgeSubmitted, badgeRejected)

## Notes
- This is a UI redesign, not a backend change
- Backend operations (submitProposal, rejectProposal, etc.) remain unchanged
- Consider using CSS Grid for responsive layout
- Fuzzy search should be case-insensitive and match partial strings
- All current backend dependencies (updateProposal, deleteProposal, etc.) should be passed as props
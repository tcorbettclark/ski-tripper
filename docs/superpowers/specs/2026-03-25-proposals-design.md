# Proposals Feature Design

## Overview

Add a proposals system where trip participants can create, edit, and submit trip proposals. Each proposal captures resort and accommodation details for group decision-making.

## User Requirements

- Users create proposals for trips they've joined
- Proposals include: resort name, altitude range, country, nearest airport, transfer time, accommodation name, accommodation URL, approximate cost, general description
- States: DRAFT → SUBMITTED (no rejection workflow in this version)
- Creator can edit/delete only while in DRAFT state
- Creator can submit a proposal (DRAFT → SUBMITTED)
- All trip participants can view all proposals for a trip
- Proposals are immutable once submitted

## Data Model

### Appwrite Collection: `Proposals`

| Field               | Type   | Required | Notes                  |
| ------------------- | ------ | -------- | ---------------------- |
| `tripId`            | string | yes      | Reference to the trip  |
| `userId`            | string | yes      | Creator ID             |
| `state`             | string | yes      | `DRAFT` or `SUBMITTED` |
| `resortName`        | string | yes      | Name of ski resort     |
| `altitudeRange`     | string | yes      | e.g. "1800m - 3200m"   |
| `country`           | string | yes      | Country location       |
| `nearestAirport`    | string | yes      | Airport code or name   |
| `transferTime`      | string | yes      | e.g. "1h 30m"          |
| `accommodationName` | string | yes      | Hotel/chalet name      |
| `accommodationUrl`  | string | no       | Link to accommodation  |
| `approximateCost`   | string | yes      | Cost estimate          |
| `description`       | string | yes      | General description    |

**Permissions:** Document-level with read access for trip participants, write access for creator only in DRAFT state.

**Environment variable:** `PUBLIC_APPWRITE_PROPOSALS_COLLECTION_ID`

## Backend Functions

Add to `src/backend.js`:

### `createProposal(tripId, userId, data, db = databases)`

- Creates proposal in DRAFT state
- Verifies user is a trip participant (exists in Participants collection with tripId)
- Returns created proposal document

### `listProposals(tripId, userId, db = databases)`

- Lists all proposals for a trip
- Verifies user is a trip participant
- Returns `{ documents: [...] }` with proposals ordered by `$createdAt` descending

### `getProposal(proposalId, userId, db = databases)`

- Gets single proposal
- Verifies user is a trip participant
- Returns proposal document

### `updateProposal(proposalId, userId, data, db = databases)`

- Updates proposal fields
- Verifies: (1) user is creator AND (2) state is DRAFT
- Throws error if not creator or not DRAFT
- Returns updated proposal

### `deleteProposal(proposalId, userId, db = databases)`

- Deletes proposal
- Verifies: (1) user is creator AND (2) state is DRAFT
- Throws error if not creator or not DRAFT
- Returns void

### `submitProposal(proposalId, userId, db = databases)`

- Transitions state from DRAFT to SUBMITTED
- Verifies user is creator
- Throws error if not creator or not DRAFT
- Returns updated proposal

## UI Components

### `Proposals.jsx` (new)

Main container component. Similar pattern to `Trips.jsx`.

**State:**

- `trips` — trips user has joined (for selector)
- `selectedTripId` — currently selected trip
- `proposals` — proposals for selected trip
- `loading` — loading state
- `error` — error message
- `showCreateForm` — toggle for create form
- `editingProposalId` — ID of proposal being edited

**Behavior:**

- On mount, fetch trips user has joined (using existing `listParticipatedTrips`)
- Show trip selector dropdown
- When trip selected, fetch proposals for that trip
- Show create button, proposals table, and conditional forms

### `ProposalsTable.jsx` (new)

Table component for proposals. Similar pattern to `TripTable.jsx`.

**Columns:**

- Resort Name
- Country
- Altitude Range
- Creator (fetch user name)
- Status (badge: DRAFT/SUBMITTED)
- Actions (conditional)

### `ProposalsRow.jsx` (new)

Individual row component. Similar pattern to `TripRow.jsx`.

**Actions (conditional):**

- Edit button — only for creator AND state is DRAFT
- Delete button — only for creator AND state is DRAFT
- Submit button — only for creator AND state is DRAFT

### `CreateProposalForm.jsx` (new)

Form for creating new proposals. Similar pattern to `CreateTripForm.jsx`.

**Fields:**

- Resort Name (required)
- Altitude Range (required)
- Country (required)
- Nearest Airport (required)
- Transfer Time (required)
- Accommodation Name (required)
- Accommodation URL (optional, validated as URL if provided)
- Approximate Cost (required)
- Description (required, textarea)

### `EditProposalForm.jsx` (new)

Form for editing DRAFT proposals. Similar pattern to `EditTripForm.jsx`.

Same fields as CreateProposalForm, pre-populated with existing values.

### `App.jsx` (modify)

Add navigation to Proposals page when logged in.

**Navigation items:**

- Trips (existing)
- Proposals (new)

## State Management

Follow existing patterns from `Trips.jsx`:

```jsx
// Parent state
const [proposals, setProposals] = useState([]);
const [selectedTripId, setSelectedTripId] = useState(null);
const [showCreateForm, setShowCreateForm] = useState(false);
const [editingProposalId, setEditingProposalId] = useState(null);

// Callback handlers
function handleCreated(proposal) {
  setProposals((p) => [proposal, ...p]);
}

function handleUpdated(updated) {
  setProposals((p) =>
    p.map((prop) => (prop.$id === updated.$id ? updated : prop)),
  );
}

function handleDeleted(id) {
  setProposals((p) => p.filter((prop) => prop.$id !== id));
}

function handleSubmitted(updated) {
  setProposals((p) =>
    p.map((prop) => (prop.$id === updated.$id ? updated : prop)),
  );
}
```

## Error Handling

- Backend errors displayed inline in forms (existing pattern)
- Permission errors handled by backend functions with clear error messages
- **No trips state:** If user has no trips (hasn't joined any), show message: "Join a trip first to create proposals."
- **No proposals state:** If trip has no proposals, show: "No proposals yet. Create one above."

## File Structure

```
src/
  Proposals.jsx           — Main container (new)
  ProposalsTable.jsx      — Table display (new)
  ProposalsRow.jsx        — Individual row (new)
  CreateProposalForm.jsx   — Create form (new)
  EditProposalForm.jsx     — Edit form (new)
  backend.js              — Add proposal functions
  App.jsx                 — Add Proposals navigation
```

## Testing

Follow existing test patterns:

- Test file alongside each component
- Mock backend functions
- Test render, interactions, error states

## Implementation Order

1. Add `PUBLIC_APPWRITE_PROPOSALS_COLLECTION_ID` to environment
2. Create Proposals collection in Appwrite console
3. Add backend functions to `backend.js`
4. Create `Proposals.jsx` with trip selector and basic rendering
5. Create `ProposalsTable.jsx` and `ProposalsRow.jsx`
6. Create `CreateProposalForm.jsx`
7. Create `EditProposalForm.jsx`
8. Add Proposals navigation to `App.jsx`
9. Add tests

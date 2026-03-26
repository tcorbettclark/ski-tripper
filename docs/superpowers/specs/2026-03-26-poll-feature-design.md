# Poll Feature Design

## Overview

Add a voting poll system where the coordinator of a trip creates a poll from all `SUBMITTED` proposals. Participants distribute voting tokens across proposals using sliders. The coordinator can close the poll and run additional rounds after rejecting proposals.

## User Requirements

- Coordinator can reject `SUBMITTED` proposals (new `REJECTED` state on proposals)
- Coordinator creates a poll — automatically includes all `SUBMITTED` proposals at that moment
- At most one `OPEN` poll per trip at a time; multiple polls allowed over a trip's lifetime
- Each participant gets n voting tokens (n = number of proposals in the poll), distributable freely across proposals (total ≤ n, not required to use all)
- Live vote totals (bar chart) visible to all participants while the poll is `OPEN`
- Participants can change their vote any time while the poll is `OPEN`
- Coordinator closes the poll; after close, results remain visible to all
- Typical round-trip: create poll → vote → close → reject some proposals → create new poll

## New Proposal State: `REJECTED`

Proposals gain a third state: `DRAFT` → `SUBMITTED` → `REJECTED`.

- Only the coordinator can reject a proposal
- Only `SUBMITTED` proposals can be rejected
- Rejected proposals are excluded from future polls
- A new `REJECTED` badge (muted red) is shown in `ProposalsRow`
- `ProposalsRow` gains a "Reject" button for the coordinator, visible on `SUBMITTED` proposals only

## Data Model

### Updated `Proposals` collection

Add `REJECTED` as a valid value for the `state` field. No schema changes otherwise.

### New Appwrite collection: `Polls`

| Field         | Type     | Required | Notes                                          |
| ------------- | -------- | -------- | ---------------------------------------------- |
| `tripId`      | string   | yes      | Reference to the trip                          |
| `createdBy`   | string   | yes      | userId of coordinator                          |
| `state`       | string   | yes      | `OPEN` or `CLOSED`                             |
| `proposalIds` | string[] | yes      | Snapshot of SUBMITTED proposal IDs at creation |

**Permissions:** `read(Role.users())`, `write(Role.user(createdBy))`

**Environment variable:** `PUBLIC_APPWRITE_POLLS_COLLECTION_ID`

### New Appwrite collection: `Votes`

| Field          | Type      | Required | Notes                               |
| -------------- | --------- | -------- | ----------------------------------- |
| `pollId`       | string    | yes      | Reference to poll                   |
| `tripId`       | string    | yes      | For querying votes by trip          |
| `userId`       | string    | yes      | Voter                               |
| `proposalIds`  | string[]  | yes      | Parallel array with tokenCounts     |
| `tokenCounts`  | integer[] | yes      | Tokens allocated per proposal       |

**Permissions:** `read(Role.users())`, `write(Role.user(userId))`

**Environment variable:** `PUBLIC_APPWRITE_VOTES_COLLECTION_ID`

**Note on result visibility:** All authenticated users can read vote documents. Result visibility rules (live totals visible to all participants) are enforced by the UI only. This is consistent with how proposals are handled throughout the app.

## Backend Functions

All added to `src/backend.js`. New environment constants:
- `POLLS_COLLECTION_ID = process.env.PUBLIC_APPWRITE_POLLS_COLLECTION_ID`
- `VOTES_COLLECTION_ID = process.env.PUBLIC_APPWRITE_VOTES_COLLECTION_ID`

### `rejectProposal(proposalId, userId, db = databases)`

- Fetches proposal; verifies it is in `SUBMITTED` state
- Verifies caller is coordinator via `getCoordinatorParticipant(proposal.tripId)`
- Sets `state` to `REJECTED`
- Throws if not coordinator or not `SUBMITTED`

### `createPoll(tripId, userId, db = databases)`

- Verifies caller is coordinator
- Queries `Polls` for any existing `OPEN` poll for this trip; throws if one exists
- Fetches all `SUBMITTED` proposals for the trip; throws if none exist
- Creates poll document with `state: OPEN` and the `proposalIds` snapshot
- Permissions: `read(Role.users())`, `write(Role.user(userId))`

### `closePoll(pollId, userId, db = databases)`

- Fetches poll; verifies `state` is `OPEN`
- Verifies caller is coordinator via `getCoordinatorParticipant(poll.tripId)`
- Sets `state` to `CLOSED`

### `listPolls(tripId, userId, db = databases)`

- Verifies caller is a participant
- Returns all polls for the trip ordered by `$createdAt` descending

### `upsertVote(pollId, tripId, userId, proposalIds, tokenCounts, db = databases)`

- Verifies caller is a participant
- Fetches poll; verifies `state` is `OPEN`
- Verifies `tokenCounts.reduce((a, b) => a + b, 0) <= poll.proposalIds.length`
- Queries for an existing vote document with matching `pollId` and `userId`
- If found: updates `proposalIds` and `tokenCounts`
- If not found: creates new vote document with `read(Role.users())`, `write(Role.user(userId))`

### `listVotes(pollId, userId, db = databases)`

- Verifies caller is a participant (via the poll's `tripId`)
- Returns all vote documents for the poll

## UI Components

### `Poll.jsx` (new)

Main container for the Poll tab. Follows the pattern of `Proposals.jsx`.

**Props (with defaults):**
```jsx
function Poll({
  user,
  selectedTripId: initialSelectedTripId,
  listParticipatedTrips,
  listPolls,
  listProposals,
  listVotes,
  createPoll,
  closePoll,
  upsertVote,
  getUserById,
})
```

**State:** `trips`, `selectedTripId`, `activePoll`, `pastPolls`, `proposals`, `votes`, `myVote`, `loading`, `error`, `isCoordinator`

**Behavior:**
- On mount: fetch participated trips
- On trip select: fetch polls, proposals, and votes (if active poll exists); determine `isCoordinator` by comparing `user.$id` to coordinator participant
- Shows trip selector dropdown
- If OPEN poll: renders side-by-side panel with `PollVoting` (left) and `PollResults` (right); coordinator sees "Close Poll" button in panel header
- If no OPEN poll and coordinator and SUBMITTED proposals exist: shows "Create Poll" button
- Below active poll: list of past closed polls, each expandable to show `PollResults`

### `PollVoting.jsx` (new)

Voting form for an OPEN poll.

**Props:** `poll`, `proposals`, `myVote`, `userId`, `onVoteSaved`, `upsertVote`

- Renders one slider per proposal (range 0–n where n = `poll.proposalIds.length`)
- Live "X tokens remaining" counter (n minus current total)
- Slider max is dynamically capped: each slider's `max` attribute = `slider.currentValue + remainingTokens`. This means as you allocate tokens, other sliders' maxes shrink — you physically cannot drag past the budget, and no submit-time validation is needed
- "Save Vote" button — always enabled, saves current allocation
- Shows confirmation message after successful save

### `PollResults.jsx` (new)

Displays vote totals as a ranked bar chart.

**Props:** `poll`, `proposals`, `votes`

- Computes totals client-side: for each `proposalId` in `poll.proposalIds`, sum `tokenCounts` across all vote documents
- Renders each proposal as a row: name, bar (proportional width), total token count
- Shows total voter count
- Reused for live view (inside OPEN poll) and closed/past polls

### `ProposalsRow.jsx` (modify)

- Add `isCoordinator` prop (boolean)
- Add `onRejected` callback prop
- Add `rejectProposal` injectable prop
- Show "Reject" button for coordinator on `SUBMITTED` proposals
- Add `REJECTED` badge style (muted red, similar to `DRAFT` badge but red-tinted)
- `REJECTED` proposals: no action buttons shown

### `ProposalsTable.jsx` (modify)

- Pass `isCoordinator` and `onRejected` down to each `ProposalsRow`

### `Proposals.jsx` (modify)

- Determine `isCoordinator` (compare `user.$id` to coordinator participant for selected trip)
- Pass `isCoordinator` and `rejectProposal`/`onRejected` down to `ProposalsTable`
- Import `rejectProposal` from `backend.js`

### `App.jsx` (modify)

- Add "Poll" nav tab alongside Trips / Proposals
- Add `proposalsSelectedTripId` → `pollSelectedTripId` state (so "View Proposals" from trip table can eventually link to poll too, though not required now)
- Render `<Poll user={user} />` when `activePage === 'poll'`

## State Management

Follow existing patterns from `Proposals.jsx`. Key additions in `Poll.jsx`:

```jsx
const [activePoll, setActivePoll] = useState(null)
const [pastPolls, setPastPolls] = useState([])
const [votes, setVotes] = useState([])       // all votes for activePoll
const [myVote, setMyVote] = useState(null)   // current user's vote doc

const handlePollCreated = useCallback((poll) => {
  setActivePoll(poll)
}, [])

const handlePollClosed = useCallback((closed) => {
  setActivePoll(null)
  setPastPolls((p) => [closed, ...p])
}, [])

const handleVoteSaved = useCallback((vote) => {
  setMyVote(vote)
  setVotes((v) => {
    const exists = v.find((x) => x.$id === vote.$id)
    return exists ? v.map((x) => (x.$id === vote.$id ? vote : x)) : [...v, vote]
  })
}, [])
```

## Error Handling

- "No trips" state: "Join a trip first to create or vote in polls."
- "No submitted proposals" when coordinator tries to create poll: "No submitted proposals to poll on."
- "Poll already open" if coordinator tries to create a second OPEN poll (should not normally be reachable via UI since button is hidden, but backend enforces it)
- Vote save errors shown inline below the Save Vote button

## File Structure

```
src/
  Poll.jsx                — Main container (new)
  PollVoting.jsx          — Voting form with sliders (new)
  PollResults.jsx         — Vote totals bar chart (new)
  ProposalsRow.jsx        — Add Reject button + REJECTED badge (modify)
  ProposalsTable.jsx      — Pass isCoordinator + onRejected (modify)
  Proposals.jsx           — Add isCoordinator + rejectProposal (modify)
  App.jsx                 — Add Poll nav tab (modify)
  backend.js              — Add rejectProposal, createPoll, closePoll,
                            listPolls, upsertVote, listVotes (modify)
  Poll.test.jsx           — Tests (new)
  PollVoting.test.jsx     — Tests (new)
  PollResults.test.jsx    — Tests (new)
```

## Testing

Follow existing test patterns:

- `Poll.test.jsx` — renders trip selector, shows active poll panel, shows Create Poll button for coordinator with SUBMITTED proposals, shows past polls
- `PollVoting.test.jsx` — renders sliders, enforces token cap, calls upsertVote on save
- `PollResults.test.jsx` — computes and renders correct totals from vote documents
- `ProposalsRow.test.jsx` — add tests for Reject button visibility and REJECTED badge

## Implementation Order

1. Add `PUBLIC_APPWRITE_POLLS_COLLECTION_ID` and `PUBLIC_APPWRITE_VOTES_COLLECTION_ID` env vars
2. Create `Polls` and `Votes` collections in Appwrite console
3. Add backend functions to `backend.js` (`rejectProposal`, `createPoll`, `closePoll`, `listPolls`, `upsertVote`, `listVotes`)
4. Modify `ProposalsRow.jsx`, `ProposalsTable.jsx`, `Proposals.jsx` for Reject flow
5. Create `PollResults.jsx`
6. Create `PollVoting.jsx`
7. Create `Poll.jsx`
8. Add Poll nav tab to `App.jsx`
9. Add tests

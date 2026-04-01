---
date: 2026-03-28T11:49:31+00:00
git_commit: 2c62443f7611350e15236f79bde2902d6aad9e4a
branch: main
repository: ski-tripper
topic: "Remove separate web calls to fetch user names"
tags: [research, codebase, getUserById, appwrite, refactor]
last_updated: 2026-03-28
---

## Ticket Synopsis

Replace the many separate web calls to Appwrite to fetch the name of a user by storing their name in the corresponding Appwrite collections. This will remove the small delays and simplify the code.

Requirements:

- Remove web calls to Appwrite to fetch user names
- Store user names in Appwrite collections
- Update the tests

## Summary

The `getUserById` function in `backend.js:107-119` makes separate web API calls to Appwrite's users endpoint to fetch user display names. This is called from multiple components, causing delays and adding complexity. The solution is to store user names directly in collections where userIds are stored (PARTICIPANTS, PROPOSALS) at the time of document creation.

## Scope (Clarified with User)

- Add `userName` field to PARTICIPANTS collection when created via `createTrip`, `joinTrip`
- Add `creatorName` field to PROPOSALS collection when created via `createProposal`
- Remove `getUserById` completely
- Remove `PUBLIC_APPWRITE_READ_USERS_API_KEY` (no longer needed)
- No migration of existing documents
- User name updates deferred to future work

## Detailed Findings

### Current Implementation

#### getUserById Function (backend.js:107-119)

The `getUserById` function fetches user data from Appwrite's users API:

```javascript
export async function getUserById(userId) {
  const res = await fetch(
    `${process.env.PUBLIC_APPWRITE_ENDPOINT}/users/${userId}`,
    {
      headers: {
        "X-Appwrite-Project": process.env.PUBLIC_APPWRITE_PROJECT_ID,
        "X-Appwrite-Key": process.env.PUBLIC_APPWRITE_READ_USERS_API_KEY,
      },
    },
  );
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json();
}
```

Note the comment at line 121-123 explaining that `PUBLIC_APPWRITE_READ_USERS_API_KEY` is intentionally exposed as a read-only key.

### Collections with userId Fields

From `backend.js:22-27`, the collections are:

- `TRIPS_COLLECTION_ID`
- `PARTICIPANTS_COLLECTION_ID` - has `userId` and `tripId`
- `PROPOSALS_COLLECTION_ID` - has `userId` and `tripId`
- `POLLS_COLLECTION_ID` - has `createdBy` (userId)
- `VOTES_COLLECTION_ID` - has `userId`

### Components Using getUserById

| Component      | File                   | Lines                        | Purpose                                              |
| -------------- | ---------------------- | ---------------------------- | ---------------------------------------------------- |
| TripRow        | src/TripRow.jsx        | 28                           | Fetches coordinator name                             |
| TripOverview   | src/TripOverview.jsx   | 53, 66                       | Fetches coordinator name, then all participant names |
| ProposalsRow   | src/ProposalsRow.jsx   | 36                           | Fetches proposal creator name                        |
| ProposalViewer | src/ProposalViewer.jsx | 23                           | Fetches proposal creator name                        |
| ProposalsTable | src/ProposalsTable.jsx | Passes to ProposalsRow       | -                                                    |
| Proposals      | src/Proposals.jsx      | Passes to ProposalsTable/Row | -                                                    |
| TripTable      | src/TripTable.jsx      | Passes to TripRow            | -                                                    |
| Trips          | src/Trips.jsx          | Passes to TripTable          | -                                                    |

### Usage Patterns

1. **TripRow.jsx:24-31** - Fetches single coordinator name:

```javascript
getCoordinatorParticipant(trip.$id)
  .then(({ documents }) => {
    if (!mountedRef.current || documents.length === 0) return;
    return getUserById(documents[0].userId);
  })
  .then((c) => {
    if (mountedRef.current && c) setCoordinator(c);
  });
```

2. **TripOverview.jsx:43-56** - Fetches coordinator name:

```javascript
getCoordinatorParticipant(trip.$id)
  .then(({ documents }) => {
    if (!mountedRef.current || documents.length === 0) return;
    const cid = documents[0].userId;
    return getUserById(cid);
  })
  .then((c) => {
    if (mountedRef.current && c) setCoordinator(c);
  });
```

3. **TripOverview.jsx:59-79** - Fetches ALL participant names:

```javascript
listParticipatedTrips(user.$id).then(({ documents }) => {
  const userIds = tripParticipants.map((p) => p.userId);
  return Promise.all(userIds.map((id) => getUserById(id)));
});
```

4. **ProposalsRow.jsx:34-40** - Fetches proposal creator:

```javascript
if (proposal.userId) {
  getUserById(proposal.userId)
    .then(setCreator)
    .catch(() => {});
}
```

5. **ProposalViewer.jsx:20-27** - Fetches proposal creator:

```javascript
if (proposal.userId) {
  getUserById(proposal.userId)
    .then(setCreator)
    .catch(() => {});
}
```

### Create Functions to Modify

To store user names, these create functions in `backend.js` need to accept and store userName:

1. **createTrip (backend.js:88-105)** - Creates participant with `userId` but no name
2. **joinTrip (backend.js:170-189)** - Creates participant with `userId` but no name
3. **createProposal (backend.js:210-219)** - Creates proposal with `userId` but no name

### Test Files That Mock getUserById

| Test File                   | Mocks                   |
| --------------------------- | ----------------------- |
| src/App.test.jsx            | Line 31, 134            |
| src/TripOverview.test.jsx   | Line 18                 |
| src/TripRow.test.jsx        | Line 20                 |
| src/TripTable.test.jsx      | Line 20                 |
| src/Trips.test.jsx          | Line 23                 |
| src/Proposals.test.jsx      | Lines 22, 87            |
| src/ProposalsRow.test.jsx   | Line 35                 |
| src/ProposalsTable.test.jsx | Line 34                 |
| src/ProposalViewer.test.jsx | Lines 63, 116, 123, 125 |
| src/backend.test.js         | Lines 306-319           |

## Code References

- `src/backend.js:107-119` - getUserById function (to be removed)
- `src/backend.js:88-105` - createTrip (needs userName)
- `src/backend.js:170-189` - joinTrip (needs userName)
- `src/backend.js:210-219` - createProposal (needs creatorName)
- `src/TripRow.jsx:28` - TripRow usage (needs updating)
- `src/TripOverview.jsx:53,66` - TripOverview usage (needs updating)
- `src/ProposalsRow.jsx:36` - ProposalsRow usage (needs updating)
- `src/ProposalViewer.jsx:23` - ProposalViewer usage (needs updating)

## Architecture Insights

### Current Data Flow

1. Component renders with userId stored in collection
2. useEffect triggers getUserById(userId) call
3. Separate fetch to Appwrite users API
4. Name returned and displayed

### New Data Flow

1. User object available at creation time (from `account.get()`)
2. At document creation time, store both `userId` AND `userName` in collection
3. Queries return documents with embedded `userName`
4. No separate fetch needed - display `doc.userName` or `doc.creatorName` directly

### Implementation Checklist

- [ ] Modify `createTrip(userId, data, db)` - add `userName` parameter, store in PARTICIPANTS
- [ ] Modify `joinTrip(userId, tripId, db)` - add `userName` parameter, store in PARTICIPANTS
- [ ] Modify `createProposal(tripId, userId, data, db)` - add `creatorName` parameter, store in PROPOSALS
- [ ] Update TripRow to use `documents[0].userName` instead of `getUserById`
- [ ] Update TripOverview to use `userName` from PARTICIPANTS and participants list
- [ ] Update ProposalsRow to use `creatorName` instead of `getUserById`
- [ ] Update ProposalViewer to use `creatorName` instead of `getUserById`
- [ ] Remove getUserById from backend.js exports and delete function
- [ ] Remove `PUBLIC_APPWRITE_READ_USERS_API_KEY` from `.env` and deployment config
- [ ] Remove getUserById import from App.jsx
- [ ] Remove getUserById parameter from all component props
- [ ] Update all test files - remove getUserById mocks
- [ ] Update backend.test.js - remove getUserById tests

### New Component Props

Components will need new prop names:

- `userName` (from PARTICIPANTS document) instead of calling `getUserById`
- `creatorName` (from PROPOSALS document) instead of calling `getUserById`

### Participant Loading in TripOverview

TripOverview currently fetches ALL participant names via `Promise.all(userIds.map(id => getUserById(id)))`. After refactor:

- The participants list comes from `listParticipatedTrips` which returns PARTICIPANTS documents
- Each PARTICIPANTS document will have `userName` stored at join time
- TripOverview should use `p.userName` instead of `getUserById(p.userId)`

## Historical Context (from thoughts/)

No existing research documents found related to this refactor. The `thoughts/` directory structure exists but contains only the ticket file at `thoughts/tickets/refactor-1.md`.

## Related Research

No prior research found in `thoughts/research/`.

## Open Questions

1. ~~Should `getUserById` be completely removed or kept for edge cases?~~ **Decision: Remove completely**
2. ~~Should existing documents in Appwrite be migrated to add `userName` fields?~~ **Decision: Handled separately**
3. ~~Should user name updates (e.g., user changes their name) trigger updates to all their documents?~~ **Decision: Deferred to future work**
4. ~~Is `PUBLIC_APPWRITE_READ_USERS_API_KEY` still needed?~~ **Decision: Remove - no longer needed**

# Poll Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coordinator-managed voting poll system where participants distribute tokens across SUBMITTED proposals using sliders, with live results visible to all.

**Architecture:** New `Polls` and `Votes` Appwrite collections. All backend logic in `backend.js` following existing patterns. Three new React components (`PollResults`, `PollVoting`, `Poll`) plus modifications to `ProposalsRow`, `ProposalsTable`, `Proposals`, and `App`.

**Tech Stack:** React hooks, Appwrite (Databases), Bun test runner, React Testing Library, happy-dom.

---

### Task 1: Environment setup

**Files:**
- Modify: `.env` (not committed)
- Modify: `.env.example`

- [ ] **Step 1: Add env vars to `.env`**

Add these two lines to `.env`:
```
PUBLIC_APPWRITE_POLLS_COLLECTION_ID=your-polls-collection-id
PUBLIC_APPWRITE_VOTES_COLLECTION_ID=your-votes-collection-id
```

- [ ] **Step 2: Update `.env.example`**

Append to `.env.example`:
```
PUBLIC_APPWRITE_POLLS_COLLECTION_ID=your-polls-collection-id
PUBLIC_APPWRITE_VOTES_COLLECTION_ID=your-votes-collection-id
```

- [ ] **Step 3: Create Appwrite collections manually**

In the Appwrite console, create two new collections in the existing database:

**`Polls` collection** — set `PUBLIC_APPWRITE_POLLS_COLLECTION_ID` to its ID:
| Attribute | Type | Required |
|---|---|---|
| `tripId` | String (255) | yes |
| `createdBy` | String (255) | yes |
| `state` | String (16) | yes |
| `proposalIds` | String[] (255, array) | yes |

Permissions: Any user can read; write restricted to creator (handled per-document in code).

**`Votes` collection** — set `PUBLIC_APPWRITE_VOTES_COLLECTION_ID` to its ID:
| Attribute | Type | Required |
|---|---|---|
| `pollId` | String (255) | yes |
| `tripId` | String (255) | yes |
| `userId` | String (255) | yes |
| `proposalIds` | String[] (255, array) | yes |
| `tokenCounts` | Integer[] (array) | yes |

Permissions: Any user can read; write restricted to voter (handled per-document in code).

- [ ] **Step 4: Commit `.env.example`**

```bash
git add .env.example
git commit -m "chore: add poll and vote collection env vars"
```

---

### Task 2: `rejectProposal` backend function

**Files:**
- Modify: `src/backend.js`
- Modify: `src/backend.test.js`

- [ ] **Step 1: Write failing tests**

Add to `src/backend.test.js` (after the `submitProposal` describe block):

```javascript
describe('rejectProposal', () => {
  it('sets state to REJECTED when caller is coordinator and proposal is SUBMITTED', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({ $id: 'p-1', userId: 'creator-1', tripId: 'trip-1', state: 'SUBMITTED' })
      ),
      listDocuments: mock(() =>
        Promise.resolve({ documents: [{ $id: 'part-1', userId: 'coord-1' }] })
      )
    })
    await rejectProposal('p-1', 'coord-1', db)
    expect(db.updateDocument).toHaveBeenCalledTimes(1)
    const [, , , data] = db.updateDocument.mock.calls[0]
    expect(data.state).toBe('REJECTED')
  })

  it('throws when proposal state is not SUBMITTED', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({ $id: 'p-1', userId: 'creator-1', tripId: 'trip-1', state: 'DRAFT' })
      )
    })
    await expect(rejectProposal('p-1', 'coord-1', db)).rejects.toThrow(
      'Only submitted proposals can be rejected.'
    )
    expect(db.updateDocument).not.toHaveBeenCalled()
  })

  it('throws when caller is not the coordinator', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({ $id: 'p-1', userId: 'creator-1', tripId: 'trip-1', state: 'SUBMITTED' })
      ),
      listDocuments: mock(() =>
        Promise.resolve({ documents: [{ $id: 'part-1', userId: 'other-coord' }] })
      )
    })
    await expect(rejectProposal('p-1', 'user-1', db)).rejects.toThrow(
      'Only the coordinator can reject this proposal.'
    )
    expect(db.updateDocument).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = makeDb({
      getDocument: mock(() => Promise.reject(new Error('Not found')))
    })
    await expect(rejectProposal('p-1', 'coord-1', db)).rejects.toThrow('Not found')
  })
})
```

Also add `rejectProposal` to the import at the top of `backend.test.js`:
```javascript
import {
  // ... existing imports ...
  rejectProposal
} from './backend'
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/backend.test.js --test-name-pattern="rejectProposal"
```

Expected: FAIL with "rejectProposal is not a function" or similar.

- [ ] **Step 3: Implement `rejectProposal` in `backend.js`**

Add these two lines after the existing collection ID constants (after `PROPOSALS_COLLECTION_ID`):
```javascript
const POLLS_COLLECTION_ID = process.env.PUBLIC_APPWRITE_POLLS_COLLECTION_ID
const VOTES_COLLECTION_ID = process.env.PUBLIC_APPWRITE_VOTES_COLLECTION_ID
```

Add this function at the end of `src/backend.js`:
```javascript
export async function rejectProposal (proposalId, userId, db = databases) {
  const proposal = await db.getDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId)
  if (proposal.state !== 'SUBMITTED') throw new Error('Only submitted proposals can be rejected.')
  const { documents } = await getCoordinatorParticipant(proposal.tripId, db)
  if (documents.length === 0 || documents[0].userId !== userId) {
    throw new Error('Only the coordinator can reject this proposal.')
  }
  return db.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId, { state: 'REJECTED' })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test src/backend.test.js --test-name-pattern="rejectProposal"
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/backend.js src/backend.test.js
git commit -m "feat: add rejectProposal backend function"
```

---

### Task 3: Poll backend functions (`createPoll`, `closePoll`, `listPolls`)

**Files:**
- Modify: `src/backend.js`
- Modify: `src/backend.test.js`

- [ ] **Step 1: Write failing tests**

Add to `src/backend.test.js` (after the `rejectProposal` describe block):

```javascript
describe('createPoll', () => {
  it('creates a poll with OPEN state and proposal snapshot when caller is coordinator', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'part-1', userId: 'coord-1' }] })
      )
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'prop-1' }, { $id: 'prop-2' }] })
      )
    const db = makeDb({ listDocuments })
    await createPoll('trip-1', 'coord-1', db)
    expect(db.createDocument).toHaveBeenCalledTimes(1)
    const [, , , data] = db.createDocument.mock.calls[0]
    expect(data.state).toBe('OPEN')
    expect(data.proposalIds).toEqual(['prop-1', 'prop-2'])
    expect(data.tripId).toBe('trip-1')
    expect(data.createdBy).toBe('coord-1')
  })

  it('throws when caller is not the coordinator', async () => {
    const listDocuments = mock(() =>
      Promise.resolve({ documents: [{ $id: 'part-1', userId: 'other-user' }] })
    )
    const db = makeDb({ listDocuments })
    await expect(createPoll('trip-1', 'user-1', db)).rejects.toThrow(
      'Only the coordinator can create a poll.'
    )
    expect(db.createDocument).not.toHaveBeenCalled()
  })

  it('throws when a poll is already open for this trip', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'part-1', userId: 'coord-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'poll-1', state: 'OPEN' }] })
      )
    const db = makeDb({ listDocuments })
    await expect(createPoll('trip-1', 'coord-1', db)).rejects.toThrow(
      'A poll is already open for this trip.'
    )
    expect(db.createDocument).not.toHaveBeenCalled()
  })

  it('throws when there are no submitted proposals', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'part-1', userId: 'coord-1' }] })
      )
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
    const db = makeDb({ listDocuments })
    await expect(createPoll('trip-1', 'coord-1', db)).rejects.toThrow(
      'No submitted proposals to poll on.'
    )
    expect(db.createDocument).not.toHaveBeenCalled()
  })
})

describe('closePoll', () => {
  it('sets state to CLOSED when caller is coordinator and poll is OPEN', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({ $id: 'poll-1', tripId: 'trip-1', state: 'OPEN' })
      ),
      listDocuments: mock(() =>
        Promise.resolve({ documents: [{ $id: 'part-1', userId: 'coord-1' }] })
      )
    })
    await closePoll('poll-1', 'coord-1', db)
    expect(db.updateDocument).toHaveBeenCalledTimes(1)
    const [, , , data] = db.updateDocument.mock.calls[0]
    expect(data.state).toBe('CLOSED')
  })

  it('throws when poll is not OPEN', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({ $id: 'poll-1', tripId: 'trip-1', state: 'CLOSED' })
      )
    })
    await expect(closePoll('poll-1', 'coord-1', db)).rejects.toThrow(
      'Only open polls can be closed.'
    )
    expect(db.updateDocument).not.toHaveBeenCalled()
  })

  it('throws when caller is not the coordinator', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({ $id: 'poll-1', tripId: 'trip-1', state: 'OPEN' })
      ),
      listDocuments: mock(() =>
        Promise.resolve({ documents: [{ $id: 'part-1', userId: 'other-coord' }] })
      )
    })
    await expect(closePoll('poll-1', 'user-1', db)).rejects.toThrow(
      'Only the coordinator can close a poll.'
    )
    expect(db.updateDocument).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = makeDb({
      getDocument: mock(() => Promise.reject(new Error('Not found')))
    })
    await expect(closePoll('poll-1', 'coord-1', db)).rejects.toThrow('Not found')
  })
})

describe('listPolls', () => {
  it('returns polls when user is a participant', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1', tripId: 'trip-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'poll-1', tripId: 'trip-1', state: 'OPEN' }] })
      )
    const db = makeDb({ listDocuments })
    const result = await listPolls('trip-1', 'user-1', db)
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0].$id).toBe('poll-1')
  })

  it('throws when user is not a participant', async () => {
    const db = makeDb()
    await expect(listPolls('trip-1', 'user-1', db)).rejects.toThrow(
      'You must be a participant to access proposals.'
    )
  })
})
```

Add these to the import at the top of `backend.test.js`:
```javascript
import {
  // ... existing imports ...
  createPoll,
  closePoll,
  listPolls
} from './backend'
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/backend.test.js --test-name-pattern="createPoll|closePoll|listPolls"
```

Expected: FAIL.

- [ ] **Step 3: Implement in `backend.js`**

Append to `src/backend.js`:

```javascript
export async function createPoll (tripId, userId, db = databases) {
  const { documents: coordDocs } = await getCoordinatorParticipant(tripId, db)
  if (coordDocs.length === 0 || coordDocs[0].userId !== userId) {
    throw new Error('Only the coordinator can create a poll.')
  }
  const { documents: openPolls } = await db.listDocuments(DATABASE_ID, POLLS_COLLECTION_ID, [
    Query.equal('tripId', tripId),
    Query.equal('state', 'OPEN'),
    Query.limit(1)
  ])
  if (openPolls.length > 0) throw new Error('A poll is already open for this trip.')
  const { documents: proposals } = await db.listDocuments(DATABASE_ID, PROPOSALS_COLLECTION_ID, [
    Query.equal('tripId', tripId),
    Query.equal('state', 'SUBMITTED'),
    Query.limit(100)
  ])
  if (proposals.length === 0) throw new Error('No submitted proposals to poll on.')
  const proposalIds = proposals.map((p) => p.$id)
  return db.createDocument(
    DATABASE_ID,
    POLLS_COLLECTION_ID,
    ID.unique(),
    { tripId, createdBy: userId, state: 'OPEN', proposalIds },
    [Permission.read(Role.users()), Permission.write(Role.user(userId))]
  )
}

export async function closePoll (pollId, userId, db = databases) {
  const poll = await db.getDocument(DATABASE_ID, POLLS_COLLECTION_ID, pollId)
  if (poll.state !== 'OPEN') throw new Error('Only open polls can be closed.')
  const { documents } = await getCoordinatorParticipant(poll.tripId, db)
  if (documents.length === 0 || documents[0].userId !== userId) {
    throw new Error('Only the coordinator can close a poll.')
  }
  return db.updateDocument(DATABASE_ID, POLLS_COLLECTION_ID, pollId, { state: 'CLOSED' })
}

export async function listPolls (tripId, userId, db = databases) {
  await _verifyParticipant(tripId, userId, db)
  return db.listDocuments(DATABASE_ID, POLLS_COLLECTION_ID, [
    Query.equal('tripId', tripId),
    Query.orderDesc('$createdAt'),
    Query.limit(50)
  ])
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test src/backend.test.js --test-name-pattern="createPoll|closePoll|listPolls"
```

Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add src/backend.js src/backend.test.js
git commit -m "feat: add createPoll, closePoll, listPolls backend functions"
```

---

### Task 4: Vote backend functions (`upsertVote`, `listVotes`)

**Files:**
- Modify: `src/backend.js`
- Modify: `src/backend.test.js`

- [ ] **Step 1: Write failing tests**

Add to `src/backend.test.js`:

```javascript
describe('upsertVote', () => {
  it('creates a vote document when no existing vote', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1', tripId: 'trip-1' }] })
      )
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
    const db = makeDb({
      listDocuments,
      getDocument: mock(() =>
        Promise.resolve({ $id: 'poll-1', state: 'OPEN', proposalIds: ['p-1', 'p-2', 'p-3'] })
      )
    })
    await upsertVote('poll-1', 'trip-1', 'user-1', ['p-1'], [2], db)
    expect(db.createDocument).toHaveBeenCalledTimes(1)
    const [, , , data] = db.createDocument.mock.calls[0]
    expect(data.pollId).toBe('poll-1')
    expect(data.userId).toBe('user-1')
    expect(data.proposalIds).toEqual(['p-1'])
    expect(data.tokenCounts).toEqual([2])
  })

  it('updates existing vote document when one already exists', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1', tripId: 'trip-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'vote-1' }] })
      )
    const db = makeDb({
      listDocuments,
      getDocument: mock(() =>
        Promise.resolve({ $id: 'poll-1', state: 'OPEN', proposalIds: ['p-1', 'p-2', 'p-3'] })
      )
    })
    await upsertVote('poll-1', 'trip-1', 'user-1', ['p-2'], [1], db)
    expect(db.updateDocument).toHaveBeenCalledTimes(1)
    const [, , docId] = db.updateDocument.mock.calls[0]
    expect(docId).toBe('vote-1')
    expect(db.createDocument).not.toHaveBeenCalled()
  })

  it('throws when poll is not OPEN', async () => {
    const listDocuments = mock(() =>
      Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1' }] })
    )
    const db = makeDb({
      listDocuments,
      getDocument: mock(() =>
        Promise.resolve({ $id: 'poll-1', state: 'CLOSED', proposalIds: ['p-1'] })
      )
    })
    await expect(upsertVote('poll-1', 'trip-1', 'user-1', [], [], db)).rejects.toThrow(
      'Voting is only allowed on open polls.'
    )
  })

  it('throws when total tokens exceed the number of proposals', async () => {
    const listDocuments = mock(() =>
      Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1' }] })
    )
    const db = makeDb({
      listDocuments,
      getDocument: mock(() =>
        Promise.resolve({ $id: 'poll-1', state: 'OPEN', proposalIds: ['p-1', 'p-2'] })
      )
    })
    await expect(upsertVote('poll-1', 'trip-1', 'user-1', ['p-1'], [3], db)).rejects.toThrow(
      'Total tokens cannot exceed 2.'
    )
  })

  it('throws when user is not a participant', async () => {
    const db = makeDb()
    await expect(upsertVote('poll-1', 'trip-1', 'user-1', [], [], db)).rejects.toThrow(
      'You must be a participant to access proposals.'
    )
  })
})

describe('listVotes', () => {
  it('returns vote documents when user is a participant', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1', tripId: 'trip-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'v-1', pollId: 'poll-1' }] })
      )
    const db = makeDb({ listDocuments })
    const result = await listVotes('poll-1', 'trip-1', 'user-1', db)
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0].$id).toBe('v-1')
  })

  it('throws when user is not a participant', async () => {
    const db = makeDb()
    await expect(listVotes('poll-1', 'trip-1', 'user-1', db)).rejects.toThrow(
      'You must be a participant to access proposals.'
    )
  })
})
```

Add to imports in `backend.test.js`:
```javascript
import {
  // ... existing imports ...
  upsertVote,
  listVotes
} from './backend'
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/backend.test.js --test-name-pattern="upsertVote|listVotes"
```

Expected: FAIL.

- [ ] **Step 3: Implement in `backend.js`**

Append to `src/backend.js`:

```javascript
export async function upsertVote (pollId, tripId, userId, proposalIds, tokenCounts, db = databases) {
  await _verifyParticipant(tripId, userId, db)
  const poll = await db.getDocument(DATABASE_ID, POLLS_COLLECTION_ID, pollId)
  if (poll.state !== 'OPEN') throw new Error('Voting is only allowed on open polls.')
  const total = tokenCounts.reduce((a, b) => a + b, 0)
  if (total > poll.proposalIds.length) {
    throw new Error(`Total tokens cannot exceed ${poll.proposalIds.length}.`)
  }
  const { documents } = await db.listDocuments(DATABASE_ID, VOTES_COLLECTION_ID, [
    Query.equal('pollId', pollId),
    Query.equal('userId', userId),
    Query.limit(1)
  ])
  if (documents.length > 0) {
    return db.updateDocument(DATABASE_ID, VOTES_COLLECTION_ID, documents[0].$id, { proposalIds, tokenCounts })
  }
  return db.createDocument(
    DATABASE_ID,
    VOTES_COLLECTION_ID,
    ID.unique(),
    { pollId, tripId, userId, proposalIds, tokenCounts },
    [Permission.read(Role.users()), Permission.write(Role.user(userId))]
  )
}

export async function listVotes (pollId, tripId, userId, db = databases) {
  await _verifyParticipant(tripId, userId, db)
  return db.listDocuments(DATABASE_ID, VOTES_COLLECTION_ID, [
    Query.equal('pollId', pollId),
    Query.limit(200)
  ])
}
```

- [ ] **Step 4: Run all backend tests**

```bash
bun run test src/backend.test.js
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/backend.js src/backend.test.js
git commit -m "feat: add upsertVote, listVotes backend functions"
```

---

### Task 5: `ProposalsRow` — REJECTED badge and Reject button

**Files:**
- Modify: `src/ProposalsRow.jsx`
- Modify: `src/ProposalsRow.test.jsx`

- [ ] **Step 1: Write failing tests**

Add to the `describe('ProposalsRow', ...)` block in `src/ProposalsRow.test.jsx`:

```javascript
  it('shows the REJECTED status badge', async () => {
    await renderProposalsRow({ proposal: { ...sampleProposal, state: 'REJECTED' } })
    expect(screen.getByText('REJECTED')).toBeInTheDocument()
  })

  it('shows no action buttons for REJECTED proposals', async () => {
    await renderProposalsRow({ proposal: { ...sampleProposal, state: 'REJECTED' } })
    expect(screen.queryByRole('button', { name: /^view$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^submit$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument()
  })

  it('shows Reject button when isCoordinator and proposal is SUBMITTED', async () => {
    await renderProposalsRow({
      isCoordinator: true,
      proposal: { ...sampleProposal, state: 'SUBMITTED' }
    })
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument()
  })

  it('does not show Reject button when not coordinator', async () => {
    await renderProposalsRow({
      isCoordinator: false,
      proposal: { ...sampleProposal, state: 'SUBMITTED' }
    })
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument()
  })

  it('does not show Reject button for DRAFT proposals even when coordinator', async () => {
    await renderProposalsRow({ isCoordinator: true })
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument()
  })

  it('calls rejectProposal and onRejected when Reject is clicked', async () => {
    const user = userEvent.setup()
    const rejectedProposal = { ...sampleProposal, state: 'REJECTED' }
    const rejectProposal = mock(() => Promise.resolve(rejectedProposal))
    const onRejected = mock(() => {})
    await renderProposalsRow({
      isCoordinator: true,
      proposal: { ...sampleProposal, state: 'SUBMITTED' },
      rejectProposal,
      onRejected
    })
    await user.click(screen.getByRole('button', { name: /^reject$/i }))
    await waitFor(() => {
      expect(rejectProposal).toHaveBeenCalledWith('p-1', 'user-1')
      expect(onRejected).toHaveBeenCalledWith(rejectedProposal)
    })
  })

  it('shows an error when rejectProposal fails', async () => {
    const user = userEvent.setup()
    await renderProposalsRow({
      isCoordinator: true,
      proposal: { ...sampleProposal, state: 'SUBMITTED' },
      rejectProposal: mock(() => Promise.reject(new Error('Cannot reject')))
    })
    await user.click(screen.getByRole('button', { name: /^reject$/i }))
    await waitFor(() => {
      expect(screen.getByText('Cannot reject')).toBeInTheDocument()
    })
  })
```

Update the `renderProposalsRow` helper to include the new props:

```javascript
async function renderProposalsRow (props = {}) {
  const defaults = {
    proposal: sampleProposal,
    userId: 'user-1',
    isCoordinator: false,
    onUpdated: mock(() => {}),
    onDeleted: mock(() => {}),
    onSubmitted: mock(() => {}),
    onRejected: mock(() => {}),
    onView: mock(() => {}),
    updateProposal: mock(() => Promise.resolve()),
    deleteProposal: mock(() => Promise.resolve()),
    submitProposal: mock(() => Promise.resolve()),
    rejectProposal: mock(() => Promise.resolve()),
    getUserById: mock(() => Promise.resolve({ name: 'Alice', email: 'alice@example.com' }))
  }
  let result
  await act(async () => {
    result = render(
      <table>
        <tbody>
          <ProposalsRow {...defaults} {...props} />
        </tbody>
      </table>
    )
  })
  return { ...result, ...defaults, ...props }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/ProposalsRow.test.jsx
```

Expected: new tests FAIL, existing tests still pass.

- [ ] **Step 3: Implement in `ProposalsRow.jsx`**

Replace the entire `src/ProposalsRow.jsx` with:

```javascript
import { useState, useEffect } from 'react'
import EditProposalForm from './EditProposalForm'
import {
  updateProposal as _updateProposal,
  deleteProposal as _deleteProposal,
  submitProposal as _submitProposal,
  rejectProposal as _rejectProposal,
  getUserById as _getUserById
} from './backend'
import { colors, fonts, borders } from './theme'

export default function ProposalsRow ({
  proposal,
  userId,
  isCoordinator = false,
  onUpdated,
  onDeleted,
  onSubmitted,
  onRejected = () => {},
  onView = () => {},
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  rejectProposal = _rejectProposal,
  getUserById = _getUserById
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [creator, setCreator] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectError, setRejectError] = useState('')

  useEffect(() => {
    if (proposal.userId) {
      getUserById(proposal.userId)
        .then(setCreator)
        .catch(() => {})
    }
  }, [proposal.userId])

  const isOwner = userId === proposal.userId
  const isDraft = proposal.state === 'DRAFT'
  const isRejected = proposal.state === 'REJECTED'
  const canAct = isOwner && isDraft
  const canReject = isCoordinator && proposal.state === 'SUBMITTED'

  async function handleSubmit () {
    setSubmitError('')
    setSubmitting(true)
    try {
      const result = await submitProposal(proposal.$id, userId)
      setSubmitting(false)
      onSubmitted(result)
    } catch (err) {
      setSubmitError(err.message)
      setSubmitting(false)
    }
  }

  async function handleReject () {
    setRejectError('')
    setRejecting(true)
    try {
      const result = await rejectProposal(proposal.$id, userId)
      setRejecting(false)
      onRejected(result)
    } catch (err) {
      setRejectError(err.message)
      setRejecting(false)
    }
  }

  if (isEditing) {
    return (
      <tr style={styles.editingTr}>
        <td style={styles.editingTd} colSpan={5}>
          <EditProposalForm
            proposal={proposal}
            userId={userId}
            onUpdated={(updated) => {
              onUpdated(updated)
              setIsEditing(false)
            }}
            onDeleted={() => { setIsEditing(false); onDeleted(proposal.$id) }}
            onCancel={() => setIsEditing(false)}
            updateProposal={updateProposal}
            deleteProposal={deleteProposal}
          />
        </td>
      </tr>
    )
  }

  return (
    <tr style={styles.tr}>
      <td style={styles.td}>{proposal.resortName || '—'}</td>
      <td style={{ ...styles.td, color: colors.textSecondary }}>{proposal.country || '—'}</td>
      <td style={{ ...styles.td, color: colors.textSecondary }} title={creator?.email || undefined}>
        {creator?.name || creator?.email || '—'}
      </td>
      <td style={styles.td}>
        <span style={isDraft ? styles.badgeDraft : isRejected ? styles.badgeRejected : styles.badgeSubmitted}>
          {proposal.state}
        </span>
      </td>
      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
        {!isRejected && (
          <div style={styles.actions}>
            <button onClick={onView} style={styles.viewButton}>
              View
            </button>
            {canAct && (
              <>
                <button onClick={() => setIsEditing(true)} style={styles.editButton}>
                  Edit
                </button>
                <button onClick={handleSubmit} disabled={submitting} style={styles.submitButton}>
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
                {submitError && <p style={styles.errorText}>{submitError}</p>}
              </>
            )}
            {canReject && (
              <>
                <button onClick={handleReject} disabled={rejecting} style={styles.rejectButton}>
                  {rejecting ? 'Rejecting…' : 'Reject'}
                </button>
                {rejectError && <p style={styles.errorText}>{rejectError}</p>}
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

const styles = {
  tr: {
    borderBottom: '1px solid rgba(100,190,230,0.07)'
  },
  td: {
    padding: '14px 16px',
    color: colors.textData,
    verticalAlign: 'top',
    fontFamily: fonts.body,
    fontSize: '14px',
    lineHeight: '1.5'
  },
  editingTr: {
    borderBottom: '1px solid rgba(59,189,232,0.2)',
    borderTop: '1px solid rgba(59,189,232,0.2)',
    background: 'rgba(59,189,232,0.04)'
  },
  editingTd: {
    padding: '20px 24px',
    verticalAlign: 'top',
    borderLeft: `2px solid ${colors.accent}`
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  viewButton: {
    padding: '5px 16px',
    borderRadius: '5px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em'
  },
  editButton: {
    padding: '5px 16px',
    borderRadius: '5px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em'
  },
  submitButton: {
    padding: '5px 16px',
    borderRadius: '5px',
    border: '1px solid rgba(59,189,232,0.3)',
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em'
  },
  rejectButton: {
    padding: '5px 16px',
    borderRadius: '5px',
    border: '1px solid rgba(255,107,107,0.3)',
    background: 'transparent',
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em'
  },
  badgeDraft: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    color: colors.textSecondary,
    background: 'rgba(106,148,174,0.15)',
    border: '1px solid rgba(106,148,174,0.2)'
  },
  badgeSubmitted: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    color: colors.accent,
    background: 'rgba(59,189,232,0.12)',
    border: '1px solid rgba(59,189,232,0.25)'
  },
  badgeRejected: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    color: colors.error,
    background: 'rgba(255,107,107,0.12)',
    border: '1px solid rgba(255,107,107,0.25)'
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '11px',
    margin: '4px 0 0',
    whiteSpace: 'normal'
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun run test src/ProposalsRow.test.jsx
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/ProposalsRow.jsx src/ProposalsRow.test.jsx
git commit -m "feat: add REJECTED badge and Reject button to ProposalsRow"
```

---

### Task 6: Thread `isCoordinator` + `rejectProposal` through `ProposalsTable` and `Proposals`

**Files:**
- Modify: `src/ProposalsTable.jsx`
- Modify: `src/ProposalsTable.test.jsx`
- Modify: `src/Proposals.jsx`
- Modify: `src/Proposals.test.jsx`

- [ ] **Step 1: Write failing tests for `ProposalsTable`**

Add to `src/ProposalsTable.test.jsx` inside the `describe('ProposalsTable', ...)` block:

```javascript
  it('passes isCoordinator to ProposalsRow — Reject button visible when true and proposal is SUBMITTED', async () => {
    const submittedProposal = { ...sampleProposal, $id: 'p-1', state: 'SUBMITTED' }
    await renderProposalsTable({ proposals: [submittedProposal], isCoordinator: true })
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument()
  })

  it('does not show Reject button when isCoordinator is false', async () => {
    const submittedProposal = { ...sampleProposal, $id: 'p-1', state: 'SUBMITTED' }
    await renderProposalsTable({ proposals: [submittedProposal], isCoordinator: false })
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument()
  })
```

Update `renderProposalsTable` to include new props:

```javascript
async function renderProposalsTable (props = {}) {
  const defaults = {
    proposals: [],
    userId: 'user-1',
    isCoordinator: false,
    onUpdated: mock(() => {}),
    onDeleted: mock(() => {}),
    onSubmitted: mock(() => {}),
    onRejected: mock(() => {}),
    updateProposal: mock(() => Promise.resolve()),
    deleteProposal: mock(() => Promise.resolve()),
    submitProposal: mock(() => Promise.resolve()),
    rejectProposal: mock(() => Promise.resolve()),
    getUserById: mock(() => Promise.resolve({ name: 'Alice', email: 'alice@example.com' }))
  }
  let result
  await act(async () => {
    result = render(<ProposalsTable {...defaults} {...props} />)
  })
  return result
}
```

- [ ] **Step 2: Write failing tests for `Proposals`**

Add to `src/Proposals.test.jsx` inside the `describe('Proposals', ...)` block:

```javascript
  it('shows Reject button when user is coordinator and proposal is SUBMITTED', async () => {
    const submittedProposal = { ...sampleProposals[0], state: 'SUBMITTED' }
    await act(async () => {
      renderProposals({
        listProposals: mock(() => Promise.resolve({ documents: [submittedProposal] })),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1' }] })
        )
      })
    })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trip-1' } })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument()
    })
  })

  it('does not show Reject button when user is not coordinator', async () => {
    const submittedProposal = { ...sampleProposals[0], state: 'SUBMITTED' }
    await act(async () => {
      renderProposals({
        listProposals: mock(() => Promise.resolve({ documents: [submittedProposal] })),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({ documents: [{ $id: 'part-1', userId: 'other-user' }] })
        )
      })
    })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trip-1' } })
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument()
    })
  })
```

Update `renderProposals` defaults to include new injectables:

```javascript
function renderProposals (props = {}) {
  const defaults = {
    user,
    listParticipatedTrips: mock(() => Promise.resolve({ documents: sampleTrips })),
    listProposals: mock(() => Promise.resolve({ documents: sampleProposals })),
    createProposal: mock(() => Promise.resolve({ $id: 'p-new' })),
    updateProposal: mock(() => Promise.resolve({ $id: 'p-1' })),
    deleteProposal: mock(() => Promise.resolve()),
    submitProposal: mock(() => Promise.resolve({ $id: 'p-1', state: 'SUBMITTED' })),
    rejectProposal: mock(() => Promise.resolve({ $id: 'p-1', state: 'REJECTED' })),
    getCoordinatorParticipant: mock(() => Promise.resolve({ documents: [] })),
    getUserById: mock(() => Promise.resolve({ name: 'Alice', email: 'alice@example.com' }))
  }
  return render(<Proposals {...defaults} {...props} />)
}
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
bun run test src/ProposalsTable.test.jsx src/Proposals.test.jsx
```

Expected: new tests FAIL, existing pass.

- [ ] **Step 4: Update `ProposalsTable.jsx`**

Replace the entire `src/ProposalsTable.jsx` with:

```javascript
import { useState } from 'react'
import ProposalsRow from './ProposalsRow'
import ProposalViewer from './ProposalViewer'
import {
  updateProposal as _updateProposal,
  deleteProposal as _deleteProposal,
  submitProposal as _submitProposal,
  rejectProposal as _rejectProposal,
  getUserById as _getUserById
} from './backend'
import { colors, fonts, borders } from './theme'

export default function ProposalsTable ({
  proposals,
  userId,
  isCoordinator = false,
  onUpdated,
  onDeleted,
  onSubmitted,
  onRejected = () => {},
  emptyMessage = 'No proposals yet. Create one above.',
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  rejectProposal = _rejectProposal,
  getUserById = _getUserById
}) {
  const [viewingIndex, setViewingIndex] = useState(null)

  if (proposals.length === 0) {
    return <p style={styles.empty}>{emptyMessage}</p>
  }

  return (
    <>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Resort Name</th>
            <th style={styles.th}>Country</th>
            <th style={styles.th}>Creator</th>
            <th style={styles.th}>Status</th>
            <th style={{ ...styles.th, minWidth: '160px' }} />
          </tr>
        </thead>
        <tbody>
          {proposals.map((proposal, index) => (
            <ProposalsRow
              key={proposal.$id}
              proposal={proposal}
              userId={userId}
              isCoordinator={isCoordinator}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
              onSubmitted={onSubmitted}
              onRejected={onRejected}
              onView={() => setViewingIndex(index)}
              updateProposal={updateProposal}
              deleteProposal={deleteProposal}
              submitProposal={submitProposal}
              rejectProposal={rejectProposal}
              getUserById={getUserById}
            />
          ))}
        </tbody>
      </table>
      {viewingIndex !== null && (
        <ProposalViewer
          proposals={proposals}
          initialIndex={viewingIndex}
          onClose={() => setViewingIndex(null)}
          getUserById={getUserById}
        />
      )}
    </>
  )
}

const styles = {
  empty: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '60px 40px',
    textAlign: 'center',
    fontSize: '15px',
    fontStyle: 'italic'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: fonts.body,
    fontSize: '14px'
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    background: colors.bgCard,
    borderBottom: borders.subtle,
    fontFamily: fonts.body,
    fontSize: '11px',
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: '0.1em',
    textTransform: 'uppercase'
  }
}
```

- [ ] **Step 5: Update `Proposals.jsx`**

Replace the entire `src/Proposals.jsx` with:

```javascript
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  listParticipatedTrips as _listParticipatedTrips,
  listProposals as _listProposals,
  createProposal as _createProposal,
  updateProposal as _updateProposal,
  deleteProposal as _deleteProposal,
  submitProposal as _submitProposal,
  rejectProposal as _rejectProposal,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  getUserById as _getUserById
} from './backend'
import CreateProposalForm from './CreateProposalForm'
import { randomProposal } from './randomProposal'
import ProposalsTable from './ProposalsTable'
import { colors, fonts, borders } from './theme'

export default function Proposals ({
  user,
  refreshTrips,
  selectedTripId: initialSelectedTripId,
  listParticipatedTrips = _listParticipatedTrips,
  listProposals = _listProposals,
  createProposal = _createProposal,
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  rejectProposal = _rejectProposal,
  getCoordinatorParticipant = _getCoordinatorParticipant,
  getUserById = _getUserById
}) {
  const [trips, setTrips] = useState([])
  const [selectedTripId, setSelectedTripId] = useState(initialSelectedTripId || null)
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [randomizing, setRandomizing] = useState(false)
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalsError, setProposalsError] = useState('')
  const [isCoordinator, setIsCoordinator] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (initialSelectedTripId) {
      setSelectedTripId(initialSelectedTripId)
    }
  }, [initialSelectedTripId])

  useEffect(() => {
    listParticipatedTrips(user.$id)
      .then((result) => {
        if (mountedRef.current) {
          setTrips(result.documents)
          if (result.documents.length === 1 && !selectedTripId) {
            setSelectedTripId(result.documents[0].$id)
          }
        }
      })
      .catch((err) => { if (mountedRef.current) setError(err.message) })
      .finally(() => { if (mountedRef.current) setLoading(false) })
  }, [user.$id])

  useEffect(() => {
    if (!selectedTripId) {
      setProposals([])
      setIsCoordinator(false)
      return
    }
    setProposalsLoading(true)
    setProposalsError('')
    Promise.all([
      listProposals(selectedTripId, user.$id),
      getCoordinatorParticipant(selectedTripId)
    ])
      .then(([proposalsResult, coordResult]) => {
        if (!mountedRef.current) return
        setProposals(proposalsResult.documents)
        setIsCoordinator(
          coordResult.documents.length > 0 && coordResult.documents[0].userId === user.$id
        )
      })
      .catch((err) => { if (mountedRef.current) setProposalsError(err.message) })
      .finally(() => { if (mountedRef.current) setProposalsLoading(false) })
  }, [selectedTripId, user.$id])

  const handleCreated = useCallback((proposal) => {
    setProposals((p) => [proposal, ...p])
  }, [])

  const handleUpdated = useCallback((updated) => {
    setProposals((p) => p.map((prop) => (prop.$id === updated.$id ? updated : prop)))
  }, [])

  const handleDeleted = useCallback((id) => {
    setProposals((p) => p.filter((prop) => prop.$id !== id))
  }, [])

  const handleRejected = useCallback((updated) => {
    setProposals((p) => p.map((prop) => (prop.$id === updated.$id ? updated : prop)))
  }, [])

  async function handleRandomProposal () {
    setRandomizing(true)
    try {
      const proposal = await createProposal(selectedTripId, user.$id, randomProposal())
      handleCreated(proposal)
    } finally {
      setRandomizing(false)
    }
  }

  const handleSubmitted = useCallback((updated) => {
    setProposals((p) => p.map((prop) => (prop.$id === updated.$id ? updated : prop)))
  }, [])

  if (loading) return <p style={styles.message}>Loading…</p>
  if (error) return <p style={{ ...styles.message, color: colors.error }}>{error}</p>

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Proposals</h2>
        {selectedTripId && (
          <div style={styles.buttons}>
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              style={styles.actionButton}
            >
              {showCreateForm ? 'Cancel' : '+ New Proposal'}
            </button>
            <button
              onClick={handleRandomProposal}
              disabled={randomizing}
              style={styles.randomButton}
            >
              {randomizing ? 'Adding…' : '🎲 Random'}
            </button>
          </div>
        )}
      </div>

      {trips.length === 0
        ? <p style={styles.message}>Join a trip first to create proposals.</p>
        : (
          <select
            value={selectedTripId || ''}
            onChange={(e) => {
              setSelectedTripId(e.target.value || null)
              setShowCreateForm(false)
            }}
            style={styles.select}
          >
            <option value=''>— Select a trip —</option>
            {trips.map((trip) => (
              <option key={trip.$id} value={trip.$id}>{trip.description || trip.code || trip.$id}</option>
            ))}
          </select>
          )}

      {showCreateForm && selectedTripId && (
        <CreateProposalForm
          tripId={selectedTripId}
          userId={user.$id}
          onCreated={handleCreated}
          onDismiss={() => setShowCreateForm(false)}
          createProposal={createProposal}
        />
      )}

      {proposalsLoading && <p style={styles.message}>Loading proposals…</p>}
      {proposalsError && <p style={{ ...styles.message, color: colors.error }}>{proposalsError}</p>}

      {!proposalsLoading && !proposalsError && (
        <ProposalsTable
          proposals={proposals}
          userId={user.$id}
          isCoordinator={isCoordinator}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onSubmitted={handleSubmitted}
          onRejected={handleRejected}
          emptyMessage='No proposals yet. Create one above.'
          updateProposal={updateProposal}
          deleteProposal={deleteProposal}
          submitProposal={submitProposal}
          rejectProposal={rejectProposal}
          getUserById={getUserById}
        />
      )}
    </div>
  )
}

const styles = {
  container: {
    padding: '40px 48px',
    maxWidth: '960px',
    margin: '0 auto',
    fontFamily: fonts.body
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '80px',
    textAlign: 'center',
    fontSize: '15px'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
    paddingBottom: '20px',
    borderBottom: borders.subtle
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: '30px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.01em'
  },
  buttons: {
    display: 'flex',
    gap: '10px'
  },
  actionButton: {
    padding: '9px 22px',
    borderRadius: '7px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  },
  randomButton: {
    padding: '9px 22px',
    borderRadius: '7px',
    border: `1px solid ${colors.accent}`,
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  },
  select: {
    padding: '10px 14px',
    borderRadius: '7px',
    border: borders.muted,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
    outline: 'none',
    marginBottom: '24px',
    width: '100%'
  }
}
```

- [ ] **Step 6: Run all tests**

```bash
bun run test src/ProposalsTable.test.jsx src/Proposals.test.jsx src/ProposalsRow.test.jsx
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add src/ProposalsTable.jsx src/ProposalsTable.test.jsx src/Proposals.jsx src/Proposals.test.jsx
git commit -m "feat: thread isCoordinator and rejectProposal through Proposals components"
```

---

### Task 7: `PollResults` component

**Files:**
- Create: `src/PollResults.jsx`
- Create: `src/PollResults.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/PollResults.test.jsx`:

```javascript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'bun:test'
import PollResults from './PollResults'

const poll = { $id: 'poll-1', proposalIds: ['p-1', 'p-2', 'p-3'] }
const proposals = [
  { $id: 'p-1', resortName: 'Chamonix' },
  { $id: 'p-2', resortName: 'Verbier' },
  { $id: 'p-3', resortName: 'Zermatt' }
]

describe('PollResults', () => {
  it('renders all proposal names', () => {
    render(<PollResults poll={poll} proposals={proposals} votes={[]} />)
    expect(screen.getByText('Chamonix')).toBeInTheDocument()
    expect(screen.getByText('Verbier')).toBeInTheDocument()
    expect(screen.getByText('Zermatt')).toBeInTheDocument()
  })

  it('shows "0 votes" when there are no votes', () => {
    render(<PollResults poll={poll} proposals={proposals} votes={[]} />)
    expect(screen.getByText('0 votes')).toBeInTheDocument()
  })

  it('shows "1 vote" singular', () => {
    const votes = [{ $id: 'v-1', proposalIds: ['p-1'], tokenCounts: [1] }]
    render(<PollResults poll={poll} proposals={proposals} votes={votes} />)
    expect(screen.getByText('1 vote')).toBeInTheDocument()
  })

  it('shows "2 votes" plural', () => {
    const votes = [
      { $id: 'v-1', proposalIds: ['p-1'], tokenCounts: [2] },
      { $id: 'v-2', proposalIds: ['p-2'], tokenCounts: [1] }
    ]
    render(<PollResults poll={poll} proposals={proposals} votes={votes} />)
    expect(screen.getByText('2 votes')).toBeInTheDocument()
  })

  it('shows correct total tokens per proposal', () => {
    const votes = [
      { $id: 'v-1', proposalIds: ['p-1', 'p-2'], tokenCounts: [2, 1] },
      { $id: 'v-2', proposalIds: ['p-1'], tokenCounts: [1] }
    ]
    render(<PollResults poll={poll} proposals={proposals} votes={votes} />)
    // p-1 total = 3, p-2 total = 1, p-3 total = 0
    const totals = screen.getAllByText('3')
    expect(totals.length).toBeGreaterThan(0)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('ignores token allocations for proposalIds not in the poll', () => {
    const votes = [
      { $id: 'v-1', proposalIds: ['p-99'], tokenCounts: [5] }
    ]
    render(<PollResults poll={poll} proposals={proposals} votes={votes} />)
    // p-99 is not in poll, totals should all be 0
    const zeros = screen.getAllByText('0')
    expect(zeros).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/PollResults.test.jsx
```

Expected: FAIL with "Cannot find module './PollResults'".

- [ ] **Step 3: Implement `PollResults.jsx`**

Create `src/PollResults.jsx`:

```javascript
import { colors, fonts } from './theme'

export default function PollResults ({ poll, proposals, votes }) {
  const proposalMap = Object.fromEntries(proposals.map((p) => [p.$id, p]))

  const totals = {}
  poll.proposalIds.forEach((id) => { totals[id] = 0 })
  votes.forEach((vote) => {
    vote.proposalIds.forEach((proposalId, i) => {
      if (totals[proposalId] !== undefined) {
        totals[proposalId] += vote.tokenCounts[i] || 0
      }
    })
  })

  const sorted = [...poll.proposalIds].sort((a, b) => totals[b] - totals[a])
  const maxTotal = Math.max(...Object.values(totals), 1)
  const voterCount = votes.length

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {voterCount} {voterCount === 1 ? 'vote' : 'votes'}
      </div>
      {sorted.map((proposalId) => {
        const proposal = proposalMap[proposalId]
        const total = totals[proposalId]
        const barWidth = `${Math.round((total / maxTotal) * 100)}%`
        return (
          <div key={proposalId} style={styles.row}>
            <div style={styles.label}>{proposal?.resortName || proposalId}</div>
            <div style={styles.barTrack}>
              <div style={{ ...styles.bar, width: barWidth }} />
            </div>
            <div style={styles.total}>{total}</div>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  container: { fontFamily: fonts.body },
  header: {
    fontSize: '11px',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '12px'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr auto',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px'
  },
  label: { fontSize: '14px', color: colors.textData },
  barTrack: {
    background: 'rgba(59,189,232,0.1)',
    borderRadius: '3px',
    height: '6px',
    overflow: 'hidden'
  },
  bar: {
    background: colors.accent,
    height: '100%',
    borderRadius: '3px'
  },
  total: {
    fontSize: '14px',
    color: colors.accent,
    fontWeight: '600',
    minWidth: '24px',
    textAlign: 'right'
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun run test src/PollResults.test.jsx
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/PollResults.jsx src/PollResults.test.jsx
git commit -m "feat: add PollResults component"
```

---

### Task 8: `PollVoting` component

**Files:**
- Create: `src/PollVoting.jsx`
- Create: `src/PollVoting.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/PollVoting.test.jsx`:

```javascript
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, mock } from 'bun:test'
import PollVoting from './PollVoting'

const poll = { $id: 'poll-1', tripId: 'trip-1', proposalIds: ['p-1', 'p-2', 'p-3'] }
const proposals = [
  { $id: 'p-1', resortName: 'Chamonix' },
  { $id: 'p-2', resortName: 'Verbier' },
  { $id: 'p-3', resortName: 'Zermatt' }
]

function renderPollVoting (props = {}) {
  const defaults = {
    poll,
    proposals,
    myVote: null,
    userId: 'user-1',
    onVoteSaved: mock(() => {}),
    upsertVote: mock(() => Promise.resolve({ $id: 'v-new' }))
  }
  return render(<PollVoting {...defaults} {...props} />)
}

describe('PollVoting', () => {
  it('renders a slider for each proposal', () => {
    renderPollVoting()
    expect(screen.getAllByRole('slider')).toHaveLength(3)
  })

  it('shows proposal names', () => {
    renderPollVoting()
    expect(screen.getByText('Chamonix')).toBeInTheDocument()
    expect(screen.getByText('Verbier')).toBeInTheDocument()
    expect(screen.getByText('Zermatt')).toBeInTheDocument()
  })

  it('shows max tokens and remaining tokens', () => {
    renderPollVoting()
    expect(screen.getByText(/3 tokens/i)).toBeInTheDocument()
    expect(screen.getByText(/3 remaining/i)).toBeInTheDocument()
  })

  it('renders Save Vote button', () => {
    renderPollVoting()
    expect(screen.getByRole('button', { name: /save vote/i })).toBeInTheDocument()
  })

  it('initializes sliders from myVote when provided', () => {
    const myVote = { proposalIds: ['p-1', 'p-3'], tokenCounts: [2, 1] }
    renderPollVoting({ myVote })
    const sliders = screen.getAllByRole('slider')
    expect(sliders[0].value).toBe('2') // p-1
    expect(sliders[1].value).toBe('0') // p-2 not in vote
    expect(sliders[2].value).toBe('1') // p-3
  })

  it('calls upsertVote with non-zero allocations and calls onVoteSaved', async () => {
    const user = userEvent.setup()
    const savedVote = { $id: 'v-new', proposalIds: [], tokenCounts: [] }
    const upsertVote = mock(() => Promise.resolve(savedVote))
    const onVoteSaved = mock(() => {})
    renderPollVoting({ upsertVote, onVoteSaved })
    await user.click(screen.getByRole('button', { name: /save vote/i }))
    await waitFor(() => {
      expect(upsertVote).toHaveBeenCalledWith('poll-1', 'trip-1', 'user-1', [], [])
      expect(onVoteSaved).toHaveBeenCalledWith(savedVote)
    })
  })

  it('shows "Vote saved" after successful save', async () => {
    const user = userEvent.setup()
    renderPollVoting()
    await user.click(screen.getByRole('button', { name: /save vote/i }))
    await waitFor(() => {
      expect(screen.getByText(/vote saved/i)).toBeInTheDocument()
    })
  })

  it('shows error message when upsertVote fails', async () => {
    const user = userEvent.setup()
    renderPollVoting({
      upsertVote: mock(() => Promise.reject(new Error('Vote failed')))
    })
    await user.click(screen.getByRole('button', { name: /save vote/i }))
    await waitFor(() => {
      expect(screen.getByText('Vote failed')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/PollVoting.test.jsx
```

Expected: FAIL with "Cannot find module './PollVoting'".

- [ ] **Step 3: Implement `PollVoting.jsx`**

Create `src/PollVoting.jsx`:

```javascript
import { useState } from 'react'
import { upsertVote as _upsertVote } from './backend'
import { colors, fonts } from './theme'

export default function PollVoting ({ poll, proposals, myVote, userId, onVoteSaved, upsertVote = _upsertVote }) {
  const proposalMap = Object.fromEntries(proposals.map((p) => [p.$id, p]))

  const [allocations, setAllocations] = useState(() => {
    const init = {}
    poll.proposalIds.forEach((id) => { init[id] = 0 })
    if (myVote) {
      myVote.proposalIds.forEach((id, i) => { init[id] = myVote.tokenCounts[i] || 0 })
    }
    return init
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const maxTokens = poll.proposalIds.length
  const totalUsed = Object.values(allocations).reduce((a, b) => a + b, 0)
  const remaining = maxTokens - totalUsed

  function handleSlider (proposalId, value) {
    setSaved(false)
    setAllocations((prev) => ({ ...prev, [proposalId]: value }))
  }

  async function handleSave () {
    setSaving(true)
    setSaveError('')
    setSaved(false)
    const nonZeroIds = poll.proposalIds.filter((id) => allocations[id] > 0)
    const proposalIds = nonZeroIds
    const tokenCounts = nonZeroIds.map((id) => allocations[id])
    try {
      const result = await upsertVote(poll.$id, poll.tripId, userId, proposalIds, tokenCounts)
      setSaved(true)
      onVoteSaved(result)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Your Vote</div>
      {poll.proposalIds.map((proposalId) => {
        const proposal = proposalMap[proposalId]
        const value = allocations[proposalId]
        const sliderMax = value + remaining
        return (
          <div key={proposalId} style={styles.row}>
            <div style={styles.rowHeader}>
              <span style={styles.proposalName}>{proposal?.resortName || proposalId}</span>
              <span style={styles.tokenCount}>{value}</span>
            </div>
            <input
              type='range'
              min={0}
              max={sliderMax}
              value={value}
              onChange={(e) => handleSlider(proposalId, Number(e.target.value))}
              style={styles.slider}
            />
          </div>
        )
      })}
      <div style={styles.footer}>
        <span style={styles.remaining}>{maxTokens} tokens · {remaining} remaining</span>
        <button onClick={handleSave} disabled={saving} style={styles.saveButton}>
          {saving ? 'Saving…' : 'Save Vote'}
        </button>
      </div>
      {saved && <p style={styles.savedText}>Vote saved</p>}
      {saveError && <p style={styles.errorText}>{saveError}</p>}
    </div>
  )
}

const styles = {
  container: { fontFamily: fonts.body },
  header: {
    fontSize: '11px',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '12px'
  },
  row: { marginBottom: '14px' },
  rowHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px'
  },
  proposalName: { fontSize: '14px', color: colors.textData },
  tokenCount: { fontSize: '14px', color: colors.accent, fontWeight: '600' },
  slider: { width: '100%', accentColor: colors.accent },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '12px'
  },
  remaining: {
    fontSize: '11px',
    color: colors.textSecondary
  },
  saveButton: {
    padding: '7px 20px',
    borderRadius: '6px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  savedText: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '12px',
    margin: '8px 0 0'
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '12px',
    margin: '8px 0 0'
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun run test src/PollVoting.test.jsx
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/PollVoting.jsx src/PollVoting.test.jsx
git commit -m "feat: add PollVoting component"
```

---

### Task 9: `Poll` container component

**Files:**
- Create: `src/Poll.jsx`
- Create: `src/Poll.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/Poll.test.jsx`:

```javascript
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, mock } from 'bun:test'
import Poll from './Poll'

const user = { $id: 'user-1', name: 'Alice' }
const sampleTrips = [
  { $id: 'trip-1', description: 'Alps Adventure' },
  { $id: 'trip-2', description: 'Dolomites' }
]
const sampleProposals = [
  { $id: 'p-1', state: 'SUBMITTED', resortName: 'Chamonix' }
]
const openPoll = {
  $id: 'poll-1', tripId: 'trip-1', state: 'OPEN', proposalIds: ['p-1']
}
const closedPoll = {
  $id: 'poll-2', tripId: 'trip-1', state: 'CLOSED', proposalIds: ['p-1']
}

function renderPoll (props = {}) {
  const defaults = {
    user,
    listParticipatedTrips: mock(() => Promise.resolve({ documents: sampleTrips })),
    listPolls: mock(() => Promise.resolve({ documents: [] })),
    listProposals: mock(() => Promise.resolve({ documents: sampleProposals })),
    listVotes: mock(() => Promise.resolve({ documents: [] })),
    createPoll: mock(() => Promise.resolve(openPoll)),
    closePoll: mock(() => Promise.resolve(closedPoll)),
    upsertVote: mock(() => Promise.resolve({ $id: 'v-new' })),
    getCoordinatorParticipant: mock(() => Promise.resolve({ documents: [] }))
  }
  return render(<Poll {...defaults} {...props} />)
}

describe('Poll', () => {
  it('shows loading state initially', () => {
    renderPoll({ listParticipatedTrips: mock(() => new Promise(() => {})) })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows trip selector after loading', async () => {
    await act(async () => { renderPoll() })
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByText('Alps Adventure')).toBeInTheDocument()
      expect(screen.getByText('Dolomites')).toBeInTheDocument()
    })
  })

  it('shows "Join a trip first" when no trips', async () => {
    await act(async () => {
      renderPoll({ listParticipatedTrips: mock(() => Promise.resolve({ documents: [] })) })
    })
    await waitFor(() => {
      expect(screen.getByText(/join a trip first/i)).toBeInTheDocument()
    })
  })

  it('shows Create Poll button when coordinator with SUBMITTED proposals and no active poll', async () => {
    await act(async () => {
      renderPoll({
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1' }] })
        )
      })
    })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trip-1' } })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create poll/i })).toBeInTheDocument()
    })
  })

  it('does not show Create Poll button when not coordinator', async () => {
    await act(async () => { renderPoll() })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trip-1' } })
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /create poll/i })).not.toBeInTheDocument()
    })
  })

  it('shows active poll panel when an OPEN poll exists', async () => {
    await act(async () => {
      renderPoll({
        listPolls: mock(() => Promise.resolve({ documents: [openPoll] }))
      })
    })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trip-1' } })
    })
    await waitFor(() => {
      expect(screen.getByText(/active poll/i)).toBeInTheDocument()
    })
  })

  it('shows Close Poll button for coordinator when poll is OPEN', async () => {
    await act(async () => {
      renderPoll({
        listPolls: mock(() => Promise.resolve({ documents: [openPoll] })),
        getCoordinatorParticipant: mock(() =>
          Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1' }] })
        )
      })
    })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trip-1' } })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close poll/i })).toBeInTheDocument()
    })
  })

  it('does not show Close Poll button for non-coordinator', async () => {
    await act(async () => {
      renderPoll({
        listPolls: mock(() => Promise.resolve({ documents: [openPoll] }))
      })
    })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trip-1' } })
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /close poll/i })).not.toBeInTheDocument()
    })
  })

  it('shows past polls section when closed polls exist', async () => {
    await act(async () => {
      renderPoll({
        listPolls: mock(() => Promise.resolve({ documents: [closedPoll] }))
      })
    })
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trip-1' } })
    })
    await waitFor(() => {
      expect(screen.getByText(/past polls/i)).toBeInTheDocument()
    })
  })

  it('shows error when listParticipatedTrips fails', async () => {
    await act(async () => {
      renderPoll({
        listParticipatedTrips: mock(() => Promise.reject(new Error('Network error')))
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/Poll.test.jsx
```

Expected: FAIL with "Cannot find module './Poll'".

- [ ] **Step 3: Implement `Poll.jsx`**

Create `src/Poll.jsx`:

```javascript
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  listParticipatedTrips as _listParticipatedTrips,
  listPolls as _listPolls,
  listProposals as _listProposals,
  listVotes as _listVotes,
  createPoll as _createPoll,
  closePoll as _closePoll,
  upsertVote as _upsertVote,
  getCoordinatorParticipant as _getCoordinatorParticipant
} from './backend'
import PollVoting from './PollVoting'
import PollResults from './PollResults'
import { colors, fonts, borders } from './theme'

export default function Poll ({
  user,
  selectedTripId: initialSelectedTripId,
  listParticipatedTrips = _listParticipatedTrips,
  listPolls = _listPolls,
  listProposals = _listProposals,
  listVotes = _listVotes,
  createPoll = _createPoll,
  closePoll = _closePoll,
  upsertVote = _upsertVote,
  getCoordinatorParticipant = _getCoordinatorParticipant
}) {
  const [trips, setTrips] = useState([])
  const [selectedTripId, setSelectedTripId] = useState(initialSelectedTripId || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activePoll, setActivePoll] = useState(null)
  const [pastPolls, setPastPolls] = useState([])
  const [proposals, setProposals] = useState([])
  const [votes, setVotes] = useState([])
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [pollsLoading, setPollsLoading] = useState(false)
  const [pollsError, setPollsError] = useState('')
  const [creatingPoll, setCreatingPoll] = useState(false)
  const [createError, setCreateError] = useState('')
  const [closingPoll, setClosingPoll] = useState(false)
  const [closeError, setCloseError] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    listParticipatedTrips(user.$id)
      .then((result) => {
        if (!mountedRef.current) return
        setTrips(result.documents)
        if (result.documents.length === 1 && !selectedTripId) {
          setSelectedTripId(result.documents[0].$id)
        }
      })
      .catch((err) => { if (mountedRef.current) setError(err.message) })
      .finally(() => { if (mountedRef.current) setLoading(false) })
  }, [user.$id])

  useEffect(() => {
    if (!selectedTripId) {
      setActivePoll(null)
      setPastPolls([])
      setProposals([])
      setVotes([])
      setIsCoordinator(false)
      return
    }
    setPollsLoading(true)
    setPollsError('')
    setCreateError('')
    setCloseError('')
    Promise.all([
      getCoordinatorParticipant(selectedTripId),
      listProposals(selectedTripId, user.$id),
      listPolls(selectedTripId, user.$id)
    ])
      .then(async ([coordResult, proposalsResult, pollsResult]) => {
        if (!mountedRef.current) return
        setIsCoordinator(
          coordResult.documents.length > 0 && coordResult.documents[0].userId === user.$id
        )
        setProposals(proposalsResult.documents)
        const open = pollsResult.documents.find((p) => p.state === 'OPEN') || null
        const past = pollsResult.documents.filter((p) => p.state === 'CLOSED')
        setActivePoll(open)
        setPastPolls(past)
        if (open) {
          const votesResult = await listVotes(open.$id, selectedTripId, user.$id)
          if (mountedRef.current) setVotes(votesResult.documents)
        }
      })
      .catch((err) => { if (mountedRef.current) setPollsError(err.message) })
      .finally(() => { if (mountedRef.current) setPollsLoading(false) })
  }, [selectedTripId, user.$id])

  const handleVoteSaved = useCallback((vote) => {
    setVotes((v) => {
      const exists = v.find((x) => x.$id === vote.$id)
      return exists ? v.map((x) => (x.$id === vote.$id ? vote : x)) : [...v, vote]
    })
  }, [])

  async function handleCreatePoll () {
    setCreatingPoll(true)
    setCreateError('')
    try {
      const poll = await createPoll(selectedTripId, user.$id)
      setActivePoll(poll)
      setVotes([])
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreatingPoll(false)
    }
  }

  async function handleClosePoll () {
    setClosingPoll(true)
    setCloseError('')
    try {
      const closed = await closePoll(activePoll.$id, user.$id)
      setActivePoll(null)
      setPastPolls((p) => [closed, ...p])
    } catch (err) {
      setCloseError(err.message)
    } finally {
      setClosingPoll(false)
    }
  }

  const hasSubmittedProposals = proposals.some((p) => p.state === 'SUBMITTED')
  const myVote = votes.find((v) => v.userId === user.$id) || null

  if (loading) return <p style={styles.message}>Loading…</p>
  if (error) return <p style={{ ...styles.message, color: colors.error }}>{error}</p>

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Poll</h2>
      </div>

      {trips.length === 0
        ? <p style={styles.message}>Join a trip first to create or vote in polls.</p>
        : (
          <select
            value={selectedTripId || ''}
            onChange={(e) => setSelectedTripId(e.target.value || null)}
            style={styles.select}
          >
            <option value=''>— Select a trip —</option>
            {trips.map((trip) => (
              <option key={trip.$id} value={trip.$id}>{trip.description || trip.code || trip.$id}</option>
            ))}
          </select>
          )}

      {pollsLoading && <p style={styles.message}>Loading poll…</p>}
      {pollsError && <p style={{ ...styles.message, color: colors.error }}>{pollsError}</p>}

      {!pollsLoading && !pollsError && selectedTripId && (
        <>
          {activePoll
            ? (
              <div style={styles.pollPanel}>
                <div style={styles.pollHeader}>
                  <span style={styles.pollStatus}>Active Poll · OPEN</span>
                  {isCoordinator && (
                    <div>
                      <button
                        onClick={handleClosePoll}
                        disabled={closingPoll}
                        style={styles.closePollButton}
                      >
                        {closingPoll ? 'Closing…' : 'Close Poll'}
                      </button>
                      {closeError && <p style={styles.errorText}>{closeError}</p>}
                    </div>
                  )}
                </div>
                <div style={styles.pollColumns}>
                  <div style={styles.pollLeft}>
                    <PollVoting
                      poll={activePoll}
                      proposals={proposals}
                      myVote={myVote}
                      userId={user.$id}
                      onVoteSaved={handleVoteSaved}
                      upsertVote={upsertVote}
                    />
                  </div>
                  <div style={styles.pollRight}>
                    <PollResults
                      poll={activePoll}
                      proposals={proposals}
                      votes={votes}
                    />
                  </div>
                </div>
              </div>
              )
            : isCoordinator && hasSubmittedProposals
              ? (
                <div style={styles.createSection}>
                  <button
                    onClick={handleCreatePoll}
                    disabled={creatingPoll}
                    style={styles.createButton}
                  >
                    {creatingPoll ? 'Creating…' : 'Create Poll'}
                  </button>
                  {createError && <p style={styles.errorText}>{createError}</p>}
                </div>
                )
              : null}

          {pastPolls.length > 0 && (
            <div style={styles.pastSection}>
              <h3 style={styles.pastHeading}>Past Polls</h3>
              {pastPolls.map((poll) => (
                <PastPoll
                  key={poll.$id}
                  poll={poll}
                  proposals={proposals}
                  tripId={selectedTripId}
                  userId={user.$id}
                  listVotes={listVotes}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PastPoll ({ poll, proposals, tripId, userId, listVotes }) {
  const [expanded, setExpanded] = useState(false)
  const [votes, setVotes] = useState([])
  const [loading, setLoading] = useState(false)

  async function handleToggle () {
    if (!expanded && votes.length === 0) {
      setLoading(true)
      try {
        const result = await listVotes(poll.$id, tripId, userId)
        setVotes(result.documents)
      } finally {
        setLoading(false)
      }
    }
    setExpanded((v) => !v)
  }

  return (
    <div style={pastStyles.container}>
      <button onClick={handleToggle} style={pastStyles.toggle}>
        Poll · CLOSED {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        loading
          ? <p style={pastStyles.loading}>Loading…</p>
          : <PollResults poll={poll} proposals={proposals} votes={votes} />
      )}
    </div>
  )
}

const styles = {
  container: {
    padding: '40px 48px',
    maxWidth: '960px',
    margin: '0 auto',
    fontFamily: fonts.body
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '80px',
    textAlign: 'center',
    fontSize: '15px'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
    paddingBottom: '20px',
    borderBottom: borders.subtle
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: '30px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.01em'
  },
  select: {
    padding: '10px 14px',
    borderRadius: '7px',
    border: borders.muted,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
    outline: 'none',
    marginBottom: '24px',
    width: '100%'
  },
  pollPanel: {
    border: borders.card,
    borderRadius: '12px',
    padding: '24px',
    background: colors.bgCard,
    marginBottom: '24px'
  },
  pollHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  pollStatus: {
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: '0.05em',
    textTransform: 'uppercase'
  },
  closePollButton: {
    padding: '7px 18px',
    borderRadius: '6px',
    border: '1px solid rgba(255,107,107,0.3)',
    background: 'transparent',
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  pollColumns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px'
  },
  pollLeft: {},
  pollRight: {},
  createSection: {
    marginBottom: '24px'
  },
  createButton: {
    padding: '10px 28px',
    borderRadius: '7px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '12px',
    margin: '6px 0 0'
  },
  pastSection: {
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: borders.subtle
  },
  pastHeading: {
    fontFamily: fonts.display,
    fontSize: '20px',
    fontWeight: '600',
    color: colors.textSecondary,
    margin: '0 0 16px'
  }
}

const pastStyles = {
  container: {
    marginBottom: '16px',
    border: borders.subtle,
    borderRadius: '8px',
    padding: '14px'
  },
  toggle: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
    cursor: 'pointer',
    padding: 0
  },
  loading: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
    margin: '10px 0 0'
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun run test src/Poll.test.jsx
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/Poll.jsx src/Poll.test.jsx
git commit -m "feat: add Poll container component"
```

---

### Task 10: Add Poll nav tab to `App`

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Write failing tests**

Add to the `describe('App', ...)` block in `src/App.test.jsx`:

```javascript
  it('shows a Poll nav tab when authenticated', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^poll$/i })).toBeInTheDocument()
    })
  })

  it('shows the Poll page when the Poll tab is clicked', async () => {
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^poll$/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /^poll$/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^poll$/i })).toBeInTheDocument()
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test src/App.test.jsx --test-name-pattern="Poll"
```

Expected: FAIL.

- [ ] **Step 3: Update `App.jsx`**

Replace the entire `src/App.jsx` with:

```javascript
import { useEffect, useState, useCallback } from 'react'
import { account as _account } from './backend'
import AuthForm from './AuthForm'
import Trips from './Trips'
import Proposals from './Proposals'
import Poll from './Poll'
import ErrorBoundary from './ErrorBoundary'
import { colors, fonts, borders } from './theme'

const defaultAccountGet = _account.get.bind(_account)
const defaultDeleteSession = _account.deleteSession.bind(_account, 'current')

function App ({
  accountGet = defaultAccountGet,
  deleteSession = defaultDeleteSession
}) {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [page, setPage] = useState('login')
  const [activePage, setActivePage] = useState('trips')
  const [proposalsSelectedTripId, setProposalsSelectedTripId] = useState(null)
  const [refreshProposalsKey, setRefreshProposalsKey] = useState(0)

  const handleJoinedTrip = useCallback(() => {
    setRefreshProposalsKey((k) => k + 1)
  }, [])

  useEffect(() => {
    accountGet()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [accountGet])

  async function handleLogout () {
    await deleteSession()
    setUser(null)
  }

  if (checking) return null

  if (!user) {
    return (
      <AuthForm
        mode={page}
        onSuccess={setUser}
        onSwitchMode={() => setPage(page === 'login' ? 'signup' : 'login')}
      />
    )
  }

  return (
    <div style={{ fontFamily: fonts.body, background: colors.bgPrimary, minHeight: '100vh' }}>
      <header style={headerStyles.bar}>
        <span style={headerStyles.wordmark}>⛷ Ski Tripper</span>
        <nav style={headerStyles.nav}>
          <button
            onClick={() => setActivePage('trips')}
            style={activePage === 'trips' ? headerStyles.navTabActive : headerStyles.navTab}
          >
            Trips
          </button>
          <button
            onClick={() => setActivePage('proposals')}
            style={activePage === 'proposals' ? headerStyles.navTabActive : headerStyles.navTab}
          >
            Proposals
          </button>
          <button
            onClick={() => setActivePage('poll')}
            style={activePage === 'poll' ? headerStyles.navTabActive : headerStyles.navTab}
          >
            Poll
          </button>
        </nav>
        <div style={headerStyles.userGroup}>
          <span style={headerStyles.name}>{user.name || user.email}</span>
          <button onClick={handleLogout} style={headerStyles.button}>
            Sign Out
          </button>
        </div>
      </header>
      {activePage === 'trips' && (
        <ErrorBoundary>
          <Trips
            user={user}
            onJoinedTrip={handleJoinedTrip}
            onViewProposals={(tripId) => {
              setProposalsSelectedTripId(tripId)
              setActivePage('proposals')
            }}
          />
        </ErrorBoundary>
      )}
      {activePage === 'proposals' && (
        <ErrorBoundary>
          <Proposals
            user={user}
            key={refreshProposalsKey}
            selectedTripId={proposalsSelectedTripId}
          />
        </ErrorBoundary>
      )}
      {activePage === 'poll' && (
        <ErrorBoundary>
          <Poll user={user} />
        </ErrorBoundary>
      )}
    </div>
  )
}

const headerStyles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 48px',
    height: '64px',
    borderBottom: borders.subtle,
    background: 'rgba(7,17,31,0.98)',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: '22px',
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: '0.02em'
  },
  userGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  name: {
    fontFamily: fonts.body,
    fontSize: '13px',
    color: colors.textSecondary,
    letterSpacing: '0.02em'
  },
  button: {
    padding: '7px 18px',
    borderRadius: '6px',
    border: borders.accent,
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  },
  nav: {
    display: 'flex',
    gap: '4px'
  },
  navTab: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  },
  navTabActive: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    background: 'rgba(59,189,232,0.12)',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  }
}

export default App
```

- [ ] **Step 4: Run all tests**

```bash
bun run test
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat: add Poll nav tab to App"
```

# Refactor

- None

# Other

- Where do the dates go? In the trip?
- A coordinator should be able to put a REJECTED proposal back to SUBMITTED (e.g. in case they made a mistake).
- Put the Overview, Proposals, Polls all into one scrollable page.

# Technical

- Check the deprecated `appwrite.databases.\*` functions in `database.js`
- Switch to TypeScript - need to have some type checking to ensure all args passed correctly

# Helper text

- In “New Trip” form, explain using text above
- In “Join Trip” form, explain using text above
- In multiple places show inline help text at the top about the current state, what could/should be done next.

# Login

- Verify email.
- Jump new user to complete their user preferences
- Forgotten password.
- Remove account? What happens to proposals, votes, etc.

# User preferences

- User profile for ski/snowboard, difficulty of slope, powder, or piste, time skiing vs eating vs apres, ...

# For a trip I am coordinating

- Set/edit the timetable of stages.

# Proposals

- Q&A feature - ask questions of the proposer, who answers (with help of AI). But they take responsibility for the answer. Uses email/messaging to prod them to answer. Log of Q&A is attached to each proposal.
- Clone a proposal (starts off in Draft). This allows a proposal to be updated.
- Have AI seed (potentially multiple) proposals which start in Draft.

# Polls

- View the votes from a closed poll

# Notifications

- Be emailed when a poll opens.
- Send reminder emails when the poll is closing (T-3, T-1)
- Ping proposers that they have a new question to answer

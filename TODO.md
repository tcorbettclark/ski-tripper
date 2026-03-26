# Refactor

- Use auto-install, remove node_modules. See: https://bun.com/docs/runtime/auto-install

# Technical

- Check the deprecated appwrite.databases.\* functions in database.js
- Switch to Typescript

# Helper text

- In “New Trip” form, explain using text above
- In “Join Trip” form, explain using text above
- In multiple places show inline help text at the top about the current state, what could/should be done next.

# Login

- Verify email.
- Jump new user to complete their user preferences
- Forgotten password.
- Remove account? What happens to proposals, votes, etc?

# User preferences

- User profile for ski/snowboard, difficulty of slope, powder or piste, time skiing vs eating vs apres, ...

# For a trip I am coordinating

- Create a new poll from selected submitted proposals.
- Set/edit the timetable of stages.

# For a trip I have joined but am not coordinating

- Clone a proposal (starts off in Draft). This allows a proposal to be updated.
- Have AI seed (potentially multiple) proposals which start in Draft.

# Polls

- Vote in an open poll, easily viewing/browsing the proposals
- View the votes from a closed poll

# Notifications

- Be emailed when a poll opens.
- Send reminder emails when the poll is closing (T-3, T-1)

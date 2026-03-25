# Refactor

- [ ] Don’t add a database entry to participate in own trips, but infer it. => Fewer database transactions and cleaner state.
- [ ] In fact, remove user id from trips and only use participants with a role. Normalises and allows multiple Coordinators in the future

# Technical
- [ ] Check the deprecated appwrite.databases.* functions in database.js
- [ ] Switch to Typescript

# Helper text

- [ ] In “New Trip” form, explain using text above
- [ ] In “Join Trip” form, explain using text above

# Login

- [ ] Verify email.
- [ ] Jump new user to complete their user preferences
- [ ] Forgotten password.
- [ ] Remove account? What happens to proposals, votes, etc?

# User preferences

- [ ] User profile for ski/snowboard, difficulty of slope, powder or piste, time skiing vs eating vs apres, ...

# For a trip I am coordinating

- [ ] Create a new poll from selected submitted proposals.
- [ ] Set/edit the timetable of stages.

# For a trip I have joined but am not coordinating

- [ ] A proposal has a state of Draft (private only to me), Submitted, Rejected (by the coordinator).
- [ ] Edit one of my proposals (must be in Draft). Once a proposal has been Submitted (or Rejected) then it is frozen forever.
- [ ] Draft a proposal with location, dates, costs, etc.
- [ ] View all non-Draft proposals (not just mine) for a given trip.
- [ ] Clone a proposal (starts off in Draft). This allows a proposal to be updated.
- [ ] Have AI seed (potentially multiple) proposals which start in Draft.

# Polls

- [ ] Vote in an open poll, easily viewing/browsing the proposals
- [ ] View the votes from a closed poll

# Notifications

- [ ] Be emailed when a poll opens.
- [ ] Send reminder emails when the poll is closing (T-3, T-1)

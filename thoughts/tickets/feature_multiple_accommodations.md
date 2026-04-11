---
type: feature
priority: medium
created: 2026-04-06T12:00:00Z
status: planned
tags: [appwrite, data-model, proposal, accommodation]
keywords: [proposal, accommodation, proposalId, approximateCost, accommodationName, accommodationUrl]
patterns: [1:N relationship, cascade delete, form validation]
---

# FEATURE-001: Allow multiple accommodations per proposal

## Description
Transition the relationship between proposals and accommodations from 1:1 to 1:N. Currently, each proposal has only one associated accommodation. This feature allows a proposer to offer multiple accommodation options (1-5) to provide flexibility for different budgets or availability.

## Context
Hotels may become unavailable or prices may change between the proposal and decision phases. Additionally, group members may have different budget preferences (some choosing cheaper options, others more expensive). 

## Requirements

### Functional Requirements
- **Data Model Change**:
    - Create an `Accommodations` table with fields: `proposalId` (link to proposal), `name`, `url`, `cost`, `description`.
    - Remove `approximateCost`, `accommodationName`, and `accommodationUrl` from the `proposals` table.
- **CRUD Operations**:
    - Allow adding, removing, and editing accommodations while a proposal is in the `DRAFT` state.
    - Accommodations must be read-only once the proposal moves out of the `DRAFT` state.
- **Validation**:
    - Minimum of 1 accommodation required to submit a proposal (move it out of `DRAFT`).
    - Maximum of 5 accommodations allowed per proposal.
- **Cascade Delete**:
    - Deleting a proposal must automatically delete all associated accommodation records.
- **UI Updates**:
    - Update the proposal form to support managing a list of accommodations.
    - Update the proposal card (in both the list view and voting view) to display accommodations in a small table layout.

### Non-Functional Requirements
- Ensure the UI remains performant with up to 5 accommodation entries per card.

## Current State
- 1:1 relationship: Proposals table contains embedded accommodation details (`approximateCost`, `accommodationName`, `accommodationUrl`).
- Only one accommodation can be specified per proposal.

## Desired State
- 1:N relationship: Separate `Accommodations` table linked via `proposalId`.
- Proposers can manage 1-5 accommodations during the `DRAFT` phase.
- Users can view multiple options in a table layout on proposal cards.

## Research Context

### Keywords to Search
- proposals - To find the existing proposal table schema and form logic.
- accommodation - To find existing UI components or logic handling accommodation data.
- proposalId - To identify foreign key implementation patterns.
- DRAFT - To find the state machine/logic that controls proposal submission.

### Patterns to Investigate
- 1:N relationships in Appwrite - How to implement and query related documents.
- Cascade delete - Appwrite's native support or manual implementation for related documents.
- Form arrays/Lists - How the UI currently handles lists to implement the new multiple-accommodation editor.

### Key Decisions Made
- **Cascade Delete**: Confirmed that deleting a proposal should delete all its accommodations.
- **Scope of Edit**: Accommodations are CRUD-able ONLY in `DRAFT` state.
- **Validation**: Hard limit of 1 minimum and 5 maximum accommodations.
- **UI Layout**: Use a small table for displaying accommodations on the proposal card.
- **No Pricing Logic**: No total cost calculation is required; costs remain associated with individual accommodations.

## Success Criteria

### Automated Verification
- [ ] Appwrite schema updated (new table created, old fields removed).
- [ ] Tests verify a proposal cannot move from `DRAFT` with 0 accommodations.
- [ ] Tests verify a proposal cannot exceed 5 accommodations.
- [ ] Tests verify cascade delete of accommodations upon proposal deletion.

### Manual Verification
- [ ] Can add/edit/remove 1-5 accommodations in the proposal form while in `DRAFT`.
- [ ] Cannot edit accommodations once the proposal is submitted.
- [ ] Proposal card displays the list of accommodations in a table layout.
- [ ] Form correctly prevents submission if 0 accommodations are present.

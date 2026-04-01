# thoughts/tickets/2026-03-28-no-web-calls-for-user-names.md

status: reviewed

## Feature: Remove separate web calls to fetch names of users

### Description

Replace the many separate web calls to appwrite to fetch the name of a user by storing their name in the corresponding appwrite collections. This will remove the small delays and simplify the code.

### Requirements

- Remove web calls to appwrite to fetch user names
- Store user names in appwrite collections
- Update the tests

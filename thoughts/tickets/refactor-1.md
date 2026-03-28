# thoughts/tickets/refactor-1.md

status: implemented

## Feature: Remove separate web calls to fetch names of users

### Description

Replace the many separate web calls to appwrite to fetch the name of a user by storing their name in the corresponding appwrite collections. This will remove the small delays and simplify the code.

### Requirements

- Remove web calls to appwrite to fetch user names
- Store user names in appwrite collections
- Update the tests

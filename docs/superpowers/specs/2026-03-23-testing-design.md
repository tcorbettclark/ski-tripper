# Testing Design — Boys Ski Organiser

**Date:** 2026-03-23
**Status:** Approved and Implemented

---

## Context

The project had zero test coverage. The goals were:

1. Lock in existing behaviour as a regression baseline
2. Establish infrastructure so new features can be built test-first

---

## Stack Decision

| Layer             | Choice                                                   | Rationale                                                      |
| ----------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| Test runner       | Bun test (built-in)                                      | Zero config, native to project's runtime                       |
| DOM environment   | happy-dom via `@happy-dom/global-registrator`            | Registered via preload before RTL loads                        |
| Component testing | `@testing-library/react` + `@testing-library/user-event` | Industry standard for React 18                                 |
| Matchers          | `@testing-library/jest-dom`                              | DOM-specific assertions (toBeInTheDocument, toHaveValue, etc.) |

---

## Key Architecture Decision: Preload Ordering

RTL's `screen` object initialises at module evaluation time and checks for `document.body`. The preload must register happy-dom globals **before** RTL is evaluated.

The fix: `test-setup.js` uses **dynamic imports** for `@testing-library/react` and `@testing-library/jest-dom/matchers`, so they load only after `GlobalRegistrator.register()` has run.

```js
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, expect } from "bun:test";

GlobalRegistrator.register(); // must come first

const matchers = await import("@testing-library/jest-dom/matchers");
const { cleanup } = await import("@testing-library/react");

expect.extend(matchers);
afterEach(cleanup);
```

---

## Mocking Strategy

- Component tests mock `./database` so they never touch the Appwrite SDK
- `App.test.jsx` mocks both `./appwrite` (for auth) and `./database` (for the Trips subtree)
- All mocks for `./appwrite` export **both** `account` and `databases` — Bun test shares the module registry across test files within a run, so consistent exports prevent "named export not found" errors
- `window.confirm` (used by EditTripForm delete) is set directly: `window.confirm = mock(() => true/false)`

---

## File Organisation

Tests are co-located next to source files:

```
src/
  test-setup.js           — preload: registers happy-dom, extends jest-dom matchers
  database.test.js        — unit tests for CRUD helpers
  Field.test.jsx
  CreateTripForm.test.jsx
  EditTripForm.test.jsx
  TripRow.test.jsx
  TripTable.test.jsx
  App.test.jsx
```

---

## Test Coverage Summary

**`database.js`** (8 tests) — verifies each CRUD function calls the right Appwrite method and propagates errors.

**`Field.jsx`** (4 tests) — renders label and input, fires onChange.

**`CreateTripForm.jsx`** (5 tests) — show/hide toggle, valid submission calls createTrip + onCreated, error display, form hides after success.

**`EditTripForm.jsx`** (6 tests) — pre-fills fields, save calls updateTrip + onUpdated, delete with confirm/cancel, cancel calls onCancel, error display.

**`TripRow.jsx`** (5 tests) — displays trip data, edit toggle, cancel returns to display mode, dash for empty description.

**`TripTable.jsx`** (3 tests) — empty state message, renders a row per trip.

**`App.jsx`** (4 tests) — shows Login when not authenticated, shows Trips when authenticated, Sign Out calls deleteSession and returns to Login.

---

## Out of Scope (Future)

- `Login.jsx` and `Signup.jsx` component tests (same pattern, lower priority)
- Real Appwrite integration tests (requires live test project credentials)
- E2E tests (Playwright)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

A ski trip management web application to support trip proposals and voting so that a group can agree on a ski holiday.

## Project Type

React + Appwrite application. Bun is the package manager, the bundler, and dev server.

## Development Commands

```bash
# Install dependencies
bun install

# Start the development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Architecture

### Tech Stack

- **React** with hooks for UI and state management
- **Appwrite** as the backend (auth + database)
- **JavaScript** only — no TypeScript

### File Structure

```
src/
  appwrite.js       — Appwrite client initialization
  database.js       — Database helper functions (CRUD operations)
  App.jsx           — Root component, auth flow, routing between Login/Signup/Trips
  Login.jsx         — Login form
  Signup.jsx        — Signup form
  Trips.jsx         — Trip list and management container
  CreateTripForm.jsx — Form for creating new trips
  EditTripForm.jsx  — Form for editing existing trips
  Field.jsx         — Reusable form field component
  TripTable.jsx     — Table display component
  TripRow.jsx       — Individual trip row component
```

### State Management

- React hooks only (`useState`, `useEffect`) — no Context API or external libraries
- Data flows via callback props (`onCreated`, `onUpdated`, `onDeleted`) to update parent state
- Form components use an `EMPTY_FORM` constant for resetting form state

### Styling

- Inline JavaScript style objects throughout — no CSS classes or CSS modules
- Base styles only in `src/index.css`
- Primary brand colour: `#fd366e` (pink) for buttons and accents
- When modifying styles, update the inline style objects in the component file

### Appwrite Prerequisites

The app requires an Appwrite instance configured with:

- A Database with a Trips collection
- Document-level permissions set per user (read/write scoped to `userId`)
- These must be created manually in the Appwrite console — nothing is auto-created

### Environment Variables

```
PUBLIC_APPWRITE_ENDPOINT=   # Appwrite API endpoint (exposed to frontend)
PUBLIC_APPWRITE_PROJECT_ID= # Appwrite project ID (exposed to frontend)
APPWRITE_API_KEY=           # Server-side API key (not prefixed, not exposed to frontend)
```

Restart the dev server after changing `.env` values.

## Testing

- Tests use Bun's test runner + React Testing Library (`@testing-library/react`)
- Run tests: `bun test`
- Test files live alongside source files (`src/*.test.jsx`, `src/database.test.js`)
- Each component test uses a `render*` helper with default no-op props; override only what the test cares about

## Do NOT

- Use TypeScript
- Add CSS files or CSS modules
- Use external state management libraries (Redux, Zustand, etc.)
- Add server-side rendering or API routes

## Troubleshooting

- **Env vars not loading**: Restart dev server after `.env` changes; frontend vars must use `VITE_` prefix
- **403 Permission errors**: Verify document-level permissions in Appwrite console match the current user's `userId`
- **Appwrite import errors**: Check that imports in `database.js` match the exports in `appwrite.js`

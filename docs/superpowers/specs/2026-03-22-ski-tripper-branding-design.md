# Ski Tripper Branding Design

**Date:** 2026-03-22
**Status:** Approved

## Overview

Add "Ski Tripper" branding to the app header and browser tab. The app currently has no name or identity — just a user email and a Sign Out button. This change gives it a recognisable name that persists across all sessions.

## Design Decisions

- **App name:** Ski Tripper
- **Style:** ⛷️ emoji prefix, name rendered in the brand pink (`#fd366e`), bold weight
- **Header layout:** wordmark on the left; user name + Sign Out button grouped on the right

## Changes

### `index.html`

Update `<title>` from `Boys Ski Organiser` to `Ski Tripper`. This ensures the browser tab, bookmark, and any shared links show the app name.

### `src/App.jsx`

Update the header bar:

- Add `⛷️ Ski Tripper` as a left-aligned `<span>` styled with `color: '#fd366e'`, `fontSize: '18px'`, `fontWeight: '700'`
- Move the existing user name `<span>` and Sign Out `<button>` into a flex group on the right, with a small gap between them

No new components. No CSS files. Inline styles only, consistent with the rest of the codebase.

## Out of Scope

- No logo image or SVG icon
- No navigation links
- No mobile/responsive changes

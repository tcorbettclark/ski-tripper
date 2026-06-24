# Manual QC Test Plan

## Setup

Open Chrome DevTools (Cmd+Option+I), then:

1. **Device mode**: Click the device toolbar icon (or Cmd+Shift+M)
2. **Device**: Select "iPhone 12 Pro" (390x844) or similar mid-range phone
3. **Network throttling**: Network tab → "Slow 3G" or "Fast 3G"
4. **CPU throttling**: Performance tab → Settings gear → CPU 4x slowdown (optional but recommended)
5. **Disable cache**: Network tab → check "Disable cache"

Keep DevTools open throughout testing. Toggle device mode off when a test specifies "desktop viewport".

---

## 1. Responsive Layout & Visual

### 1.1 Auth screens (mobile viewport)
- [ ] Login form is centred, not clipped, with readable labels
- [ ] Switch to signup — form fields still usable, no horizontal overflow
- [ ] "Forgot password" link visible and tappable
- [ ] About button (top-left) visible and not overlapping form

### 1.2 Auth screens (desktop viewport)
- [ ] Card is centred with comfortable margins (not stretched full-width)
- [ ] Toggle between login/signup is smooth, no layout shift

### 1.3 Preferences form (mobile viewport)
- [ ] Multi-step form is navigable without scrolling sideways
- [ ] Slider controls (time allocation) are tappable and visible
- [ ] All step labels and icons render correctly

### 1.4 Trips list (mobile viewport)
- [ ] Trip table cards stack vertically or are otherwise usable
- [ ] "Create trip" and "Join trip" buttons are accessible
- [ ] Invite code is readable and copyable

### 1.5 Overview tab (mobile viewport)
- [ ] Participant grid wraps or scrolls horizontally without clipping
- [ ] Invite code section is visible and copyable
- [ ] Action guide renders without overflow

### 1.6 Resorts tab (mobile viewport)
- [ ] Filter controls (tag cloud, sliders) are usable at small width
- [ ] Virtual table scrolls smoothly and columns don't overflow
- [ ] Resort detail modal fits on screen and is scrollable
- [ ] Semantic search textarea resizes correctly

### 1.7 Proposals tab (mobile viewport)
- [ ] Proposal cards stack and don't overflow
- [ ] Status filter tabs (Draft/Submitted/Rejected) are usable
- [ ] Date range picker is tappable and doesn't overflow

### 1.8 Poll/Voting tab (mobile viewport)
- [ ] Token allocation controls (increment/decrement buttons) are tappable
- [ ] Token count display is readable
- [ ] Save vote button is accessible
- [ ] Results bar chart renders correctly

### 1.9 Header (mobile viewport)
- [ ] Hamburger menu icon is visible (instead of full tabs)
- [ ] Dropdown menu works: tabs, preferences, logout are accessible
- [ ] Poll countdown timer visible if a poll is open

### 1.10 Footer auto-hide
- [ ] Scroll down any page — footer should hide during scroll
- [ ] Footer reappears ~1.5s after scrolling stops
- [ ] Footer is always visible at the bottom of short pages

---

## 2. Theme

### 2.1 Light theme consistency
- [ ] All screens render with correct light colours (no dark-on-dark text)
- [ ] Card backgrounds have subtle contrast against page background
- [ ] Accent colour (links, buttons) is consistent throughout
- [ ] Error text is visible against card backgrounds

### 2.2 Dark theme consistency
- [ ] Toggle to dark theme — all screens re-render correctly
- [ ] No white backgrounds bleeding through (modals, inputs, tables)
- [ ] Text is readable (no low-contrast grey-on-grey)
- [ ] Input fields have visible borders in dark mode
- [ ] Tag cloud badges are readable
- [ ] Piste breakdown bars are visible
- [ ] Medal colours (gold/silver/bronze) are distinguishable

### 2.3 Theme persistence
- [ ] Refresh the page — theme choice is remembered
- [ ] Open a new tab — theme choice persists

---

## 3. Client-Side ML Model Loading

### 3.1 First load (with Slow 3G throttle)
- [ ] Resorts tab shows "Loading search model..." placeholder
- [ ] After model loads, placeholder changes to "Semantic search"
- [ ] Search input becomes enabled
- [ ] No console errors during model download

### 3.2 Model failure
- [ ] If model fails to load, search shows "Search unavailable" placeholder
- [ ] Tag/slider filters still work (fallback to no semantic search)
- [ ] No unhandled promise rejection in console

---

## 4. SSE Streaming (LLM Responses)

### 4.1 Proposal analysis
- [ ] Open a submitted proposal → click "Analyse"
- [ ] "Generating..." indicator appears immediately
- [ ] Thinking content streams in (collapsible section)
- [ ] Main content streams in progressively
- [ ] Status changes to "complete" when done
- [ ] No duplicate content or missing text

### 4.2 Preference search
- [ ] Resorts tab → click sparkle button (AI search)
- [ ] Modal shows generating state
- [ ] Search query text streams in
- [ ] On completion, modal closes and search field is populated
- [ ] Results filter correctly based on generated query

### 4.3 SSE error handling
- [ ] If server returns an error, error message is displayed (not a blank/broken UI)
- [ ] Retry button / re-trigger works after an error
- [ ] Navigating away from the tab while streaming cancels the request cleanly (no memory leak)

### 4.4 Cached LLM responses
- [ ] Re-analysing the same proposal streams cached result with simulated typing
- [ ] Content is identical to the first analysis

---

## 5. Cross-Browser (Chrome specifically)

### 5.1 Date picker
- [ ] Create proposal → date range picker renders correctly
- [ ] Calendar popup is positioned correctly (not clipped)
- [ ] Can select start and end dates without issues

### 5.2 Virtual table scrolling
- [ ] Resorts table scrolls smoothly in Chrome
- [ ] Fixed header stays pinned during scroll
- [ ] Row hover highlight works
- [ ] Click on row opens detail modal

### 5.3 Input autofill
- [ ] Chrome autofill doesn't break auth form layout
- [ ] Saved passwords work correctly with login form

### 5.4 Textarea sizing
- [ ] `field-sizing: content` on search textarea works in Chrome (resizes to content)
- [ ] If not supported, textarea still has usable minimum height

---

## 6. Error States & Edge Cases

### 6.1 Network failure
- [ ] With network offline, attempt to create a trip → error message displayed
- [ ] Error message uses `formStyles.error` styling (red text, not alert/popup)
- [ ] Recovering network allows retry without page reload

### 6.2 Auth token expiry
- [ ] After 5 minutes of inactivity, auto-logout triggers
- [ ] "You have been signed out due to inactivity" message shown on login screen
- [ ] After 401 from any API call, redirected to login with session expired message
- [ ] Previous form data is not lost on re-login (where applicable)

### 6.3 Empty states
- [ ] No trips yet → helpful empty state shown (not a blank screen)
- [ ] No proposals → appropriate message in proposals tab
- [ ] No resorts data → "No resorts available" shown
- [ ] No poll open → voting tab shows "no open poll" message

### 6.4 Error boundary recovery
- [ ] If a tab component throws, the error boundary catches it
- [ ] Other tabs still work (switch away and back)
- [ ] Error boundary provides a way to recover (retry/reload)

---

## 7. Real Email Flows

*These require a running mail server (Mailpit) and checking actual emails.*

### 7.1 Email verification
- [ ] Signup → verification email arrives promptly
- [ ] Clicking verification link in email → redirects to app → user is verified
- [ ] "Resend verification" button sends another email

### 7.2 Password reset
- [ ] Forgot password → email arrives with reset link
- [ ] Clicking reset link → password reset form works
- [ ] New password is accepted for login

### 7.3 Email change
- [ ] If implemented: changing email sends confirmation to new address
- [ ] Confirm email change screen requires both token and current password

---

## 8. Discussion & Comments

### 8.1 Creating comments
- [ ] Can post a comment on a proposal
- [ ] Comment appears immediately in the thread
- [ ] System messages appear for proposal state changes (submitted, rejected, etc.)

### 8.2 Editing/deleting comments
- [ ] Can edit own comment
- [ ] Can delete own comment
- [ ] Cannot edit/delete another user's comment (button not shown)

---

## 9. Multi-User Scenarios

*Use two browser sessions (e.g. regular + incognito, or two different browsers).*

### 9.1 Real-time updates
- [ ] User A creates a proposal → User B refreshes and sees it
- [ ] User A submits a proposal → User B sees status change after refresh

### 9.2 Coordinator permissions
- [ ] Only the coordinator can create polls
- [ ] Only the coordinator can close polls
- [ ] Only the coordinator can reject/revert proposals
- [ ] Participant sees "Request submitted" or similar — no coordinator actions visible

### 9.3 Concurrent voting
- [ ] Both users can vote in the same poll
- [ ] Votes are counted independently
- [ ] After both vote, results show both sets of tokens correctly

---

## 10. Accessibility

### 10.1 Keyboard navigation
- [ ] Can Tab through all interactive elements in logical order
- [ ] Resort table rows are focusable (tabIndex on resort name column)
- [ ] Enter/Space activates focused elements
- [ ] Modal can be closed with Escape key

### 10.2 Screen reader basics
- [ ] Auth form fields have visible labels that are associated (not just placeholder text)
- [ ] Buttons have meaningful text or aria-labels
- [ ] Tab navigation has proper ARIA roles
- [ ] Error messages are associated with their form fields

### 10.3 Colour contrast
- [ ] Text on all backgrounds meets WCAG AA contrast ratio
- [ ] Interactive elements (links, buttons) are distinguishable from surrounding text
- [ ] Error states are not conveyed by colour alone

---

## 11. Performance (Slow 3G + 4x CPU throttle)

### 11.1 Initial page load
- [ ] Login/signup form is interactive within 5 seconds
- [ ] No layout shift after fonts load

### 11.2 Resort data loading
- [ ] Loading indicator shown while resort JSONL downloads
- [ ] Once loaded, resort list renders without freezing
- [ ] Scrolling the virtual table is smooth even on throttled CPU

### 11.3 ML model download
- [ ] "Loading search model..." shown during download (~25MB model)
- [ ] UI remains responsive while model downloads
- [ ] Model download completes without timing out on Slow 3G (may take 2-3 minutes)

---

## 12. Data Integrity

### 12.1 Invite code
- [ ] Three-word invite code is generated on trip creation
- [ ] Copy button copies to clipboard correctly
- [ ] Joining with the code works for a different user
- [ ] Invalid code shows an error message

### 12.2 Proposal lifecycle
- [ ] Cannot submit a proposal without at least one accommodation
- [ ] Cannot delete a submitted proposal (button hidden or disabled)
- [ ] Coordinator can reject a submitted proposal
- [ ] Coordinator can revert a rejected proposal back to draft
- [ ] Date range validation: start must be before end

### 12.3 Poll constraints
- [ ] Cannot create a poll with no submitted proposals
- [ ] Cannot vote with more tokens than allowed
- [ ] Can distribute tokens across multiple proposals
- [ ] Re-voting updates the existing vote (upsert)
- [ ] Poll results update after each vote

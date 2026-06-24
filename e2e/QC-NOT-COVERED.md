# QC Tests Not Covered by E2E Automation

This file lists tests from `QC-TEST.md` that are **not** covered by the automated Playwright e2e tests, along with the reason they cannot be automated and recommendations for manual testing.

## Section 1: Responsive Layout & Visual

| Test | Why Not Automated | Recommendation |
|------|-------------------|----------------|
| 1.10 Footer auto-hide timing (1.5s reappearance) | Timing-dependent visual behaviour; `useAutoHideFooter` hook uses scroll events which are hard to assert precisely in Playwright | Already covered by unit test in `Footer.test.tsx`. Manual check: scroll down, verify footer hides, wait ~1.5s, verify footer reappears |
| 1.6 Filter controls (tag cloud, sliders) "usable at small width" | Subjective "usable" assessment; sliders are difficult to interact with programmatically in mobile emulation | Visual inspection of screenshot captures; verify no horizontal overflow |

## Section 3: Client-Side ML Model Loading

| Test | Why Not Automated | Recommendation |
|------|-------------------|----------------|
| 3.1 First load with Slow 3G throttle | Explicitly excluded per requirements — ML model loading and network throttling not in scope for automated e2e | Manual test with Chrome DevTools Slow 3G throttle |
| 3.2 Model failure fallback | Requires intercepting a ~25MB model download and simulating failure; timing-sensitive | Manual test: block model URL in DevTools, verify "Search unavailable" fallback |

## Section 4: SSE Streaming (LLM Responses)

| Test | Why Not Automated | Recommendation |
|------|-------------------|----------------|
| 4.4 Cached LLM responses with "simulated typing" | Requires a running LLM backend and identical proposal to trigger cache; "simulated typing" speed is a visual quality assertion | Manual test: Analyse same proposal twice, verify second response streams from cache |

## Section 5: Cross-Browser (Chrome specifically)

| Test | Why Not Automated | Recommendation |
|------|-------------------|----------------|
| 5.3 Chrome autofill layout breakage | Browser autofill is an internal Chrome feature that cannot be triggered from Playwright | Manual test: save credentials in Chrome, verify autofill doesn't break layout |
| 5.4 Textarea `field-sizing: content` fallback | CSS property support detection; the e2e test checks it renders but cannot verify the exact CSS property behaviour across browsers | Manual visual check or use `page.evaluate` to check `CSS.supports('field-sizing', 'content')` |

## Section 10: Accessibility

| Test | Why Not Automated | Recommendation |
|------|-------------------|----------------|
| 10.2 Screen reader announcement order | Playwright can verify ARIA roles and labels but cannot verify screen reader output (NVDA/JAWS announcement order) | Manual test with VoiceOver (macOS) or NVDA (Windows) |
| 10.3 Colour contrast on ALL elements | axe-core covers most but custom canvas/SVG elements may need manual verification | Run `npm run test:e2e accessibility` for axe-core results; manual review any flagged elements |

## Section 11: Performance (Slow 3G + 4x CPU throttle)

| Test | Why Not Automated | Recommendation |
|------|-------------------|----------------|
| 11.1 Initial page load within 5 seconds | Playwright's `performance.timing` can measure load time but not with CPU throttling | Manual test with Chrome DevTools 4x CPU slowdown + Slow 3G |
| 11.2 Resort data loading smoothness | "Smooth" scrolling is subjective and requires CPU throttle | Manual test |
| 11.3 ML model download on Slow 3G | Explicitly excluded per requirements | Manual test |

## Section 7.3: Email Change Confirmation

| Test | Why Not Automated | Recommendation |
|------|-------------------|----------------|
| 7.3 Email change confirmation | Email change flow may not be fully implemented yet (component exists but flow unclear) | Verify implementation status; add e2e test when flow is confirmed working |

---

## Summary

| Category | Total Tests | Automated | Manual Only |
|----------|-------------|-----------|-------------|
| Responsive layout | 10 | 9 | 1 |
| Theme | 8 | 6 | 2 (visual subjectivity) |
| ML Model Loading | 4 | 0 | 4 (excluded) |
| SSE Streaming | 5 | 3 | 2 (cached LLM) |
| Cross-browser | 4 | 2 | 2 (autofill, CSS property) |
| Error states | 5 | 5 | 0 |
| Email flows | 5 | 4 | 1 (email change) |
| Discussion | 4 | 3 | 1 (other user's comment) |
| Multi-user | 4 | 3 | 1 (real-time status) |
| Accessibility | 6 | 5 | 1 (screen reader) |
| Performance | 3 | 0 | 3 (excluded) |
| Data integrity | 6 | 6 | 0 |
| **Total** | **64** | **46** | **18** |
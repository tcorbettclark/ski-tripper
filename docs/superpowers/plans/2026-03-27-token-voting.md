# Token Voting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace slider-based vote allocation in `PollVoting` with a draggable/tappable token system — a pile of coin tokens that users distribute across proposal drop zones.

**Architecture:** `PollVoting.jsx` is rewritten in place — same props, same save logic, same `allocations` state shape. New local state adds `selectedToken` for tap-select mode and `flyingTokens` for FLIP animation. Two interaction modes run simultaneously: pointer drag-and-drop (with a ghost element, works on desktop and mobile) and tap-select + tap-place (mobile-friendly click flow). FLIP animation plays on tap-place only; drag already has the ghost for visual feedback.

**Tech Stack:** React hooks (`useState`, `useRef`, `useLayoutEffect`), Pointer Events API, CSS transitions. No new dependencies.

---

## Files

- Modify: `src/PollVoting.test.jsx` — remove slider tests, add token UI + interaction tests
- Modify: `src/PollVoting.jsx` — full rewrite of rendering and interaction, save logic unchanged

---

### Task 1: Update tests for the token UI

**Files:**

- Modify: `src/PollVoting.test.jsx`

- [ ] **Step 1: Replace slider tests and add token UI + tap-select tests**

Replace the full contents of `src/PollVoting.test.jsx` with:

```jsx
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, mock } from "bun:test";
import PollVoting from "./PollVoting";

const poll = {
  $id: "poll-1",
  tripId: "trip-1",
  proposalIds: ["p-1", "p-2", "p-3"],
};
const proposals = [
  { $id: "p-1", resortName: "Chamonix" },
  { $id: "p-2", resortName: "Verbier" },
  { $id: "p-3", resortName: "Zermatt" },
];

function renderPollVoting(props = {}) {
  const defaults = {
    poll,
    proposals,
    myVote: null,
    userId: "user-1",
    onVoteSaved: mock(() => {}),
    upsertVote: mock(() => Promise.resolve({ $id: "v-new" })),
  };
  return render(<PollVoting {...defaults} {...props} />);
}

describe("PollVoting", () => {
  it("renders one token per proposal in the pile", () => {
    renderPollVoting();
    expect(screen.getAllByTestId("pile-token")).toHaveLength(3);
  });

  it("shows proposal names", () => {
    renderPollVoting();
    expect(screen.getByText("Chamonix")).toBeInTheDocument();
    expect(screen.getByText("Verbier")).toBeInTheDocument();
    expect(screen.getByText("Zermatt")).toBeInTheDocument();
  });

  it("shows total token count and remaining in the footer", () => {
    renderPollVoting();
    expect(screen.getByText(/3 tokens/i)).toBeInTheDocument();
    expect(screen.getByText(/0 placed/i)).toBeInTheDocument();
  });

  it("renders Save Vote button", () => {
    renderPollVoting();
    expect(
      screen.getByRole("button", { name: /save vote/i }),
    ).toBeInTheDocument();
  });

  it("initializes from myVote: tokens appear in the correct proposal zones", () => {
    const myVote = { proposalIds: ["p-1", "p-3"], tokenCounts: [2, 1] };
    renderPollVoting({ myVote });
    // All 3 tokens are placed — pile is empty
    expect(screen.queryAllByTestId("pile-token")).toHaveLength(0);
    expect(screen.getByText(/all tokens placed/i)).toBeInTheDocument();
    // Count badges
    expect(screen.getByTestId("count-p-1").textContent).toBe("2");
    expect(screen.getByTestId("count-p-2").textContent).toBe("0");
    expect(screen.getByTestId("count-p-3").textContent).toBe("1");
  });

  it("tap a pile token to select it — pile zone gets aria-selected", async () => {
    const user = userEvent.setup();
    renderPollVoting();
    await user.click(screen.getAllByTestId("pile-token")[0]);
    expect(screen.getByTestId("pile-zone").getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("tap a proposal after selecting from pile — token is placed", async () => {
    const user = userEvent.setup();
    renderPollVoting();
    await user.click(screen.getAllByTestId("pile-token")[0]);
    await user.click(screen.getByTestId("zone-p-1"));
    expect(screen.getByTestId("count-p-1").textContent).toBe("1");
    expect(screen.getAllByTestId("pile-token")).toHaveLength(2);
  });

  it("tap the same proposal source again — deselects without moving token", async () => {
    const user = userEvent.setup();
    renderPollVoting();
    // First place a token so we can select from a proposal
    await user.click(screen.getAllByTestId("pile-token")[0]);
    await user.click(screen.getByTestId("zone-p-1"));
    // Now select that token back
    await user.click(screen.getByTestId("zone-p-1"));
    expect(screen.getByTestId("pile-zone").getAttribute("aria-selected")).toBe(
      "false",
    );
    // Token is still on p-1
    expect(screen.getByTestId("count-p-1").textContent).toBe("1");
    // Click same zone again while it's selected = deselect
    await user.click(screen.getByTestId("zone-p-1"));
    expect(screen.getByTestId("count-p-1").textContent).toBe("1");
  });

  it("tap pile zone while a proposal token is selected — returns token to pile", async () => {
    const user = userEvent.setup();
    renderPollVoting();
    // Place a token
    await user.click(screen.getAllByTestId("pile-token")[0]);
    await user.click(screen.getByTestId("zone-p-2"));
    expect(screen.getByTestId("count-p-2").textContent).toBe("1");
    // Select it back
    await user.click(screen.getByTestId("zone-p-2"));
    // Return to pile
    await user.click(screen.getByTestId("pile-zone"));
    expect(screen.getByTestId("count-p-2").textContent).toBe("0");
    expect(screen.getAllByTestId("pile-token")).toHaveLength(3);
  });

  it("move token directly from one proposal to another", async () => {
    const user = userEvent.setup();
    renderPollVoting();
    await user.click(screen.getAllByTestId("pile-token")[0]);
    await user.click(screen.getByTestId("zone-p-1"));
    // Select from p-1
    await user.click(screen.getByTestId("zone-p-1"));
    // Place on p-2
    await user.click(screen.getByTestId("zone-p-2"));
    expect(screen.getByTestId("count-p-1").textContent).toBe("0");
    expect(screen.getByTestId("count-p-2").textContent).toBe("1");
  });

  it("calls upsertVote with non-zero allocations and calls onVoteSaved", async () => {
    const user = userEvent.setup();
    const savedVote = { $id: "v-new", proposalIds: [], tokenCounts: [] };
    const upsertVote = mock(() => Promise.resolve(savedVote));
    const onVoteSaved = mock(() => {});
    renderPollVoting({ upsertVote, onVoteSaved });
    await user.click(screen.getByRole("button", { name: /save vote/i }));
    await waitFor(() => {
      expect(upsertVote).toHaveBeenCalledWith(
        "poll-1",
        "trip-1",
        "user-1",
        [],
        [],
      );
      expect(onVoteSaved).toHaveBeenCalledWith(savedVote);
    });
  });

  it('shows "Vote saved" after successful save', async () => {
    const user = userEvent.setup();
    renderPollVoting();
    await user.click(screen.getByRole("button", { name: /save vote/i }));
    await waitFor(() => {
      expect(screen.getByText(/vote saved/i)).toBeInTheDocument();
    });
  });

  it("shows error message when upsertVote fails", async () => {
    const user = userEvent.setup();
    renderPollVoting({
      upsertVote: mock(() => Promise.reject(new Error("Vote failed"))),
    });
    await user.click(screen.getByRole("button", { name: /save vote/i }));
    await waitFor(() => {
      expect(screen.getByText("Vote failed")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests and confirm failures**

```bash
bun run test src/PollVoting.test.jsx
```

Expected: several failures — `pile-token`, `pile-zone`, `zone-p-*`, `count-p-*` testids don't exist yet (sliders still rendered).

- [ ] **Step 3: Commit failing tests**

```bash
git add src/PollVoting.test.jsx
git commit -m "test: update PollVoting tests for token UI"
```

---

### Task 2: Static token pile + drop zone layout

Replace the rendering layer in `PollVoting.jsx` with the token UI. No interaction yet — click handlers are stubs.

**Files:**

- Modify: `src/PollVoting.jsx`

- [ ] **Step 1: Replace PollVoting.jsx with token layout**

```jsx
import { useState } from "react";
import { upsertVote as _upsertVote } from "./backend";
import { colors, fonts, borders } from "./theme";

export default function PollVoting({
  poll,
  proposals,
  myVote,
  userId,
  onVoteSaved,
  upsertVote = _upsertVote,
}) {
  const proposalMap = Object.fromEntries(proposals.map((p) => [p.$id, p]));

  const [allocations, setAllocations] = useState(() => {
    const init = {};
    poll.proposalIds.forEach((id) => {
      init[id] = 0;
    });
    if (myVote) {
      myVote.proposalIds.forEach((id, i) => {
        init[id] = myVote.tokenCounts[i] || 0;
      });
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const maxTokens = poll.proposalIds.length;
  const totalUsed = Object.values(allocations).reduce((a, b) => a + b, 0);
  const remaining = maxTokens - totalUsed;

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    setSaved(false);
    const nonZeroIds = poll.proposalIds.filter((id) => allocations[id] > 0);
    try {
      const result = await upsertVote(
        poll.$id,
        poll.tripId,
        userId,
        nonZeroIds,
        nonZeroIds.map((id) => allocations[id]),
      );
      setSaved(true);
      onVoteSaved(result);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.sectionLabel}>Your tokens · {remaining} remaining</div>

      {/* Token pile */}
      <div
        data-testid="pile-zone"
        aria-selected="false"
        style={styles.pileZone}
      >
        {remaining === 0 ? (
          <span style={styles.pileEmpty}>All tokens placed</span>
        ) : (
          Array.from({ length: remaining }, (_, i) => (
            <div key={i} data-testid="pile-token" style={styles.token}>
              🪙
            </div>
          ))
        )}
      </div>

      {/* Proposals */}
      <div style={styles.proposals}>
        {poll.proposalIds.map((proposalId) => {
          const count = allocations[proposalId];
          const proposal = proposalMap[proposalId];
          return (
            <div
              key={proposalId}
              data-testid={`zone-${proposalId}`}
              data-zone={proposalId}
              style={styles.proposalCard}
            >
              <div style={styles.proposalHeader}>
                <span style={styles.proposalName}>
                  {proposal?.resortName || proposalId}
                </span>
                <span
                  data-testid={`count-${proposalId}`}
                  style={count > 0 ? styles.tokenCount : styles.tokenCountZero}
                >
                  {count}
                </span>
              </div>
              <div style={styles.dropZone}>
                {count > 0 ? (
                  Array.from({ length: count }, (_, i) => (
                    <div
                      key={i}
                      data-testid="placed-token"
                      style={styles.tokenSmall}
                    >
                      🪙
                    </div>
                  ))
                ) : (
                  <span style={styles.dropZoneHint}>drop here</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span style={styles.remaining}>
          {maxTokens} tokens · {totalUsed} placed
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          style={styles.saveButton}
        >
          {saving ? "Saving…" : "Save Vote"}
        </button>
      </div>
      {saved && <p style={styles.savedText}>Vote saved</p>}
      {saveError && <p style={styles.errorText}>{saveError}</p>}
    </div>
  );
}

const styles = {
  container: { fontFamily: fonts.body },
  sectionLabel: {
    fontSize: "11px",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: "8px",
  },
  pileZone: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    padding: "12px 14px",
    background: "rgba(59,189,232,0.04)",
    border: "1px dashed rgba(59,189,232,0.25)",
    borderRadius: "10px",
    minHeight: "58px",
    alignItems: "center",
    marginBottom: "16px",
    cursor: "pointer",
  },
  pileZoneHighlight: {
    background: "rgba(59,189,232,0.08)",
    borderColor: "rgba(59,189,232,0.45)",
  },
  pileEmpty: {
    fontSize: "12px",
    color: "rgba(106,148,174,0.5)",
  },
  token: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle at 35% 35%, rgba(59,189,232,0.3), rgba(59,189,232,0.1))",
    border: "2px solid rgba(59,189,232,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    cursor: "grab",
    userSelect: "none",
    touchAction: "none",
  },
  tokenSelected: {
    borderColor: colors.accent,
    background:
      "radial-gradient(circle at 35% 35%, rgba(59,189,232,0.5), rgba(59,189,232,0.2))",
    boxShadow: "0 0 0 3px rgba(59,189,232,0.3)",
    transform: "scale(1.12)",
  },
  tokenSmall: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle at 35% 35%, rgba(59,189,232,0.25), rgba(59,189,232,0.08))",
    border: "1.5px solid rgba(59,189,232,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    cursor: "grab",
    userSelect: "none",
    touchAction: "none",
  },
  tokenSmallSelected: {
    borderColor: colors.accent,
    boxShadow: "0 0 0 2px rgba(59,189,232,0.3)",
  },
  proposals: { display: "flex", flexDirection: "column", gap: "10px" },
  proposalCard: {
    padding: "12px 14px",
    background: colors.bgCard,
    border: borders.card,
    borderRadius: "10px",
    cursor: "pointer",
  },
  proposalCardHighlight: {
    borderColor: "rgba(59,189,232,0.45)",
    background: "rgba(59,189,232,0.05)",
  },
  proposalCardSelected: {
    borderColor: "rgba(59,189,232,0.3)",
  },
  proposalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  proposalName: { fontSize: "14px", color: colors.textData },
  tokenCount: { fontSize: "13px", color: colors.accent, fontWeight: "600" },
  tokenCountZero: {
    fontSize: "13px",
    color: "rgba(106,148,174,0.35)",
    fontWeight: "600",
  },
  dropZone: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    minHeight: "36px",
    alignItems: "center",
  },
  dropZoneHint: { fontSize: "11px", color: "rgba(106,148,174,0.3)" },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "16px",
    paddingTop: "14px",
    borderTop: borders.subtle,
  },
  remaining: { fontSize: "12px", color: colors.textSecondary },
  saveButton: {
    padding: "7px 20px",
    borderRadius: "6px",
    border: "none",
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  savedText: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: "12px",
    margin: "8px 0 0",
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: "12px",
    margin: "8px 0 0",
  },
};
```

- [ ] **Step 2: Run tests**

```bash
bun run test src/PollVoting.test.jsx
```

Expected: all tests except the tap-select interaction tests pass. The interaction tests (`tap a pile token`, `tap a proposal`, etc.) will fail because click handlers aren't wired yet.

- [ ] **Step 3: Commit**

```bash
git add src/PollVoting.jsx
git commit -m "feat: replace slider UI with static token pile and drop zones"
```

---

### Task 3: Tap-select + tap-place interaction

Wire up the click handlers for the tap-select flow.

**Files:**

- Modify: `src/PollVoting.jsx`

- [ ] **Step 1: Add `selectedToken` state and `suppressClickRef`**

Add to the state declarations section (after `const [saved, setSaved] = useState(false)`):

```js
const [selectedToken, setSelectedToken] = useState(null); // { source: 'pile' | proposalId }
const suppressClickRef = useRef(false);
```

Add the import for `useRef` (update the existing import):

```js
import { useState, useRef } from "react";
```

- [ ] **Step 2: Add click handler functions**

Add these functions before `handleSave`:

```js
function handlePileZoneClick() {
  if (suppressClickRef.current) {
    suppressClickRef.current = false;
    return;
  }
  setSaved(false);
  if (selectedToken) {
    if (selectedToken.source === "pile") {
      setSelectedToken(null);
    } else {
      setAllocations((prev) => ({
        ...prev,
        [selectedToken.source]: prev[selectedToken.source] - 1,
      }));
      setSelectedToken(null);
    }
  } else {
    if (remaining > 0) setSelectedToken({ source: "pile" });
  }
}

function handleProposalClick(proposalId) {
  if (suppressClickRef.current) {
    suppressClickRef.current = false;
    return;
  }
  setSaved(false);
  if (selectedToken) {
    const source = selectedToken.source;
    if (source === proposalId) {
      setSelectedToken(null);
    } else if (source === "pile") {
      setAllocations((prev) => ({
        ...prev,
        [proposalId]: prev[proposalId] + 1,
      }));
      setSelectedToken(null);
    } else {
      setAllocations((prev) => ({
        ...prev,
        [source]: prev[source] - 1,
        [proposalId]: prev[proposalId] + 1,
      }));
      setSelectedToken(null);
    }
  } else {
    if (allocations[proposalId] > 0) setSelectedToken({ source: proposalId });
  }
}
```

- [ ] **Step 3: Wire handlers and selection styling into the JSX**

Update the pile zone div:

```jsx
<div
  data-testid="pile-zone"
  aria-selected={selectedToken?.source === "pile" ? "true" : "false"}
  style={{
    ...styles.pileZone,
    ...(selectedToken && selectedToken.source !== "pile"
      ? styles.pileZoneHighlight
      : {}),
  }}
  data-zone="pile"
  onClick={handlePileZoneClick}
>
  {remaining === 0 ? (
    <span style={styles.pileEmpty}>All tokens placed</span>
  ) : (
    Array.from({ length: remaining }, (_, i) => (
      <div
        key={i}
        data-testid="pile-token"
        style={{
          ...styles.token,
          ...(selectedToken?.source === "pile" && i === 0
            ? styles.tokenSelected
            : {}),
        }}
      >
        🪙
      </div>
    ))
  )}
</div>
```

Update each proposal card div:

```jsx
<div
  key={proposalId}
  data-testid={`zone-${proposalId}`}
  data-zone={proposalId}
  style={{
    ...styles.proposalCard,
    ...(selectedToken && selectedToken.source !== proposalId ? styles.proposalCardHighlight : {}),
    ...(selectedToken?.source === proposalId ? styles.proposalCardSelected : {})
  }}
  onClick={() => handleProposalClick(proposalId)}
>
```

Update placed tokens to stop propagation so clicking a placed token doesn't double-fire the card handler:

```jsx
{
  count > 0 ? (
    Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        data-testid="placed-token"
        style={{
          ...styles.tokenSmall,
          ...(selectedToken?.source === proposalId && i === 0
            ? styles.tokenSmallSelected
            : {}),
        }}
      >
        🪙
      </div>
    ))
  ) : (
    <span style={styles.dropZoneHint}>drop here</span>
  );
}
```

Note: placed tokens intentionally have no `onClick` — clicks bubble to the card's `handleProposalClick` handler, which is correct behavior for both selection and placement.

- [ ] **Step 4: Run tests**

```bash
bun run test src/PollVoting.test.jsx
```

Expected: all tests pass.

- [ ] **Step 5: Lint**

```bash
bun run lint
```

Fix any reported issues.

- [ ] **Step 6: Commit**

```bash
git add src/PollVoting.jsx
git commit -m "feat: add tap-select and tap-place token interaction"
```

---

### Task 4: Pointer drag-and-drop

Add drag with a ghost element. Uses the Pointer Events API so the same code handles mouse and touch. Uses refs for all drag state so global event listeners stay stable.

**Files:**

- Modify: `src/PollVoting.jsx`

- [ ] **Step 1: Add drag refs**

Add after `suppressClickRef`:

```js
const dragRef = useRef(null); // { source, startX, startY, moved }
const ghostRef = useRef(null);
const remainingRef = useRef(remaining);
remainingRef.current = remaining;
```

- [ ] **Step 2: Add global pointer event listeners via `useLayoutEffect`**

Add this after the state declarations, before `handlePileZoneClick`. Also add `useLayoutEffect` to the import:

```js
import { useState, useRef, useLayoutEffect } from "react";
```

```js
useLayoutEffect(() => {
  function onPointerMove(e) {
    if (!dragRef.current) return;
    const { startX, startY } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!dragRef.current.moved && Math.sqrt(dx * dx + dy * dy) > 8) {
      dragRef.current.moved = true;
      const ghost = document.createElement("div");
      ghost.textContent = "🪙";
      Object.assign(ghost.style, {
        position: "fixed",
        width: "38px",
        height: "38px",
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 35% 35%, rgba(59,189,232,0.4), rgba(59,189,232,0.15))",
        border: "2px solid rgba(59,189,232,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
        lineHeight: "1",
        pointerEvents: "none",
        zIndex: "9999",
        transform: "translate(-50%, -50%) scale(1.2)",
        transition: "transform 0.1s",
      });
      document.body.appendChild(ghost);
      ghostRef.current = ghost;
    }

    if (ghostRef.current) {
      ghostRef.current.style.left = `${e.clientX}px`;
      ghostRef.current.style.top = `${e.clientY}px`;
    }
  }

  function onPointerUp(e) {
    if (!dragRef.current) return;
    const { source, moved } = dragRef.current;
    dragRef.current = null;

    if (ghostRef.current) {
      document.body.removeChild(ghostRef.current);
      ghostRef.current = null;
    }

    if (!moved) return; // tap — let the click event fire

    suppressClickRef.current = true;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const zoneEl = el?.closest("[data-zone]");
    const target = zoneEl?.dataset?.zone;

    if (!target || target === source) return;

    if (target === "pile") {
      if (source !== "pile") {
        setAllocations((prev) => ({ ...prev, [source]: prev[source] - 1 }));
        setSaved(false);
      }
    } else if (source === "pile") {
      if (remainingRef.current > 0) {
        setAllocations((prev) => ({ ...prev, [target]: prev[target] + 1 }));
        setSaved(false);
      }
    } else {
      setAllocations((prev) => ({
        ...prev,
        [source]: prev[source] - 1,
        [target]: prev[target] + 1,
      }));
      setSaved(false);
    }
  }

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  return () => {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  };
}, []); // stable — uses refs for current state values
```

- [ ] **Step 3: Add `startDrag` helper and attach `onPointerDown` to tokens**

Add before `handleSave`:

```js
function startDrag(e, source) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  dragRef.current = {
    source,
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
  };
}
```

Update pile tokens to attach `onPointerDown`:

```jsx
<div
  key={i}
  data-testid="pile-token"
  style={{
    ...styles.token,
    ...(selectedToken?.source === "pile" && i === 0
      ? styles.tokenSelected
      : {}),
  }}
  onPointerDown={(e) => startDrag(e, "pile")}
>
  🪙
</div>
```

Update placed tokens to attach `onPointerDown` (also stop propagation to prevent card click):

```jsx
<div
  key={i}
  data-testid="placed-token"
  style={{
    ...styles.tokenSmall,
    ...(selectedToken?.source === proposalId && i === 0
      ? styles.tokenSmallSelected
      : {}),
  }}
  onPointerDown={(e) => {
    e.stopPropagation();
    startDrag(e, proposalId);
  }}
>
  🪙
</div>
```

- [ ] **Step 4: Run tests**

```bash
bun run test src/PollVoting.test.jsx
```

Expected: all tests still pass. (Pointer drag isn't easily unit tested in happy-dom; it's covered by manual testing.)

- [ ] **Step 5: Manual smoke test**

Run `bun run dev` and verify:

- Drag a token from the pile onto a proposal — it appears in the drop zone
- Drag a token from one proposal directly to another — source decrements, target increments
- On a touch device (or browser DevTools touch simulation), verify the same drag gestures work

- [ ] **Step 6: Lint**

```bash
bun run lint
```

- [ ] **Step 7: Commit**

```bash
git add src/PollVoting.jsx
git commit -m "feat: add pointer drag-and-drop for token placement"
```

---

### Task 5: FLIP flight animation for tap-place

When a token is placed via tap-select, animate it flying from its source position to its destination. Uses the FLIP technique: capture source rect before state update, capture target rect in `useLayoutEffect`, render a fixed-position clone that transitions between them.

**Files:**

- Modify: `src/PollVoting.jsx`

- [ ] **Step 1: Add `FlyingToken` component at the bottom of `PollVoting.jsx`**

Append after the `styles` object:

```jsx
function FlyingToken({ from, to, onDone }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    // Invert: snap back to start with no transition
    ref.current.style.transition = "none";
    ref.current.style.transform = "none";

    // Play: next two frames ensure the browser has painted the inverted position
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!ref.current) return;
        const dx = to.cx - from.cx;
        const dy = to.cy - from.cy;
        const scale = to.size / from.size;
        ref.current.style.transition = "transform 280ms ease-out";
        ref.current.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      });
    });
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: from.cx - from.size / 2,
        top: from.cy - from.size / 2,
        width: from.size,
        height: from.size,
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 35% 35%, rgba(59,189,232,0.3), rgba(59,189,232,0.1))",
        border: "2px solid rgba(59,189,232,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${from.size * 0.47}px`,
        pointerEvents: "none",
        zIndex: 9999,
      }}
      onTransitionEnd={onDone}
    >
      🪙
    </div>
  );
}
```

- [ ] **Step 2: Add flight state and refs**

Add to the state declarations section:

```js
const [flyingTokens, setFlyingTokens] = useState([]);
const [flightTrigger, setFlightTrigger] = useState(0);
const flyIdRef = useRef(0);
const pendingFlightRef = useRef(null); // { fromRect, target: proposalId | 'pile' }
const pileZoneRef = useRef(null);
const zoneRefs = useRef({}); // { [proposalId]: DOM element }
```

- [ ] **Step 3: Add FLIP `useLayoutEffect`**

Add this after the global pointer event `useLayoutEffect`:

```js
useLayoutEffect(() => {
  const pending = pendingFlightRef.current;
  if (!pending?.fromRect) return;
  pendingFlightRef.current = null;

  let toRect;
  if (pending.target === "pile") {
    const pileTokens = pileZoneRef.current?.querySelectorAll(
      '[data-testid="pile-token"]',
    );
    toRect =
      pileTokens?.[0]?.getBoundingClientRect() ??
      pileZoneRef.current?.getBoundingClientRect();
  } else {
    const zoneEl = zoneRefs.current[pending.target];
    const placed = zoneEl?.querySelectorAll('[data-testid="placed-token"]');
    toRect =
      placed?.[placed.length - 1]?.getBoundingClientRect() ??
      zoneEl?.getBoundingClientRect();
  }

  if (!toRect) return;

  const id = ++flyIdRef.current;
  setFlyingTokens((prev) => [
    ...prev,
    {
      id,
      from: {
        cx: pending.fromRect.left + pending.fromRect.width / 2,
        cy: pending.fromRect.top + pending.fromRect.height / 2,
        size: pending.fromRect.width,
      },
      to: {
        cx: toRect.left + toRect.width / 2,
        cy: toRect.top + toRect.height / 2,
        size: toRect.width,
      },
    },
  ]);
}, [flightTrigger]);
```

- [ ] **Step 4: Add rect-capture helpers**

Add before `handleSave`:

```js
function capturePileTokenRect() {
  const tokens = pileZoneRef.current?.querySelectorAll(
    '[data-testid="pile-token"]',
  );
  return tokens?.[0]?.getBoundingClientRect() ?? null;
}

function captureZoneTokenRect(proposalId) {
  const tokens = zoneRefs.current[proposalId]?.querySelectorAll(
    '[data-testid="placed-token"]',
  );
  return tokens?.[0]?.getBoundingClientRect() ?? null;
}
```

- [ ] **Step 5: Update `handlePileZoneClick` and `handleProposalClick` to trigger FLIP**

Replace the existing `handlePileZoneClick`:

```js
function handlePileZoneClick() {
  if (suppressClickRef.current) {
    suppressClickRef.current = false;
    return;
  }
  setSaved(false);
  if (selectedToken) {
    if (selectedToken.source === "pile") {
      setSelectedToken(null);
    } else {
      const fromRect = captureZoneTokenRect(selectedToken.source);
      pendingFlightRef.current = { fromRect, target: "pile" };
      setAllocations((prev) => ({
        ...prev,
        [selectedToken.source]: prev[selectedToken.source] - 1,
      }));
      setFlightTrigger((v) => v + 1);
      setSelectedToken(null);
    }
  } else {
    if (remaining > 0) setSelectedToken({ source: "pile" });
  }
}
```

Replace the existing `handleProposalClick`:

```js
function handleProposalClick(proposalId) {
  if (suppressClickRef.current) {
    suppressClickRef.current = false;
    return;
  }
  setSaved(false);
  if (selectedToken) {
    const source = selectedToken.source;
    if (source === proposalId) {
      setSelectedToken(null);
    } else {
      const fromRect =
        source === "pile"
          ? capturePileTokenRect()
          : captureZoneTokenRect(source);
      pendingFlightRef.current = { fromRect, target: proposalId };
      if (source === "pile") {
        setAllocations((prev) => ({
          ...prev,
          [proposalId]: prev[proposalId] + 1,
        }));
      } else {
        setAllocations((prev) => ({
          ...prev,
          [source]: prev[source] - 1,
          [proposalId]: prev[proposalId] + 1,
        }));
      }
      setFlightTrigger((v) => v + 1);
      setSelectedToken(null);
    }
  } else {
    if (allocations[proposalId] > 0) setSelectedToken({ source: proposalId });
  }
}
```

- [ ] **Step 6: Attach refs and render flying clones in JSX**

Add `ref={pileZoneRef}` to the pile zone div:

```jsx
<div
  ref={pileZoneRef}
  data-testid='pile-zone'
  aria-selected={selectedToken?.source === 'pile' ? 'true' : 'false'}
  ...
>
```

Add `ref` callback to each proposal card div (inside the `poll.proposalIds.map`):

```jsx
<div
  key={proposalId}
  ref={(el) => { zoneRefs.current[proposalId] = el }}
  data-testid={`zone-${proposalId}`}
  ...
>
```

Render flying clones at the top of the returned JSX, before the section label:

```jsx
return (
  <div style={styles.container}>
    {flyingTokens.map((ft) => (
      <FlyingToken
        key={ft.id}
        from={ft.from}
        to={ft.to}
        onDone={() =>
          setFlyingTokens((prev) => prev.filter((f) => f.id !== ft.id))
        }
      />
    ))}
    <div style={styles.sectionLabel}>Your tokens · {remaining} remaining</div>
    ...
  </div>
);
```

- [ ] **Step 7: Run tests**

```bash
bun run test src/PollVoting.test.jsx
```

Expected: all tests pass. (`getBoundingClientRect` returns zeros in happy-dom, so `pendingFlightRef` will set `fromRect` to a zero rect. The FLIP useLayoutEffect will get zero `toRect` as well and bail early — no crash, no animation in tests, which is fine.)

- [ ] **Step 8: Manual smoke test**

Run `bun run dev` and verify:

- Tap-select a pile token, tap a proposal — token animates flying from pile to the drop zone
- Tap-select a placed token, tap another proposal — token animates flying between drop zones
- Tap-select a placed token, tap the pile zone — token animates flying back to the pile
- Animation is smooth at ~280ms, token lands at the correct destination
- After animation completes, the flying clone disappears cleanly (no leftover elements)

- [ ] **Step 9: Lint and format**

```bash
bun run lint && bun run format
```

- [ ] **Step 10: Commit**

```bash
git add src/PollVoting.jsx
git commit -m "feat: add FLIP flight animation for tap-place token movement"
```

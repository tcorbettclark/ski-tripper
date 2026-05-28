[![Bun CI](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml/badge.svg)](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml)

# About

Ski Tripper - a collaborative ski trip planning application to try to cut down on the chaos.

Dead simple onboarding:
  - signup with your email
  - set your personal skiing preferences once (skill level, on/off-piste, time split between slopes/eating/après/chill) so the group sees what kind of trip everyone wants.
  - one person (who becomes the "coordinator") creates a trip and asks friends to join via a simple three-word code.

Browse thousands of resorts in one place:
  - use a fast, searchable, filterable database packed with detail: piste km, altitude range, snow reliability, transfer times, difficulty levels, and more.
  - view as a map or list (PENDING)

Propose to discuss and refine:
  - create resort proposals with dates, rich descriptions, and linked accommodation options (cost, links, notes)
  - discuss and ask questions in a threaded comment section.
  - submit for voting

Weighted token voting, not just one pick:
  - the "coordinator" creates a poll from submitted proposals
  - AI scored match between proposals and user preferences (PENDING)
  - everyone distributes their votes across proposals (e.g. 3 tokens on your favourite, 1 on your backup) so the group's nuanced preferences actually surface.

Guided "what next?" prompts:
  - the app reads the trip's state and tells each person exactly what to do (submit your draft, comment on proposals, vote before the poll closes) so nobody gets lost.

# Development

Configured for OpenCode development.

Use the [WorkTrunk](https://worktrunk.dev/) tool to manage git worktrees. Some convenient aliases and hooks have been added to `.config/wt.toml`, resulting in the following workflow:

| Task                                                    | Example shell alias | Command                         |
| ------------------------------------------------------- | ------------------- | ------------------------------- |
| New worktree with `.env` and packages installed         | `wtn <worktree>`    | `wt switch --create <worktree>` |
| Remove a worktree and clean everything up               | `wtr <worktree>`    | `wt remove <worktree>`          |
| List all worktrees with their status                    | `wtl`               | `wt list`                       |
| Run the dev server on a port unique to current worktree | `wtd`               | `wt step dev-server`            |
| Merge current worktree back to main                     | `wtm`               | `wt step merge-and-continue`    |
| Sync main back to all worktrees                         | `wts`               | `wt step sync-all-from-main`    |

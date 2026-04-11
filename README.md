[![Bun CI](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml/badge.svg)](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml)

# Development

Configured for OpenCode development.

Use the [WorkTrunk](https://worktrunk.dev/) tool to manage git worktrees. Some convenient aliases and hooks have been added to `.config/wt.toml`, resulting in the following workflow:

| Task | Command |
|------|---------|
| Start a new worktree | `wt switch --create alice` with `.env` and packages installed |
| End a worktree | `wt remove alice`, cleaning everything up |
| Display list of worktrees and their status | `wt list` |
| Start the dev server on a port unique to the worktree | `wt step dev-server` |
| Sync a worktree back to main | `wt step merge-and-continue` |
| Sync main back to all worktrees | `wt step sync-all-from-main` |

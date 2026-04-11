[![Bun CI](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml/badge.svg)](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml)

# Development

Configured for OpenCode development.

Use the [WorkTrunk](https://worktrunk.dev/) tool to manage git worktrees. Some convenient aliases and hooks have been added to `.config/wt.toml`, resulting in the following workflow:

| Task | Command |
|------|---------|
| Start a new worktree  with `.env` and packages installed | `wt switch --create alice` |
| End a worktree and clean everything up | `wt remove alice` |
| Display list of worktrees and their status | `wt list` |
| Start the dev server on a port unique to the worktree | `wt step dev-server` |
| Sync a worktree back to main | `wt step merge-and-continue` |
| Sync main back to all worktrees | `wt step sync-all-from-main` |

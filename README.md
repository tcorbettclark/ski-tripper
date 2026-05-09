[![Bun CI](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml/badge.svg)](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml)

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

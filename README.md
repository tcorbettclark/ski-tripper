[![Bun CI](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml/badge.svg)](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml)

# About

Ski Tripper - a collaborative ski trip planning application to try to cut down on the chaos.

Dead simple onboarding:
  - signup with your email.
  - set your personal skiing preferences once (skill level, on/off-piste, time split between slopes/eating/après/chill) so the group participants, and AI - see below, can see the kind of trip you like.
  - one person (the nominated "coordinator") creates a trip and asks friends to join via a simple three-word code.

Browse thousands of resorts in one place:
  - use a fast, searchable, filterable database packed with detail: piste km, altitude range, snow reliability, transfer times, difficulty levels, and more.
  - use the built-in AI assistant to query text generation, which uses everybody's preferences to suggest the best resorts for the trip.

Propose to discuss and refine:
  - create resort proposals with dates, descriptions, and linked accommodation options (cost, links, notes).
  - discuss and ask questions in a threaded comment section.
  - use the built-in AI assistant to describe suitability of each proposal against the likes and dislikes of the participants.
  - submit for voting.

Weighted token voting, not just one pick:
  - the "coordinator" creates a poll from submitted proposals.
  - everyone distributes their votes across proposals (e.g. 3 tokens on your favourite, 1 on your backup).

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

Testing is done with unit testing and [Playwright](https://playwright.dev/) + [Mailpit](https://mailpit.axllent.org/) for exploratory testing.

# Architecture

- [Caddy](https://caddyserver.com/) for reverse proxy and SSL termination.
- [PocketBase](https://pocketbase.io/) for the backend database and authentication.
- [Resend](https://resend.com/) for email delivery.
- A small typescript server to run the backend LLM functions.

# Hosting

The app runs on a single 1G DigitalOcean droplet (Ubuntu 24.04) with three systemd services:

| Service | User | Description |
|---------|------|-------------|
| `caddy` | `caddy` | Reverse proxy and TLS termination (ports 80/443) |
| `ski-tripper-pb` | `ski-tripper` | PocketBase (localhost:8090) |
| `ski-tripper-api` | `ski-tripper` | Custom Bun API server (localhost:5173) |

No Docker involved — everything runs natively on the host.

Provisioning is automated (`bun run provision`), which uses [xec](https://xec.sh/) scripts to SSH into the server, pull the latest code, build, and restart services.

| Command | Description |
|---------|-------------|
| `bun run infra:provision create` | Create a DigitalOcean droplet |
| `bun run infra:provision configure` | Install deps and set up systemd services on an existing droplet |
| `bun run infra:provision deploy` | Pull latest code, build, restart services |
| `bun run infra:provision setup` | Create droplet, configure, and deploy (full setup) |
| `bun run infra:provision destroy` | Delete the droplet |

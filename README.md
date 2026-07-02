[![CI](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml/badge.svg)](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml)

For user facing overview, see [ABOUT.md](ABOUT.md). This README provides a brief overview of the technical stack, architecture, development practices, and provisioning.

## Architecture

- [React](https://react.dev/) for the frontend UI application.
- [PocketBase](https://pocketbase.io/) for the backend database and authentication.
- [Resend](https://resend.com/) for email delivery.
- [Caddy](https://caddyserver.com/) for reverse proxy and SSL termination.
- A bun/typescript server to run the backend LLM functions using a cloud LLM provider.

## Coding Agent

Lightly configured for development using the [OpenCode](https://opencode.ai/) coding agent. I run it inside [Zed](https://zed.dev/).

## Worktree Management

Use the [WorkTrunk](https://worktrunk.dev/) tool to manage git worktrees. Some convenient aliases and hooks have been added to `.config/wt.toml`, resulting in the following workflow:

| Task                                            | Shell alias      | Command                              |
| ----------------------------------------------- | ---------------- | ------------------------------------ |
| New worktree with packages installed            | `wtn <worktree>` | `wt switch --create <worktree>`      |
| Remove a worktree and clean everything up       | `wtr <worktree>` | `wt remove <worktree>`               |
| List all worktrees with their status            | `wtl`            | `wt list`                            |
| Merge current worktree back to main             | `wtm`            | `wt merge-and-continue`              |
| Sync main back to all worktrees                 | `wts`            | `wt sync-all-from-main`              |
| Push main (commits + annotated tags) to origin  | `wtp`            | `git push --follow-tags origin main` |

## Environment variables

Environment variables are managed with [dotenvx](https://dotenvx.com/), which provides public-key encryption for secrets committed to the repository.

Three env files are committed:

| File            | Purpose                                               | Encrypted keys                                                    |
| --------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `.env.common`   | Keys identical in dev and prod (no secrets)           | None                                                              |
| `.env.dev`      | Dev-specific values and secrets                       | `POCKETBASE_ADMIN_PASSWORD`, `EXA_API_KEY`, `OLLAMA_API_KEY`      |
| `.env.prod`     | Prod-specific values and secrets                      | `POCKETBASE_ADMIN_PASSWORD`, `POCKETBASE_SMTP_PASSWORD`, `OLLAMA_API_KEY` |

The `.env.keys` file (gitignored) holds the private decryption keys.

**Env management:**

| Command                    | Description                                        |
| -------------------------- | -------------------------------------------------- |
| `bun run env:encrypt`      | Encrypt secrets in `.env.dev` and `.env.prod`      |
| `bun run env:dev <cmd>`    | Run any command with dev env vars loaded           |
| `bun run env:prod <cmd>`   | Run any command with prod env vars loaded          |

After changing plaintext values in `.env.dev` or `.env.prod`, re-encrypt with `bun run env:encrypt`.

A githook, configured with [lefthook](https://github.com/evilmartians/lefthook), helps to avoid accidentally committing plaintext secrets.

Tip: Put the `.env.keys` in fish universal variables to make them available across worktrees.

## Development build

**Dev scripts** use `env:dev` to inject variables via dotenvx:

| Command                              | Description                                           |
| ------------------------------------ | ----------------------------------------------------- |
| `bun run dev`                        | Start the full dev environment                        |
| `bun run dev:client`                 | Watch-build client with dev env vars inlined          |
| `bun run dev:server`                 | Watch-run server with dev env vars                    |
| `bun run dev:pb`                     | Run PocketBase with dev env vars                      |
| `bun run dev:pb:config`              | Configure local PocketBase settings                   |
| `bun run dev:pb:create-superuser`    | Create/upsert local PocketBase superuser              |
| `bun run dev:caddy`                  | Run Caddy reverse proxy (with log wrapper)            |
| `bun run dev:caddy:debug`            | Run Caddy reverse proxy with debug logging            |
| `bun run dev:caddy:setup-certs`      | Trust Caddy's local CA certificates                   |
| `bun run dev:mailpit`                | Run Mailpit email test server                         |
| `bun run dev:pb:reset-and-squash`    | Reset and squash PocketBase migrations                |

**Build scripts** read env vars from `process.env` (no dotenvx wrapper) so they work in production where env vars are passed inline:

| Command                      | Description                                               |
| ---------------------------- | --------------------------------------------------------- |
| `bun run build`              | Build client, server, static files, and Caddyfile         |
| `bun run build:client`       | Build client bundle (inlines `PUBLIC_*` env vars)         |
| `bun run build:server`       | Compile server to standalone binary                       |
| `bun run build:static`       | Copy static files and migrations to dist                  |
| `bun run build:caddy`        | Generate Caddyfile from template and env vars             |
| `bun run generate:about`     | Compile ABOUT.md into src code for bundling               |

## Testing

Type checking: `bun run check`. To fix type errors: `bun run check:fix`.

Usual collection of unit tests: `bun run test`. These are standalone and do not require the dev server to be running.

End-to-end tests use [Playwright](https://playwright.dev/) + [Mailpit](https://mailpit.axllent.org/). Invoke with: `bun run test:e2e`. This needs the dev server to be running (`bun run dev`). These tests have been generated with the "AI-first" playwright agent approach, setup with: `bun run playwright init-agents --loop=opencode`.

A smoke test, `bun run test:smoke`, verifies the app is installed correctly **in production** (unlike the other tests above which run on the dev box). It contains both automatic and manual checks.

## Versioning

Versioning follows [Semantic Versioning](https://semver.org/), best managed with `bun pm version patch|minor|major` to clock the version in the source and create an annotated tag. The `wtp` alias then pushes commits and tags to GitHub ready for provisioning.

## Hosting

The app runs fine on a single 1G [DigitalOcean droplet](https://www.digitalocean.com/products/droplets/) (Ubuntu 24.04) with three [systemd services](https://www.freedesktop.org/wiki/Software/systemd/):

| Service           | User          | Description                                      |
| ----------------- | ------------- | ------------------------------------------------ |
| `caddy`           | `caddy`       | Reverse proxy and TLS termination (ports 80/443) |
| `ski-tripper-pb`  | `ski-tripper` | PocketBase (localhost:8090)                      |
| `ski-tripper-api` | `ski-tripper` | Custom Bun API server (localhost:5173)           |

No Docker involved — everything runs natively on the host.

## Provisioning

Provisioning is automated and idempotent. Run from the dev box. It uses [xec](https://xec.sh/) scripts to SSH into the server, pull the latest code, build, and restart services etc.

| Command                             | Description                                                             |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `bun run infra:provision create`    | Create a droplet and reserved IP (idempotent)                           |
| `bun run infra:provision configure` | Install dependencies and set up systemd services on an existing droplet |
| `bun run infra:provision destroy`   | Unassign IP and delete the droplet (preserves the reserved IP)          |
| `bun run infra:deploy`              | Pull latest code, build, and restart services (default branch: main)    |
| `bun run infra:status`              | Show service status, IP, and layout info                                |
| `bun run infra:mode`                | Enable / disable the PocketBase admin interface                         |
| `bun run infra:ssh`                 | SSH into the production server                                          |

## Server file layout

| Path                                                                 | Description                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/home/ski-tripper/ski-tripper/`                                     | Git repository                                                      |
| `/opt/ski-tripper/`                                                  | Installed app (`static/`, `server/serve`, `pb_migrations/`)         |
| `/var/lib/ski-tripper/pb_data/`                                      | PocketBase data                                                     |
| `/etc/caddy/Caddyfile`                                               | Caddy configuration                                                 |
| `/usr/local/bin/{bun,caddy,pocketbase}`                              | Binaries                                                            |
| `/etc/systemd/system/{ski-tripper-pb,ski-tripper-api,caddy}.service` | Systemd units                                                       |

## Server logs

Logs from the 3 services (Caddy, PocketBase, and API server) go to `journalctl`.

SSH into the server with `bun run infra:ssh` (or `doctl compute ssh ski-tripper`), then:

| Service    | Command                         |
| ---------- | ------------------------------- |
| Caddy      | `journalctl -u caddy`           |
| PocketBase | `journalctl -u ski-tripper-pb`  |
| API server | `journalctl -u ski-tripper-api` |

## Backups

PocketBase supports full data backups via its HTTP API. Backups are created on the production server, downloaded locally to `infra/backups/`, and can be restored to production or loaded into the dev environment.

Backup filenames use the format `YYYY-MM-DD_HH-MM-SS.zip` (e.g. `2026-03-02_14-34-03.zip`). The `list-backups` command shows record counts for each collection inside each backup.

| Command                                            | Description                                                |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `bun run infra:backup`                             | Create a backup on prod and download it locally            |
| `bun run infra:restore <prefix>`                    | Restore a backup to production (replaces all PB data)       |
| `bun run infra:list-backups`                       | List local backups with record counts per collection        |
| `bun run infra:load-backup <prefix>`               | Load a backup into the dev environment (stops if PB running)|

The `backup` and `restore` commands use `env:prod` automatically. The `load-backup` and `list-backups` commands work locally with no env prefix needed.

## Resort data

The resort catalogue is generated offline via a pipeline and uploaded to PocketBase. Hence, adding or improving the resort catalogue does not involve any server-side changes or changes to the source code.

The tool, `bun run tools:resorts`, has six sub-commands: `seed`, `enrich`, `audit`, `encode`, `build`, and `upload`.

| Stage      | Input                                               | Output           | What happens                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | --------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Seed**   | OpenSkiMap CSVs (ski areas, lifts, runs)            | `seeded.jsonl`   | Download & cache CSVs; filter for operating downhill resorts with ≥5 km pistes and ≥1 non-surface lift; compute difficulty percentages from run data; map countries to 17 ski regions; generate slug IDs                                                                                                                                                                                          |
| **Enrich** | `seeded.jsonl` + Exa web search + Ollama LLM        | `enriched.jsonl` | For each resort, run 4 parallel Exa searches (authoritative ski sources, general, airports, linked resorts); feed results to an LLM to extract descriptions (terrain, off-piste, value, family, après-ski, lift system), airport/transfer, snow reliability, and season; a separate LLM audits for contradictions with seeded numeric fields and corrects them; URLs are cleaned and deduplicated |
| **Audit**  | `enriched.jsonl`                                    | quality reports  | Check for empty/low-quality fields, invalid values, orphans, and duplicates                                                                                                                                                                                                                                                                                                                       |
| **Encode** | `enriched.jsonl`                                    | `encoded.jsonl`  | Concatenate name, country, region, and all enriched descriptions into search text; generate embeddings using `Xenova/multi-qa-MiniLM-L6-cos-v1`                                                                                                                                                                                                                                                   |
| **Build**  | `seeded.jsonl` + `enriched.jsonl` + `encoded.jsonl` | `all.jsonl`      | Merge seeded and enriched data (enriched overrides numeric fields if corrected by audit); build a combined description; flatten into a single record per resort                                                                                                                                                                                                                                   |
| **Upload** | `all.jsonl`                                         | PocketBase file  | Upload the full JSONL as a single file attachment to PocketBase, replacing previous records.                                                                                                                                                                                                                                                                                                      |

[![CI](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml/badge.svg)](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml)

# Ski Tripper

## What is this?

Ski Tripper helps a ski group find and agree on the perfect ski holiday without the "entertaining" chaos of a WhatsApp debate.

Unlike booking sites that start with flights and hotels, Ski Tripper starts with what really matters: the mountain experience and resort vibe.

* **The Trip**: This is your group's shared space (e.g., "Boys Ski 2027"). It's the central hub where everyone gathers ideas and votes.
* **The Profile**: Everyone in your group declares their preferences (high altitude, great après, off-piste terrain, etc). The AI-powered catalog then ranks options against your combined group profile.
* **The Proposal**: Anyone can pitch a specific proposal for the Trip. You pick a resort that fits the group, align dates around mountain events, and drop in lodging options so friends can choose between premium hotels or budget-friendly apartments.
* **The Decision**: Once a selection of promising options is locked in, your group votes in rounds until a clear winner emerges.

_(Ski Tripper doesn't book any flights or hotels. Platforms like [Heidi](https://www.heidi.com/), [Igluski](https://www.igluski.com), [Crystal Ski](https://www.crystalski.co.uk), or [Hotels](https://www.hotels.com) are still good to help scout specific lodgings. But Ski Tripper is where your group discovers and agrees on great ski destinations!)_

## How does it work?

### 1. Low-Friction Onboarding
- **Quick Sign-Up:** Everyone creates an account with just an email.
- **Set Your Skier Profile:** Input your skill level, terrain preference (on/off-piste), and how you split your day between leg-burning slope time, long lunches, après, or chilling in the spa. This shares with your friends (and the AI assistant) what makes a perfect holiday for you.
- **Gather the Crew:** The group "coordinator" creates a **Trip** space and shares a simple three-word invite code to bring everyone in.

### 2. Browse Thousands of Resorts
- **Deep-Dive Data:** Explore a comprehensive and filterable database, packed with real stats: piste distance, altitude range, snow reliability, airport transfer times, difficulty splits, and more.
- **AI Preference Matcher:** Stuck with what to search for? The built-in AI assistant analyzes everyone’s profile and automatically builds search queries to surface resorts matching the group vibe.

### 3. Pitch, Discuss, and Refine
- **Build the "Proposal":** Anyone can draft a proposal combining a resort, specific dates, and various accommodation options. 
- **AI Suitability Reviews:** The AI scans the proposal and writes a quick brief on how well it fits with everyone's likes and dislikes (e.g., *"Great for Dave's love of off-piste, but transfer time is a bit long for Sarah"*).
- **Hype it up:** Add notes, chat with the group, and refine the pitch until it’s ready for the chopping block.

### 4. Weighted Token Voting (No Simple Majorities)
- **Launch the Poll:** When the pitches are locked in, the coordinator opens a voting round.
- **Spread the Love:** Instead of picking just one winner, everyone gets a bundle of tokens to distribute (e.g., spend 3 tokens on your absolute favorite, 1 on a solid backup). 
- **Flexible Timelines:** Polls run until a set deadline, though the coordinator can call it early if everyone has voted.
- **Iterative Rounds:** The coordinator reviews the token spread and decides the next step. Either chop the bottom options and vote again, or crown a clear winner.

### 5. Smart "What Next?" Prompts
- **Stay on Track:** Group trips can die in the WhatsApp void ("What are the choices again?"). Ski Tripper keeps the engine running by showing every user exactly what their next move is the moment they open the app (finish that draft proposal, 2 days to vote, ...).

## Who created it?

My name is [Timothy Corbett-Clark](https://www.corbettclark.com). I've programmed all my life; have academic origins in engineering, computer science, and AI research; was a CTO in Life Sciences for 20 years; and am now semi-retired enjoying all sorts of interesting things. No surprise that I also love skiing.

## Why did I build it?

I built Ski Tripper for two reasons: to understand the practical state of AI today, and to help organise "Boys Ski Trips".

AI is undeniably transforming software development. Less clear is exactly how it has changed things so far and what it means for the future. Staying informed by reading the views of others is important, but as ever carries risk of bias and confounding motivations (especially given the hype and excitement). Nothing beats hands-on personal experience for understanding what AI can and cannot do in 2026, the techniques, the domain language, the tools, and a sense for the direction of travel. Although this is a small application, I also hope to gain some insight into how AI can best be used on serious, large-scale software projects.

Having helped lead the organisation of a boys ski trip for a few years, I thought an application could add a bit of structure to the process. But more specifically, I am running out of fresh ideas so wanted to try separating the role of coordinator from the role of proposer. This means the coordinator can drive the process and proposers (everyone!) can generate ideas with enough detail to be useful.

## How is AI used?

1. To **build the application**. I experimented with a number of agentic tools, models, local or cloud-based providers, and configurations (skills, MCPs, etc), settling on [OpenCode](https://opencode.ai/) and open source models running in [Ollama cloud](https://ollama.com/) so I can track new models and updates. Much of ski-tripper was written with the help of [GLM5.1](https://huggingface.co/THUDM/glm-5.1).
2. To **create a rich catalogue of resorts with standardised fields and descriptions**. This involved a pipeline starting with seeding a list, enriching from qualified sources, assessing quality, and fixing inconsistencies using an independent model.
3. To **make it easier for users to search the catalogue of resorts**. An [embedding model](https://huggingface.co/Xenova/multi-qa-MiniLM-L6-cos-v1) was used to one-time create embeddings for each resort as part of catalog generation, and then use the same model in the client browser to quickly find similar resorts.
4. To **generate resort search text from participant preferences**, and so make it easier to home in on candidate resorts the group will enjoy.
5. To **assess a proposal against the likes/dislikes of the participants**. An LLM is used to create a narative assessment of the match between a proposal and the likes/dislikes of the participants, trying to identify who would especially like a resort and who might find it less appealing.
6. To **automate the testing of the applicaton UI** by performing user interactions using a headless browser, looking for bugs and increasing confidence that the application behaves in a reasonable way.

## Technical Overview

The rest of this document provides a brief overview of the technical stack, architecture, development practices, and provisioning.

### Architecture

- [React](https://react.dev/) for the frontend UI application.
- [PocketBase](https://pocketbase.io/) for the backend database and authentication.
- [Resend](https://resend.com/) for email delivery.
- [Caddy](https://caddyserver.com/) for reverse proxy and SSL termination.
- A bun/typescript server to run the backend LLM functions using a cloud LLM provider.

### Coding Agent

Lightly configured for development using the [OpenCode](https://opencode.ai/) coding agent. I run it inside [Zed](https://zed.dev/).

### Worktree Management

Use the [WorkTrunk](https://worktrunk.dev/) tool to manage git worktrees. Some convenient aliases and hooks have been added to `.config/wt.toml`, resulting in the following workflow:

| Task                                            | Shell alias      | Command                              |
| ----------------------------------------------- | ---------------- | ------------------------------------ |
| New worktree with packages installed            | `wtn <worktree>` | `wt switch --create <worktree>`      |
| Remove a worktree and clean everything up       | `wtr <worktree>` | `wt remove <worktree>`               |
| List all worktrees with their status            | `wtl`            | `wt list`                            |
| Merge current worktree back to main             | `wtm`            | `wt merge-and-continue`              |
| Sync main back to all worktrees                 | `wts`            | `wt sync-all-from-main`              |
| Push main (commits + annotated tags) to origin  | `wtp`            | `git push --follow-tags origin main` |

### Environment variables

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

### Development build

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
| `bun run test:e2e`                   | Run Playwright e2e tests against dev server           |

**Build scripts** read env vars from `process.env` (no dotenvx wrapper) so they work in production where env vars are passed inline:

| Command                    | Description                                        |
| -------------------------- | -------------------------------------------------- |
| `bun run build`            | Build client, server, static files, and Caddyfile  |
| `bun run build:client`     | Build client bundle (inlines `PUBLIC_*` env vars)  |
| `bun run build:caddy`      | Generate Caddyfile from template and env vars      |

### Testing

Usual collection of unit tests: `bun run test`.

Exploratory tests use [Playwright](https://playwright.dev/) + [Mailpit](https://mailpit.axllent.org/): `bun run test:e2e`. These need the dev server to be running (`bun run dev`).

Lastly, a smoke test, `bun run test:smoke`, verifies the app is installed correctly in production. It contains both automatic and manual checks.

### Versioning

Versioning follows [Semantic Versioning](https://semver.org/), best managed with `bun pm version patch|minor|major` to clock the version in the source and create an annotated tag. The `wtp` alias then pushes commits and tags to GitHub ready for provisioning.

### Hosting

The app runs fine on a single 1G [DigitalOcean droplet](https://www.digitalocean.com/products/droplets/) (Ubuntu 24.04) with three [systemd services](https://www.freedesktop.org/wiki/Software/systemd/):

| Service           | User          | Description                                      |
| ----------------- | ------------- | ------------------------------------------------ |
| `caddy`           | `caddy`       | Reverse proxy and TLS termination (ports 80/443) |
| `ski-tripper-pb`  | `ski-tripper` | PocketBase (localhost:8090)                      |
| `ski-tripper-api` | `ski-tripper` | Custom Bun API server (localhost:5173)           |

No Docker involved — everything runs natively on the host.

### Provisioning

Provisioning is automated (`bun run infra:provision`) and idempotent. Run from the dev box. It uses [xec](https://xec.sh/) scripts to SSH into the server, pull the latest code, build, and restart services etc.

| Sub-command | Description                                                             |
| ----------- | ----------------------------------------------------------------------- |
| `create`    | Create a droplet and reserved IP (idempotent)                           |
| `configure` | Install dependencies and set up systemd services on an existing droplet |
| `status`    | Show service status, IP, and layout info                                |
| `setup`     | Create, configure, and deploy (full setup)                              |
| `deploy`    | Pull latest code, build, and restart services (default branch: main)    |
| `destroy`   | Unassign IP and delete the droplet (preserves the reserved IP)          |

### Server file layout

| Path                                                                 | Description                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/home/ski-tripper/ski-tripper/`                                     | Git repository                                                      |
| `/opt/ski-tripper/`                                                  | Installed app (`static/`, `server/serve`, `pb_migrations/`)         |
| `/var/lib/ski-tripper/pb_data/`                                      | PocketBase data                                                     |
| `/etc/caddy/Caddyfile`                                               | Caddy configuration                                                 |
| `/usr/local/bin/{bun,caddy,pocketbase}`                              | Binaries                                                            |
| `/etc/systemd/system/{ski-tripper-pb,ski-tripper-api,caddy}.service` | Systemd units                                                       |

### Server logs

Logs from the 3 services (Caddy, PocketBase, and API server) go to `journalctl`.

SSH into the server with `bun run infra:ssh` (or `doctl compute ssh ski-tripper`), then:

| Service    | Command                         |
| ---------- | ------------------------------- |
| Caddy      | `journalctl -u caddy`           |
| PocketBase | `journalctl -u ski-tripper-pb`  |
| API server | `journalctl -u ski-tripper-api` |

### Resort data

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

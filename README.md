[![CI](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml/badge.svg)](https://github.com/tcorbettclark/ski-tripper/actions/workflows/bun.js.yml)

# Ski Tripper

## What is this?

Ski Tripper is a collaborative trip planning application to help groups of friends find and discuss resorts, and select by concensus through one or more rounds of voting.

It takes a "resort-first" approach. The trip is "an idea" (e.g. "let's go skiing in 2027"). Anyone can create proposals about different resorts, add proposal-specific accommodations and dates, and submit for a vote. The AI generated catalog means each proposal has structured data about the skiing experience at a given resort (piste km, altitude range, transfer times to nearest international airport, difficulty levels, etc). Each proposal also has begin and end date because the best dates may depend on notable annual events such as races specific to the resort. Each proposal also has multiple accommodations, allowing different members of the group to stay in different hotels or pensions etc.

Many holiday sites start with a search by date, departure airports, and rough location, before presenting hotels to choose from. Useful in part, but less helpfull if people are travelling from different places, may want to stay in different accommodation, and most importantly **does not really help the group find resorts and decide primarily upon the skiing experience on the mountain**. Of course, websites like [Heidi](https://www.heidi.com/), [Igluski](https://www.igluski.com), [Crystal Ski](https://www.crystalski.co.uk), [Hotels](https://www.hotels.com) can and should all be used to find accommodations as part of the proposal drafting process.

## How does it work?

Low-friction onboarding:
  - everyone signs up with their email
  - each person sets their personal skiing preferences (skill level, on/off-piste, time split between slopes/eating/après/chill) so the group participants *and AI* can see the kind of trip you like
  - one person (the nominated "coordinator") creates a "trip" and asks friends to join via a simple three-word code

Browse thousands of resorts:
  - use a fast, searchable, filterable database packed with detail: piste km, altitude range, snow reliability, transfer times, difficulty levels, AI generated descriptions, linked resorts,and more
  - use the built-in AI assistant to generate query text from everyone's preferences

Propose to discuss and refine:
  - create resort proposals with dates, descriptions, and accommodation options
  - use the built-in AI assistant to describe suitability of each proposal against the likes and dislikes of all the participants
  - discuss and add notes
  - submit ready for a round of voting

Weighted token voting, not just one pick:
  - the trip coordinator creates a poll from submitted proposals
  - everyone distributes their votes across proposals (e.g. 3 tokens on your favourite, 1 on your backup)
  - each poll has an end date, but can be terminated early by the coordinator
  - the coodinator decides the consequence of each poll (reject some and vote again, or just pick the winner if clear)

Guided "what next?" prompting:
  - show each person what they could do next - submit their draft, comment on a proposal, vote before the poll closes, etc

## Who created it?

My name is [Timothy Corbett-Clark](https://www.corbettclark.com). I've programmed all my life; have academic origins in engineering, computer science, and AI research; was a CTO in Life Sciences for 20 years; and am now semi-retired enjoying all sorts of interesting things.
  
## Why did I build it?

I built ski-tripper for two reasons: to understand the practical state of AI today, and to help organise "Boys Ski Trips".

AI is undeniably transforming software development. Less clear is exactly how it has changed things so far and what it means for the future. Staying informed by reading the views of others is important, but as ever carries risk of bias and confounding motivations (especially given the hype and excitement). Nothing beats hands-on personal experience for understanding what AI can and cannot do in 2026, the techniques, the domain language, the tools, and a sense for the direction of travel. Although this is a small application, I also hope to gain some insight into how AI can best be used on serious, large-scale software projects.

Having organised a boys ski trip for a few years, I thought an application could
* add a bit of structure to the process,
* help cut down on some of the chaos, and 
* generate new ideas for destinations by separating the role of coordinator from the role of proposer.

## How is AI used?

1. To **build the application**. I experimented with a number of agentic tools, models, local or cloud-based providers, and configurations (skills, MCPs, etc), settling on [opencode](https://opencode.ai/) and open source models running in [Ollama cloud](https://ollama.com/) so I can track new models and updates. Much of ski-tripper was written with [GLM5.1](https://huggingface.co/THUDM/glm-5.1).
2. To **create a rich catalogue of resorts with standard fields and descriptions**. This required seeding the list, enriching from qualified sources, assessing quality, and fixing inconsistencies in the result using an independent model.
3. To **make it easier for users to search the catalogue of resorts**. An [embedding model](https://huggingface.co/Xenova/multi-qa-MiniLM-L6-cos-v1) was used to one-time create embeddings for each resort as part of catalog generation, and then use the same model in the client browser to quickly find similar resorts.
4. To **generate resort search text from participant preferences**, and so make it easier to home in on candidate resorts the group will enjoy.
5. To **assess a proposal against the likes/dislikes of the participants**. An LLM is used to create a narative assessment of the match between a proposal and the likes/dislikes of the participants, trying to identify who would especially like a resort and who might find it less appealing.
6. To **automate the testing of the applicaton UI** by performing user interactions using a headless browser, looking for bugs and increasing confidence that the application behaves in a reasonable way.

## Technical Overview

A brief overview of the technical stack, architecture, development practices, and provisioning.

### Architecture

- [React](https://react.dev/) for the frontend UI application.
- [PocketBase](https://pocketbase.io/) for the backend database and authentication.
- [Resend](https://resend.com/) for email delivery.
- [Caddy](https://caddyserver.com/) for reverse proxy and SSL termination.
- A bun/typescript server to run the backend LLM functions using a cloud LLM provider.

### Development

Lightly configured for development using the [OpenCode](https://opencode.ai/) coding agent.

Use the [WorkTrunk](https://worktrunk.dev/) tool to manage git worktrees. Some convenient aliases and hooks have been added to `.config/wt.toml`, resulting in the following workflow:

| Task                                                    | Shell alias          | Command                                          |
| ------------------------------------------------------- | -------------------- | ------------------------------------------------ |
| New worktree with `.env` and packages installed         | `wtn <worktree>`     | `wt switch --create <worktree>`                  |
| Remove a worktree and clean everything up               | `wtr <worktree>`     | `wt remove <worktree>`                           |
| List all worktrees with their status                    | `wtl`                | `wt list`                                        |
| Merge current worktree back to main                     | `wtm`                | `wt merge-and-continue`                          |
| Sync main back to all worktrees                         | `wts`                | `wt sync-all-from-main`                          |
| Push main (commits + annotated tags) to origin          | `wtp`                | `git push --follow-tags origin main`             |

Testing is done with unit testing, and [Playwright](https://playwright.dev/) + [Mailpit](https://mailpit.axllent.org/) for exploratory testing.

Versioning follows [Semantic Versioning](https://semver.org/), best managed with `bun pm version patch|minor|major` to clock the version in the source and create an annotated tag. THe `wtp` alias then pushes commits and tags to GitHub ready for provisioning.

### Hosting

The app runs fine on a single 1G [DigitalOcean droplet](https://www.digitalocean.com/products/droplets/) (Ubuntu 24.04) with three [systemd services](https://www.freedesktop.org/wiki/Software/systemd/):

| Service | User | Description |
|---------|------|-------------|
| `caddy` | `caddy` | Reverse proxy and TLS termination (ports 80/443) |
| `ski-tripper-pb` | `ski-tripper` | PocketBase (localhost:8090) |
| `ski-tripper-api` | `ski-tripper` | Custom Bun API server (localhost:5173) |

No Docker involved — everything runs natively on the host.

### Provisioning

Provisioning is automated (`bun run infra:provision`) and idempotent, using [xec](https://xec.sh/) scripts to SSH into the server, pull the latest code, build, and restart services etc.

| Sub-command | Description |
|---------|-------------|
| `create` | Create a droplet and reserved IP (idempotent) |
| `configure` | Install dependencies and set up systemd services on an existing droplet |
| `status` | Show service status, IP, and layout info |
| `setup` | Create, configure, and deploy (full setup) |
| `deploy` | Pull latest code, build, and restart services (default branch: main) |
| `destroy` | Unassign IP and delete the droplet (preserves the reserved IP) |

### Server layout

| Path | Description |
|------|-------------|
| `/home/ski-tripper/ski-tripper/` | Git repository |
| `/opt/ski-tripper/` | Installed app (`static/`, `server/serve`, `pb_migrations/`, `.env`) |
| `/var/lib/ski-tripper/pb_data/` | PocketBase data |
| `/etc/caddy/Caddyfile` | Caddy configuration |
| `/usr/local/bin/{bun,caddy,pocketbase}` | Binaries |
| `/etc/systemd/system/{ski-tripper-pb,ski-tripper-api,caddy}.service` | Systemd units |

### Server logs

SSH into the server with `bun run infra:ssh` (or `doctl compute ssh ski-tripper`), then:

| Service | Command |
|---------|---------|
| Caddy | `journalctl -u caddy` |
| PocketBase | `journalctl -u ski-tripper-pb` |
| API server | `journalctl -u ski-tripper-api` |

### Resort data

The resort catalogue is generated offline via a pipeline and uploaded to PocketBase. Hence, adding or improving the resort catalogue does not involve any server-side changes or changes to the source code.

The tool, `bun run tools:resorts`, has six sub-commands: `seed`, `enrich`, `audit`, `encode`, `build`, and `upload`.

| Stage | Input | Output | What happens |
|-------|-------|--------|---------------|
| **Seed** | OpenSkiMap CSVs (ski areas, lifts, runs) | `seeded.jsonl` | Download & cache CSVs; filter for operating downhill resorts with ≥5 km pistes and ≥1 non-surface lift; compute difficulty percentages from run data; map countries to 17 ski regions; generate slug IDs |
| **Enrich** | `seeded.jsonl` + Exa web search + Ollama LLM | `enriched.jsonl` | For each resort, run 4 parallel Exa searches (authoritative ski sources, general, airports, linked resorts); feed results to an LLM to extract descriptions (terrain, off-piste, value, family, après-ski, lift system), airport/transfer, snow reliability, and season; a separate LLM audits for contradictions with seeded numeric fields and corrects them; URLs are cleaned and deduplicated |
| **Audit** | `enriched.jsonl` | quality reports | Check for empty/low-quality fields, invalid values, orphans, and duplicates |
| **Encode** | `enriched.jsonl` | `encoded.jsonl` | Concatenate name, country, region, and all enriched descriptions into search text; generate embeddings using `Xenova/multi-qa-MiniLM-L6-cos-v1` |
| **Build** | `seeded.jsonl` + `enriched.jsonl` + `encoded.jsonl` | `all.jsonl` | Merge seeded and enriched data (enriched overrides numeric fields if corrected by audit); build a combined description; flatten into a single record per resort |
| **Upload** | `all.jsonl` | PocketBase file | Upload the full JSONL as a single file attachment to PocketBase, replacing previous records. |

On the client ikn the browser, the JSONL file is fetched from PocketBase and parsed line-by-line.

// Generated from ABOUT.md by dev/scripts/generate-about-content.ts
// Do not edit manually — run "bun run generate:about" to regenerate.
export const aboutContent = `# Ski Tripper

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

I built Ski Tripper for two reasons: to better understand the practical state of AI today, and to help organise "Boys Ski Trips".

AI is undeniably transforming software development. Less clear is exactly how it has changed things so far and what it means for the future. Staying informed by reading the views of others is important, but as ever carries risk of bias and confounding motivations (especially given the hype and excitement). Nothing beats hands-on personal experience for understanding what AI can and cannot do in 2026, the techniques, the domain language, the tools, and a sense for the direction of travel. Although this is a small application, I also hope to gain some insight into how AI can best be used on serious, large-scale software projects.

Having helped lead the organisation of a boys ski trip for a few years, I thought an application could add a bit of structure to the process. But more specifically, I am running out of fresh ideas so wanted to try separating the role of coordinator from the role of proposer. This means the coordinator can drive the process and proposers (everyone!) can generate ideas with enough detail to be useful.

## How is AI used?

1. To **build the application**. I experimented with a number of agentic tools, models, local or cloud-based providers, and configurations (skills, MCPs, etc), settling on [OpenCode](https://opencode.ai/) and open source models running in [Ollama cloud](https://ollama.com/) so I can track new models and updates. Much of ski-tripper was written with the help of [GLM5.1](https://huggingface.co/THUDM/glm-5.1).
2. To **create a rich catalogue of resorts with standardised fields and descriptions**. This involved a pipeline starting with seeding a list, enriching from qualified sources, assessing quality, and fixing inconsistencies using an independent model.
3. To **make it easier for users to search the catalogue of resorts**. An [embedding model](https://huggingface.co/Xenova/multi-qa-MiniLM-L6-cos-v1) was used to one-time create embeddings for each resort as part of catalog generation, and then the same model is used again in the client browser to quickly find similar resorts.
4. To **generate resort search text from participant preferences**. An LLM is fed everyone's preferences and asked to generate search text to run against the embedding model (previous), and so make it easier to home in on candidate resorts the group will enjoy.
5. To **assess a proposal against the likes/dislikes of the participants**. An LLM is used to create a narative assessment of the match between a proposal and the likes/dislikes of the participants, trying to identify who would especially like a resort and who might find it less appealing.
6. To **automate the testing of the applicaton UI** by performing user interactions using a headless browser, looking for bugs and increasing confidence that the application behaves in a reasonable way.

For technical details, see the project's [GitHub repository](https://github.com/ski-tripper/ski-tripper).
` as const

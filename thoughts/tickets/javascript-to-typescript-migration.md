# thoughts/tickets/2026-03-31-javascript-to-typescript.md

status: reviewed

## Feature: Change from Javascript to TypeScript

### Description

- Agentic programming will benefit from type safety, clearly defined interfaces, better linting and AST searching.
- Hence migrate all the Javascript to Typescript.
- StandardJS currently provides the linting and formatting of .js/.jsx. Biome provides both linting adn formatting in one package. Switching to Biome will remove the need for both StandardJS and Prettier (replacing two tools with one).

### Requirements

- No JavaScript
- Updated and passing tests
- No StandardJs and no Prettier; replaced by Biome

#!/usr/bin/env bun

import { Command } from 'commander'
import * as analyseProposal from './functions/analyse-proposal'
import * as preferenceSearch from './functions/preference-search'

const functions: Record<
  string,
  { run: (args: string[]) => Promise<void>; description: string }
> = {
  'analyse-proposal': analyseProposal,
  'preference-search': preferenceSearch,
}

const program = new Command()

program
  .name('run-function')
  .description('Run Appwrite functions locally with fixture data')
  .version('1.0.0')

for (const [name, mod] of Object.entries(functions)) {
  program
    .command(name)
    .description(mod.description)
    .argument('[fixture]', 'path to fixture JSON file')
    .action(async (fixture) => {
      const args = fixture ? [fixture] : []
      await mod.run(args)
    })
}

program.parse()

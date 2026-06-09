import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Ollama } from 'ollama'
import {
  buildSystemPrompt,
  buildUserPrompt,
  type Participant,
  type Preferences,
} from '../../functions/preference-search/src/logic'

const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'kimi-k2.6:cloud'

interface FixtureData {
  participants: Participant[]
  preferences: Preferences[]
}

async function loadFixture(fixturePath: string): Promise<FixtureData> {
  const raw = await readFile(fixturePath, 'utf-8')
  const data = JSON.parse(raw)
  const participants = (data.participants ?? []) as Participant[]
  const preferences = (data.preferences ?? []) as Preferences[]
  return { participants, preferences }
}

export async function run(args: string[]): Promise<void> {
  const fixturePath = resolve(
    args[0] ?? 'functions/preference-search/fixtures/sample.json'
  )

  console.log(`Loading fixture: ${fixturePath}`)
  const { participants, preferences } = await loadFixture(fixturePath)

  const participantPrefs = participants
    .map((participant, i) => ({
      participant,
      preferences: preferences[i],
    }))
    .filter((p) => p.preferences !== undefined)

  if (participantPrefs.length === 0) {
    console.error('No participants with preferences found in fixture')
    process.exit(1)
  }

  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(participantPrefs)

  console.log('\n--- System Prompt ---')
  console.log(systemPrompt)
  console.log('\n--- User Prompt ---')
  console.log(userPrompt)
  console.log('\n--- LLM Response ---\n')

  const ollama = new Ollama({
    host: 'https://ollama.com',
    headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
  })

  const stream = await ollama.chat({
    model: OLLAMA_MODEL,
    stream: true,
    think: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  let isThinking = true

  for await (const chunk of stream) {
    const thinkPart = (chunk.message as unknown as Record<string, unknown>)
      .thinking
    if (typeof thinkPart === 'string' && thinkPart) {
      if (isThinking) {
        process.stdout.write('\x1b[2m')
      }
      process.stdout.write(thinkPart)
      isThinking = false
    }

    if (chunk.message.content) {
      if (!isThinking) {
        process.stdout.write('\x1b[0m\n')
        isThinking = true
      }
      process.stdout.write(chunk.message.content)
    }
  }

  if (!isThinking) {
    process.stdout.write('\x1b[0m')
  }
  console.log()
}

export const description =
  'Run the preference-search function locally with fixture data'

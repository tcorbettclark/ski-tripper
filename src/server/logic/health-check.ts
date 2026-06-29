import { hash } from 'canonical-json/hash'

export function computeInputHash(model: string): string {
  const data = {
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(),
    model,
  }
  return hash(data)
}

export function buildSystemPrompt(): string {
  return 'You are a helpful assistant.'
}

export function buildUserPrompt(): string {
  return 'Say hello in one sentence.'
}

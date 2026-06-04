import * as fs from 'node:fs'
import * as path from 'node:path'

export const SEEDED_PATH = path.join(process.cwd(), 'resorts', 'seeded.jsonl')
export const ENRICHED_PATH = path.join(
  process.cwd(),
  'resorts',
  'enriched.jsonl'
)
export const ENCODED_PATH = path.join(process.cwd(), 'resorts', 'encoded.jsonl')
export const OUTPUT_PATH = path.join(
  process.cwd(),
  'public',
  'resort-data.jsonl'
)

export function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return []
  const content = fs.readFileSync(filePath, 'utf-8').trim()
  if (!content) return []
  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

export function writeJsonl<T>(filePath: string, items: T[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const content = `${items.map((item) => JSON.stringify(item)).join('\n')}\n`
  fs.writeFileSync(filePath, content, 'utf-8')
}

export function simpleHash(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return hash.toString(36)
}

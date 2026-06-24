const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'

export { BOLD, CYAN, GREEN, RED, RESET, YELLOW }

export function step(msg: string) {
  console.log(`\n${BOLD}▸ ${msg}${RESET}`)
}

export function success(msg: string) {
  console.log(`  ${GREEN}✓${RESET} ${msg}`)
}

export function warn(msg: string) {
  console.log(`  ${YELLOW}⚠${RESET} ${msg}`)
}

export function fail(msg: string): never {
  console.error(`  ${RED}✗${RESET} ${msg}`)
  process.exit(1)
}

export function section(title: string) {
  console.log(`\n${BOLD}${CYAN}━━ ${title} ━━${RESET}`)
}

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

export function retrying(msg: string) {
  console.log(`  ⏳ ${msg}`)
}

export function error(msg: string) {
  console.error(`  ${RED}✗${RESET} ${msg}`)
}

export function fail(msg: string): never {
  error(msg)
  process.exit(1)
}

export function section(title: string) {
  console.log(`\n${BOLD}${CYAN}━━ ${title} ━━${RESET}`)
}

export function banner(title: string) {
  const line = '═'.repeat(title.length + 4)
  console.log(`\n${BOLD}${CYAN}${line}${RESET}`)
  console.log(`${BOLD}${CYAN}  ${title}  ${RESET}`)
  console.log(`${BOLD}${CYAN}${line}${RESET}`)
}

export function help(text: string, exitCode: number): never {
  console.log(`\n${BOLD}${text}${RESET}\n`)
  process.exit(exitCode)
}

export function notice(msg: string) {
  console.log(`\n  ${BOLD}${YELLOW}${msg}${RESET}\n`)
}

export function info(msg: string) {
  console.log(`  ${msg}`)
}

export function raw(msg: string) {
  console.log(msg)
}

export function testPass(msg: string) {
  console.log(`  ${GREEN}PASS${RESET} ${msg}`)
}

export function testFail(msg: string, detail?: string) {
  console.log(`  ${RED}FAIL${RESET} ${msg}`)
  if (detail) console.log(`        ${RED}${detail}${RESET}`)
}

export function testSummary(passed: number, failed: number, label?: string) {
  const prefix = label ? `${label}: ` : ''
  console.log(
    `  ${prefix}${GREEN}${passed} passed${RESET}, ${RED}${failed} failed${RESET}`
  )
}

type LogFn = (message: string) => void

let _log: LogFn = (message: string) => console.log(message)
let _logError: LogFn = (message: string) => console.error(message)

export function log(message: string): void {
  _log(message)
}

export function logError(message: string): void {
  _logError(message)
}

export interface CapturedLogs {
  logs: string[]
  errors: string[]
}

export function captureLogs(): CapturedLogs {
  const captured: CapturedLogs = { logs: [], errors: [] }
  _log = (message: string) => {
    captured.logs.push(message)
  }
  _logError = (message: string) => {
    captured.errors.push(message)
  }
  return captured
}

export function restoreLogs(): void {
  _log = (message: string) => console.log(message)
  _logError = (message: string) => console.error(message)
}

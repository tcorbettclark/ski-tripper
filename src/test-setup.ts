import { afterEach, mock } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import pb from './backend'

GlobalRegistrator.register()

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/**
 * Install guards that cause tests to fail immediately if any code makes a real
 * HTTP request to the PocketBase backend.
 *
 * WHY: Components use dependency injection (optional props that default to the
 * real backend functions). If a test renders a component without providing
 * mock props, the component falls through to the real PocketBase client and
 * makes live network requests. This is slow, flaky, and couples tests to
 * database state.
 *
 * HOW: We replace two low-level mechanisms that all backend calls go through:
 *
 *   1. pb.collection()  — every DB query (listTrips, listParticipants, etc.)
 *   2. globalThis.fetch  — direct HTTP calls (triggerAnalysis, useSSEStream)
 *
 * If either is called with the PocketBase URL, we throw with a message that
 * tells the developer exactly which call leaked and includes a stack trace
 * pointing to the offending test. The fix is always the same: pass a mock
 * function via the component's DI props.
 *
 * Non-PocketBase fetches (e.g. to external APIs) are allowed through unchanged.
 */
function installBackendCallGuard() {
  const pbUrl = process.env.PUBLIC_POCKETBASE_URL ?? ''
  const pbHost = pbUrl ? new URL(pbUrl).host : ''
  const originalFetch = globalThis.fetch

  pb.collection = mock((name: string): never => {
    const stack = new Error().stack ?? ''
    throw new Error(
      `Backend call guard: pb.collection("${name}") was called during a test.\n` +
        `This means a component is using the real PocketBase client instead of a mock prop.\n` +
        `Fix: pass a mock function via the component's DI props.\n` +
        stack
    )
  })

  globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url

    if (pbHost && url.includes(pbHost)) {
      const stack = new Error().stack ?? ''
      throw new Error(
        `Backend call guard: fetch("${url}") was called during a test.\n` +
          `This means a component is making a real HTTP request to PocketBase instead of using a mock prop.\n` +
          `Fix: pass a mock function via the component's DI props (or set enabled=false on useSSEStream).\n` +
          stack
      )
    }

    return originalFetch(input, init)
  }) as unknown as typeof globalThis.fetch
}

installBackendCallGuard()

const { cleanup } = await import('@testing-library/react')

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  localStorage.clear()
  ;(pb.collection as ReturnType<typeof mock>).mockClear()
  ;(globalThis.fetch as unknown as ReturnType<typeof mock>).mockClear()
})

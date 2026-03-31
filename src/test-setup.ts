import type { Window } from 'happy-dom'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterEach, expect } from 'bun:test'

declare const window: Window & typeof globalThis

GlobalRegistrator.register()

const matchers = await import('@testing-library/jest-dom/matchers')
const { cleanup } = await import('@testing-library/react')

expect.extend(matchers)

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  localStorage.clear()
})

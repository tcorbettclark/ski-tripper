import { afterEach, expect } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { Window } from 'happy-dom'
import { tablesDb } from './backend'
import { createStrictMockDb } from './test-utils'

declare const window: Window & typeof globalThis

GlobalRegistrator.register()

const matchers = await import('@testing-library/jest-dom/matchers')
const { cleanup } = await import('@testing-library/react')

expect.extend(matchers)

Object.assign(tablesDb, createStrictMockDb())

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  localStorage.clear()
})

import { afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { Window } from 'happy-dom'
import { tablesDb } from './backend'
import { createStrictMockDb } from './test-utils'

declare const window: Window & typeof globalThis

GlobalRegistrator.register()

Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })

const { cleanup } = await import('@testing-library/react')

Object.assign(tablesDb, createStrictMockDb())

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  localStorage.clear()
})

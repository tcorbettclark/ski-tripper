import { afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { tablesDb } from './backend'
import { createStrictMockDb } from './test-utils'

GlobalRegistrator.register()

const { cleanup } = await import('@testing-library/react')

Object.assign(tablesDb, createStrictMockDb())

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  localStorage.clear()
})

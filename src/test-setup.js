/* global localStorage */
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterEach, expect } from 'bun:test'

// Register DOM globals BEFORE loading any library that checks for document at import time
GlobalRegistrator.register()

// Dynamically import RTL *after* DOM is registered so screen initialises correctly
const matchers = await import('@testing-library/jest-dom/matchers')
const { cleanup } = await import('@testing-library/react')

expect.extend(matchers)

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  localStorage.clear()
})

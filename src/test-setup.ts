import { afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const { cleanup } = await import('@testing-library/react')

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  localStorage.clear()
})

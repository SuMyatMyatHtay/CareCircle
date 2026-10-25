import { afterEach, vi } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'

enableAutoUnmount(afterEach)

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(query => ({
    media: query, matches: false, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return true },
  })),
})
Element.prototype.scrollIntoView = vi.fn()

afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  document.body.innerHTML = ''
  delete document.documentElement.dataset.theme
  delete document.documentElement.dataset.bsTheme
  vi.useRealTimers()
})

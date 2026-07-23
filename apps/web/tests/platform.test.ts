import { afterEach, describe, expect, it } from 'vitest'
import { isIosSafari, isStandalone } from '../src/pwa/platform'

const setUserAgent = (value: string) =>
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true })

describe('platform', () => {
  afterEach(() => {
    setUserAgent('node')
    window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
  })

  it('isIosSafari is true for an iPhone Safari user agent', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    expect(isIosSafari()).toBe(true)
  })

  it('isIosSafari is false for Chrome on Android', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36')
    expect(isIosSafari()).toBe(false)
  })

  it('isIosSafari is false for Chrome on iOS (CriOS)', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1')
    expect(isIosSafari()).toBe(false)
  })

  it('isStandalone reflects the display-mode media query', () => {
    window.matchMedia = ((query: string) => ({ matches: query.includes('standalone'), media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    expect(isStandalone()).toBe(true)
  })
})

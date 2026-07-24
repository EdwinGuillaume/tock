import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useInstallOffer } from '../src/pwa/useInstallOffer'
import * as installHook from '../src/pwa/useInstallPrompt'

const setUserAgent = (value: string) =>
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true })

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

afterEach(() => {
  vi.restoreAllMocks()
  setUserAgent('node')
})

describe('useInstallOffer', () => {
  it('offers install when the Chromium prompt is available', () => {
    vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: true, promptInstall: vi.fn() })
    const { result } = renderHook(() => useInstallOffer())
    expect(result.current.canOfferInstall).toBe(true)
    expect(result.current.canInstall).toBe(true)
  })

  it('offers install on iOS Safari even without a prompt', () => {
    vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: false, promptInstall: vi.fn() })
    setUserAgent(IPHONE_UA)
    const { result } = renderHook(() => useInstallOffer())
    expect(result.current.canOfferInstall).toBe(true)
    expect(result.current.iosEligible).toBe(true)
  })

  it('does not offer install in a plain desktop browser', () => {
    vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: false, promptInstall: vi.fn() })
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0')
    const { result } = renderHook(() => useInstallOffer())
    expect(result.current.canOfferInstall).toBe(false)
  })
})

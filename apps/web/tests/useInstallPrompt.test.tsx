import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useInstallPrompt } from '../src/pwa/useInstallPrompt'

const fireBeforeInstall = () => {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent
  Object.assign(event, { prompt: vi.fn(() => Promise.resolve()), preventDefault: vi.fn() })
  act(() => { window.dispatchEvent(event) })
  return event
}

describe('useInstallPrompt', () => {
  it('exposes canInstall once beforeinstallprompt fires', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
    fireBeforeInstall()
    expect(result.current.canInstall).toBe(true)
  })

  it('promptInstall triggers the deferred prompt and clears it', () => {
    const { result } = renderHook(() => useInstallPrompt())
    const event = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    expect(event.prompt).toHaveBeenCalledOnce()
    expect(result.current.canInstall).toBe(false)
  })

  it('hides after the app is installed', () => {
    const { result } = renderHook(() => useInstallPrompt())
    fireBeforeInstall()
    act(() => { window.dispatchEvent(new Event('appinstalled')) })
    expect(result.current.canInstall).toBe(false)
  })
})

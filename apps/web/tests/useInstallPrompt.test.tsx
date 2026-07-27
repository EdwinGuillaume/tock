import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useInstallPrompt } from '../src/pwa/useInstallPrompt'

type Choice = { outcome: 'accepted' | 'dismissed', platform: string }

// Fires beforeinstallprompt with a userChoice that stays pending until the test
// answers it, so the window while the native dialog is open is observable.
const fireBeforeInstall = () => {
  let answer: (choice: Choice) => void = () => {}
  let reject: (reason?: unknown) => void = () => {}
  const userChoice = new Promise<Choice>((resolve, rejectFn) => {
    answer = resolve
    reject = rejectFn
  })
  let shouldPromptReject = false
  const prompt = vi.fn(() => {
    if (shouldPromptReject) {
      return Promise.reject(new Error('prompt rejected'))
    }
    return Promise.resolve()
  })
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent
  Object.assign(event, { prompt, preventDefault: vi.fn(), userChoice })
  act(() => { window.dispatchEvent(event) })
  const settle = async (outcome: 'accepted' | 'dismissed') => {
    await act(async () => { answer({ outcome, platform: 'web' }) })
  }
  const rejectChoice = async () => {
    await act(async () => { reject(new Error('userChoice rejected')) })
  }
  const makePromptReject = () => {
    shouldPromptReject = true
  }
  return { event, settle, rejectChoice, makePromptReject }
}

describe('useInstallPrompt', () => {
  it('exposes canInstall once beforeinstallprompt fires', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
    fireBeforeInstall()
    expect(result.current.canInstall).toBe(true)
  })

  it('keeps offering install while the native dialog is still open', () => {
    const { result } = renderHook(() => useInstallPrompt())
    const { event } = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    expect(event.prompt).toHaveBeenCalledOnce()
    expect(result.current.canInstall).toBe(true)
    expect(result.current.installed).toBe(false)
  })

  it('prompts once when promptInstall is called twice while pending', () => {
    const { result } = renderHook(() => useInstallPrompt())
    const { event } = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    act(() => { result.current.promptInstall() })
    expect(event.prompt).toHaveBeenCalledOnce()
  })

  it('marks the app installed when the user accepts', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const { settle } = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    await settle('accepted')
    expect(result.current.installed).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('drops the offer without marking installed when the user dismisses', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const { settle } = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    await settle('dismissed')
    expect(result.current.installed).toBe(false)
    expect(result.current.canInstall).toBe(false)
  })

  it('marks the app installed on the appinstalled event', () => {
    const { result } = renderHook(() => useInstallPrompt())
    fireBeforeInstall()
    act(() => { window.dispatchEvent(new Event('appinstalled')) })
    expect(result.current.installed).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('releases pending and clears deferred when userChoice rejects', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const { rejectChoice } = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    await rejectChoice()
    expect(result.current.canInstall).toBe(false)
    expect(result.current.installed).toBe(false)
  })

  it('releases pending and clears deferred when prompt rejects', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const { makePromptReject } = fireBeforeInstall()
    makePromptReject()
    await act(async () => {
      result.current.promptInstall()
      // Give the promise chain time to settle
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(result.current.canInstall).toBe(false)
    expect(result.current.installed).toBe(false)
  })

  // The two assertions above cannot tell "the pending guard was released"
  // apart from "the guard is permanently stuck": promptInstall() also
  // short-circuits on a cleared `deferred`, so a later call never even
  // reaches the guard check. Firing a fresh event and asserting it actually
  // gets prompted exercises the guard itself.
  it('can prompt a fresh event after a rejection', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const first = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    await first.rejectChoice()
    const second = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    expect(second.event.prompt).toHaveBeenCalledOnce()
  })

  it('can prompt a fresh event after a resolved dismissal', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const first = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    await first.settle('dismissed')
    const second = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    expect(second.event.prompt).toHaveBeenCalledOnce()
  })

  it('keeps a newer offer when it arrives while an older choice is pending', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const first = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    fireBeforeInstall()
    await first.settle('dismissed')
    expect(result.current.canInstall).toBe(true)
  })
})

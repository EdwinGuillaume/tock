import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AudioProvider } from '../src/audio/AudioProvider'
import { useAudio } from '../src/audio/useAudio'
import { createFakeEngine } from './audioFake'

const Probe = () => {
  const { audioEnabled, muted, toggleMuted, play } = useAudio()
  return (
    <>
      <button data-enabled={audioEnabled} onClick={() => play('move')}>go</button>
      <button data-muted={muted} onClick={toggleMuted}>toggle</button>
    </>
  )
}

afterEach(() => { localStorage.clear() })

describe('AudioProvider — gated off (browser tab)', () => {
  it('does not unlock, play, or report enabled', async () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled={false}><Probe /></AudioProvider>)
    act(() => { window.dispatchEvent(new Event('pointerdown')) })
    await userEvent.click(screen.getByText('go'))
    expect(fake.unlockCount).toBe(0)
    expect(fake.played).toEqual([])
    expect(screen.getByText('go').dataset.enabled).toBe('false')
  })

  it('does not preload when gated off', () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled={false}><Probe /></AudioProvider>)
    expect(fake.preloadCount).toBe(0)
  })
})

describe('AudioProvider — gated on', () => {
  it('unlocks and starts music on the first pointerdown', () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><Probe /></AudioProvider>)
    act(() => { window.dispatchEvent(new Event('pointerdown')) })
    expect(fake.unlockCount).toBe(1)
    expect(fake.musicStarted).toBe(1)
  })

  it('preloads the engine at mount so the first tap is ready', () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><Probe /></AudioProvider>)
    expect(fake.preloadCount).toBe(1)
  })

  it('routes play to the engine', async () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><Probe /></AudioProvider>)
    await userEvent.click(screen.getByText('go'))
    expect(fake.played).toContain('move')
  })

  it('applies a persisted mute on mount', () => {
    localStorage.setItem('tock.muted', 'true')
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><Probe /></AudioProvider>)
    expect(fake.muted).toBe(true)
  })

  it('restarts the music bed when the user unmutes after a persisted mute', async () => {
    localStorage.setItem('tock.muted', 'true')
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><Probe /></AudioProvider>)
    // Persisted-muted mount must not start the bed.
    expect(fake.musicStarted).toBe(0)
    await userEvent.click(screen.getByText('toggle'))
    expect(fake.muted).toBe(false)
    expect(fake.musicStarted).toBe(1)
  })

  it('pauses music when the tab is hidden', () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><Probe /></AudioProvider>)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(fake.pauseCount).toBe(1)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AudioProvider } from '../src/audio/AudioProvider'
import { MuteButton } from '../src/components/MuteButton'
import { createFakeEngine } from './audioFake'

afterEach(() => { localStorage.clear() })

describe('MuteButton', () => {
  it('renders nothing when audio is gated off', () => {
    render(<AudioProvider engine={createFakeEngine()} enabled={false}><MuteButton /></AudioProvider>)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('toggles mute, aria-pressed, and persists the choice', async () => {
    render(<AudioProvider engine={createFakeEngine()} enabled><MuteButton /></AudioProvider>)
    const button = screen.getByRole('button', { name: /couper le son/i })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(screen.getByRole('button', { name: /activer le son/i })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('tock.muted')).toBe('true')
  })
})

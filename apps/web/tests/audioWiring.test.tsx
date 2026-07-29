import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/components/App'
import { AudioProvider } from '../src/audio/AudioProvider'
import { createFakeEngine } from './audioFake'

// Math.random = 0 => seat 0 hand [A,2,3,4,5] of clubs; the four Ace exits are the
// only legal moves. Tap the Ace, then the first ghost, to commit an exit as a
// human — soundsForCommit should fire ['exit', 'draw'] (no capture at game start).
describe('audio wiring', () => {
  beforeEach(() => { vi.spyOn(Math, 'random').mockReturnValue(0) })
  afterEach(() => { vi.restoreAllMocks() })

  it('plays the move + draw sounds when a human commits a move', async () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><App /></AudioProvider>)

    await userEvent.click(screen.getByRole('button', { name: /nouvelle partie/i }))
    const seat1 = await screen.findByTestId('seat-1')
    await userEvent.click(within(seat1).getByRole('button', { name: 'humain' }))
    await userEvent.click(screen.getByRole('button', { name: /lancer la partie/i }))

    expect(await screen.findByLabelText('board')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('card-A-clubs'))
    const ghostList = screen.getAllByLabelText(/^ghost-/)
    await userEvent.click(ghostList[0] as HTMLElement)

    expect(fake.played).toContain('exit')
    expect(fake.played).toContain('draw')
  })

  it('plays a tap sound when the player presses Nouvelle partie', async () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><App /></AudioProvider>)
    await userEvent.click(screen.getByRole('button', { name: /nouvelle partie/i }))
    expect(fake.played).toContain('tap')
  })
})

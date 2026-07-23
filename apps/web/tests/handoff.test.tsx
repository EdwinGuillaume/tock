import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/components/App'

// createGame defaults its RNG to Math.random, so pinning it makes both the
// deck shuffle and the continuous-draw refill deterministic. With Math.random
// stubbed to 0, createGame(['human', 'human'], 48, () => 0) deals seat 0 the
// hand [A, 2, 3, 4, 5] of clubs; with every marble at home, the only legal
// moves are the four Ace exits (one per marble) — 2..5 of clubs are unplayable
// this turn. So: tap the Ace card (opens ghost destinations, since exiting is
// not a single unambiguous outcome), then tap the first ghost to commit.
//
// App wraps every screen change in a Framer-Motion AnimatePresence, so the
// next screen mounts asynchronously after an action that swaps screens —
// findBy* (awaited) is used for anything expected to appear after such a
// change; getBy*/getAllBy* is fine for content within a screen that is
// already mounted.
describe('handoff in a two-human game', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the pass screen after seat 0 commits a move, and reveals the board again on tap', async () => {
    render(<App />)

    // Home screen is the first thing rendered; enter the game to reach Setup.
    // This is a screen swap (home -> setup), so wait for Setup to mount.
    await userEvent.click(screen.getByRole('button', { name: /nouvelle partie/i }))
    const seat1 = await screen.findByTestId('seat-1')

    // New Setup UI: seat 1 defaults to a present 'bot' chair with a segmented
    // humain/bot control. Switch it to human.
    await userEvent.click(within(seat1).getByRole('button', { name: 'humain' }))

    await userEvent.click(screen.getByRole('button', { name: /lancer la partie/i }))

    expect(await screen.findByLabelText('board')).toBeInTheDocument()

    const aceButton = screen.getByLabelText('card-A-clubs')
    expect(aceButton).toBeEnabled()
    await userEvent.click(aceButton)

    const ghostList = screen.getAllByLabelText(/^ghost-/)
    expect(ghostList.length).toBeGreaterThan(0)
    await userEvent.click(ghostList[0] as HTMLElement)

    expect(await screen.findByRole('button', { name: /révéler ma main/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('board')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /révéler ma main/i }))

    expect(await screen.findByLabelText('board')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /révéler ma main/i })).not.toBeInTheDocument()
  })
})

// Seat layout: seat 0 human, seat 1 bot (Setup's default present chair),
// seat 2 human — turned on by adding the absent chair (which seats a bot)
// then flipping its segmented control to humain. This exercises the
// bot->human leg of the handoff, which is the regression this wave fixes:
// useBotAutoplay must be driven by the handoff-aware committer too, or a
// bot's move into a human seat never raises the interstitial and whoever is
// holding the device sees the next human's hand.
describe('handoff after a bot move in a human-bot-human game', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the pass screen once the bot seat hands off to the next human seat', async () => {
    render(<App />)

    // Home screen is the first thing rendered; enter the game to reach Setup.
    // This is a screen swap (home -> setup), so wait for Setup to mount.
    await userEvent.click(screen.getByRole('button', { name: /nouvelle partie/i }))
    const addSeat2Button = await screen.findByLabelText('ajouter le joueur 2')

    // Seat 2 starts absent; the add button seats a bot there first.
    await userEvent.click(addSeat2Button)
    await userEvent.click(within(screen.getByTestId('seat-2')).getByRole('button', { name: 'humain' }))

    await userEvent.click(screen.getByRole('button', { name: /lancer la partie/i }))

    expect(await screen.findByLabelText('board')).toBeInTheDocument()

    // Same deterministic seat-0 hand as the two-human case above: the Ace is
    // the only playable card, opens ghost destinations, first ghost commits.
    const aceButton = screen.getByLabelText('card-A-clubs')
    expect(aceButton).toBeEnabled()
    await userEvent.click(aceButton)

    const ghostList = screen.getAllByLabelText(/^ghost-/)
    expect(ghostList.length).toBeGreaterThan(0)
    await userEvent.click(ghostList[0] as HTMLElement)

    // Control is now with seat 1 (bot). Its autoplay timer (BOT_DELAY_MS =
    // 900ms in App.tsx) fires on the real clock; wait it out so the bot
    // commits a move via commitAndPass — the same committer the human path
    // uses — which should detect the bot->human handoff into seat 2.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    expect(await screen.findByRole('button', { name: /révéler ma main/i })).toBeInTheDocument()
  }, 10000)
})

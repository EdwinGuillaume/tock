import { act, render, screen } from '@testing-library/react'
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
describe('handoff in a two-human game', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the pass screen after seat 0 commits a move, and reveals the board again on tap', async () => {
    render(<App />)

    const seatOneButton = () => screen.getByRole('button', { name: /^seat 1:/ })
    await userEvent.click(seatOneButton())
    await userEvent.click(seatOneButton())
    expect(seatOneButton()).toHaveTextContent('seat 1: human')

    await userEvent.click(screen.getByRole('button', { name: /start/i }))

    expect(screen.getByLabelText('board')).toBeInTheDocument()

    const aceButton = screen.getByLabelText('card-A-clubs')
    expect(aceButton).toBeEnabled()
    await userEvent.click(aceButton)

    const ghostList = screen.getAllByLabelText(/^ghost-/)
    expect(ghostList.length).toBeGreaterThan(0)
    await userEvent.click(ghostList[0] as HTMLElement)

    expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('board')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /reveal/i }))

    expect(screen.getByLabelText('board')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument()
  })
})

// Seat layout: seat 0 human, seat 1 bot (Setup's default), seat 2 human — turned
// on by a single click (its default is 'inactive', and the toggle cycle is
// human -> bot -> inactive -> human, so one click lands on 'human'). This
// exercises the bot->human leg of the handoff, which is the regression this
// wave fixes: useBotAutoplay must be driven by the handoff-aware committer
// too, or a bot's move into a human seat never raises the interstitial and
// whoever is holding the device sees the next human's hand.
describe('handoff after a bot move in a human-bot-human game', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the pass screen once the bot seat hands off to the next human seat', async () => {
    render(<App />)

    const seatTwoButton = () => screen.getByRole('button', { name: /^seat 2:/ })
    await userEvent.click(seatTwoButton())
    expect(seatTwoButton()).toHaveTextContent('seat 2: human')

    await userEvent.click(screen.getByRole('button', { name: /start/i }))

    expect(screen.getByLabelText('board')).toBeInTheDocument()

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

    expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument()
  }, 10000)
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createGame } from '@tock/core'
import { card, place, setHand } from './support'
import { GameScreen } from '../src/components/GameScreen'
import { colorLabel } from '../src/format'

describe('GameScreen (human turn interaction)', () => {
  it('reveals ghost destinations when tapping a playable exit card', async () => {
    const state = setHand(createGame(['human', 'bot'], 48), 0, [card('A', 'clubs')])
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={vi.fn()} />)

    expect(screen.getByText('À toi de jouer')).toBeInTheDocument()
    expect(screen.getByText('choisis une carte')).toBeInTheDocument()

    const aceButton = screen.getByLabelText('card-A-clubs')
    expect(aceButton).toBeEnabled()

    await userEvent.click(aceButton)
    expect(screen.getAllByLabelText(/^ghost-/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('choisis où poser ta bille')).toBeInTheDocument()
  })

  it('commits an exit move when a ghost is tapped', async () => {
    const state = setHand(createGame(['human', 'bot'], 48), 0, [card('A', 'clubs')])
    const commitMove = vi.fn()
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={commitMove} />)

    await userEvent.click(screen.getByLabelText('card-A-clubs'))
    const ghostList = screen.getAllByLabelText(/^ghost-/)
    await userEvent.click(ghostList[0] as HTMLElement)

    expect(commitMove).toHaveBeenCalledTimes(1)
    expect(commitMove.mock.calls[0]?.[0]).toMatchObject({ type: 'exit' })
  })

  it('commits a discard immediately for a discard-only card (no ghost step)', async () => {
    const state = setHand(createGame(['human', 'bot'], 48), 0, [card('2', 'clubs'), card('3', 'clubs')])
    const commitMove = vi.fn()
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={commitMove} />)

    const twoButton = screen.getByLabelText('card-2-clubs')
    expect(twoButton).toBeEnabled()

    await userEvent.click(twoButton)

    expect(commitMove).toHaveBeenCalledTimes(1)
    expect(commitMove.mock.calls[0]?.[0]).toMatchObject({ type: 'discard' })
    expect(screen.queryAllByLabelText(/^ghost-/)).toHaveLength(0)
  })

  it('drives the full 7-split flow: pick marble, spend steps, then Play', async () => {
    const rigged = place(createGame(['human', 'bot'], 48), 'p0m0', { zone: 'track', index: 10 })
    const state = setHand(rigged, 0, [card('7', 'clubs')])
    const commitMove = vi.fn()
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={commitMove} />)

    await userEvent.click(screen.getByLabelText('card-7-clubs'))

    // Only one own marble is on the ring (the other three are home), so the
    // single reachable split partition is that marble taking the full 7 steps.
    await userEvent.click(screen.getByLabelText('select-marble-p0m0'))

    expect(screen.getByText('répartis le 7')).toBeInTheDocument()

    const ghostList = screen.getAllByLabelText(/^ghost-/)
    expect(ghostList.length).toBeGreaterThanOrEqual(1)
    await userEvent.click(ghostList[0] as HTMLElement)

    expect(screen.getByText('0 ✓')).toBeInTheDocument()
    const playButton = screen.getByRole('button', { name: /jouer le 7/i })
    expect(playButton).toBeEnabled()
    expect(commitMove).not.toHaveBeenCalled()

    await userEvent.click(playButton)

    expect(commitMove).toHaveBeenCalledTimes(1)
    expect(commitMove.mock.calls[0]?.[0]).toMatchObject({ type: 'split7' })
  })

  it('does not build ghosts or accept card taps on a bot seat, and shows the bot turn line', () => {
    const state = { ...createGame(['human', 'bot'], 48), currentPlayer: 1 as const }
    const commitMove = vi.fn()
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={commitMove} />)
    expect(screen.queryAllByLabelText(/^ghost-/)).toHaveLength(0)
    expect(screen.getByText(`${colorLabel.green} réfléchit…`)).toBeInTheDocument()
  })

  it('shows the discard hint and commits a discard on tap when the whole hand is stuck', async () => {
    const stuck = setHand(createGame(['human', 'bot'], 48), 0, [
      card('5', 'clubs'), card('6', 'clubs'), card('8', 'clubs'), card('9', 'clubs'), card('10', 'clubs')
    ])
    const commitMove = vi.fn()
    render(<GameScreen state={stuck} logList={[]} humanSeatIds={[0]} commitMove={commitMove} />)

    expect(screen.getByText('aucun coup — touche une carte pour la défausser')).toBeInTheDocument()

    const fiveButton = screen.getByLabelText('card-5-clubs')
    expect(fiveButton).toBeEnabled()

    await userEvent.click(fiveButton)

    expect(commitMove).toHaveBeenCalledTimes(1)
    expect(commitMove.mock.calls[0]?.[0]).toMatchObject({ type: 'discard' })
  })

  it('makes you pick which marble the Jack swaps, and switches the source when you retap another', async () => {
    let state = createGame(['human', 'bot'], 48)
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p0m1', { zone: 'track', index: 15 })
    state = place(state, 'p1m0', { zone: 'track', index: 30 })
    state = setHand(state, 0, [card('J', 'clubs')])
    const commitMove = vi.fn()
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={commitMove} />)

    await userEvent.click(screen.getByLabelText('card-J-clubs'))

    // Source-selection step: no targets yet, source hint, both own marbles tappable.
    expect(screen.getByText('choisis ta bille à échanger')).toBeInTheDocument()
    expect(screen.queryAllByLabelText(/^ghost-/)).toHaveLength(0)
    expect(screen.getByLabelText('select-marble-p0m0')).toBeInTheDocument()
    expect(screen.getByLabelText('select-marble-p0m1')).toBeInTheDocument()

    // Pick the first marble: targets appear and the hint moves to the opponent step.
    await userEvent.click(screen.getByLabelText('select-marble-p0m0'))
    expect(screen.getByText('choisis la bille adverse')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/^ghost-/).length).toBeGreaterThanOrEqual(1)

    // Retap the other marble to switch the source, then commit via the target ghost.
    await userEvent.click(screen.getByLabelText('select-marble-p0m1'))
    await userEvent.click(screen.getAllByLabelText(/^ghost-/)[0] as HTMLElement)

    expect(commitMove).toHaveBeenCalledTimes(1)
    expect(commitMove.mock.calls[0]?.[0]).toMatchObject({ type: 'swap', marbleId: 'p0m1' })
  })

  it('auto-selects the only swappable marble and jumps straight to the opponent step', async () => {
    let state = createGame(['human', 'bot'], 48)
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p1m0', { zone: 'track', index: 30 })
    state = setHand(state, 0, [card('J', 'clubs')])
    const commitMove = vi.fn()
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={commitMove} />)

    await userEvent.click(screen.getByLabelText('card-J-clubs'))

    // Single candidate: skip straight to the opponent step, no source tap needed.
    expect(screen.getByText('choisis la bille adverse')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/^ghost-/).length).toBeGreaterThanOrEqual(1)

    await userEvent.click(screen.getAllByLabelText(/^ghost-/)[0] as HTMLElement)

    expect(commitMove).toHaveBeenCalledTimes(1)
    expect(commitMove.mock.calls[0]?.[0]).toMatchObject({ type: 'swap', marbleId: 'p0m0' })
  })

  it('keeps the human hand visible at the bottom while a bot takes its turn', () => {
    const withHands = setHand(
      setHand(createGame(['human', 'bot'], 48), 0, [card('A', 'clubs')]),
      1,
      [card('K', 'spades')]
    )
    const state = { ...withHands, currentPlayer: 1 as const }
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={vi.fn()} />)

    // The human's own card is shown (dimmed), never the bot's hand.
    expect(screen.getByLabelText('card-A-clubs')).toBeInTheDocument()
    expect(screen.queryByLabelText('card-K-spades')).toBeNull()
  })
})

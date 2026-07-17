import { Text } from 'ink'
import { render } from 'ink-testing-library'
import { expect, test, vi } from 'vitest'
import { createGame, getLegalMoves } from '../../src/engine'
import type { GameState, Move } from '../../src/engine'
import { highlightFor, useTurnInput } from '../../src/ui/hooks/useTurnInput'
import { ringCoord } from '../../src/ui/layout'
import type { Selection, TurnContext } from '../../src/ui/selection'
import { place, setHand } from '../support'

const tick = () => new Promise(resolve => setTimeout(resolve, 30))

const Harness = ({ state, onCommit }: { state: GameState, onCommit: (move: Move) => void }) => {
  const { selection } = useTurnInput({ state, human: 0, active: true, onCommit })
  return <Text>{selection.step}</Text>
}

const HighlightHarness = ({ state, onCommit }: { state: GameState, onCommit: (move: Move) => void }) => {
  const { selection, highlight } = useTurnInput({ state, human: 0, active: true, onCommit })
  return <Text>{selection.step}:{highlight.length}</Text>
}

test('confirm-confirm commits the only legal move', async () => {
  let state = createGame(['human', 'bot'])
  state = place(state, 'p0m0', { zone: 'track', index: 0 })
  state = setHand(state, 0, [{ rank: '6', suit: 'hearts' }])
  const onCommit = vi.fn()
  const { stdin } = render(<Harness state={state} onCommit={onCommit} />)
  stdin.write('\r')
  await tick()
  stdin.write('\r')
  await tick()
  expect(onCommit).toHaveBeenCalledTimes(1)
  expect(onCommit.mock.calls[0]?.[0]).toMatchObject({ type: 'move', marbleId: 'p0m0', steps: 6 })
})

test('previews the exit destination when selecting a marble still in the nest', async () => {
  let state = createGame(['human', 'bot'])
  state = setHand(state, 0, [{ rank: 'A', suit: 'hearts' }])
  const onCommit = vi.fn()
  const { lastFrame, stdin } = render(<HighlightHarness state={state} onCommit={onCommit} />)
  // pickCard has nothing to highlight yet.
  expect(lastFrame()).toContain('pickCard:0')
  stdin.write('\r') // confirm the Ace -> pickMarble on a home marble
  await tick()
  // The home marble has no cell of its own; the exit destination is previewed.
  expect(lastFrame()).toContain('pickMarble:1')
})

test('pickMarble previews the landing cell, keeping the source marble emphasized', () => {
  let state = createGame(['human', 'bot'])
  state = place(state, 'p0m0', { zone: 'track', index: 0 })
  state = setHand(state, 0, [{ rank: '6', suit: 'hearts' }])
  const ctx: TurnContext = { state, legalMoves: getLegalMoves(state, 0), human: 0 }
  const selection: Selection = { step: 'pickMarble', card: { rank: '6', suit: 'hearts' }, marbleCursor: 0 }
  const highlight = highlightFor(selection, ctx)
  // Source marble stays emphasized at its current ring cell (track index 0).
  expect(highlight).toContainEqual({ cell: { row: 12, col: 5 }, kind: 'selected' })
  // The '6' lands it six steps on (track index 6) — previewed as a landing square.
  expect(highlight).toContainEqual({ cell: { row: 7, col: 4 }, kind: 'landing' })
})

test('pickMarble on a 5 emphasizes the opponent marble and previews its push landing', () => {
  let state = createGame(['human', 'bot'])
  state = place(state, 'p1m0', { zone: 'track', index: 20 })
  state = setHand(state, 0, [{ rank: '5', suit: 'hearts' }])
  const ctx: TurnContext = { state, legalMoves: getLegalMoves(state, 0), human: 0 }
  const selection: Selection = { step: 'pickMarble', card: { rank: '5', suit: 'hearts' }, marbleCursor: 0 }
  const highlight = highlightFor(selection, ctx)
  // The opponent marble (p1m0) is emphasized at its ring cell (track index 20)...
  expect(highlight.some(entry => entry.kind === 'selected')).toBe(true)
  // ...and its push landing (track index 25) is previewed.
  expect(highlight).toContainEqual({ cell: ringCoord(25, 48), kind: 'landing' })
})

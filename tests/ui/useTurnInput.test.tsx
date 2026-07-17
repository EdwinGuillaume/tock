import { Text } from 'ink'
import { render } from 'ink-testing-library'
import { expect, test, vi } from 'vitest'
import { createGame } from '../../src/engine'
import type { GameState, Move } from '../../src/engine'
import { useTurnInput } from '../../src/ui/hooks/useTurnInput'
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
  state = setHand(state, 0, [{ rank: '5', suit: 'hearts' }])
  const onCommit = vi.fn()
  const { stdin } = render(<Harness state={state} onCommit={onCommit} />)
  stdin.write('\r')
  await tick()
  stdin.write('\r')
  await tick()
  expect(onCommit).toHaveBeenCalledTimes(1)
  expect(onCommit.mock.calls[0]?.[0]).toMatchObject({ type: 'move', marbleId: 'p0m0', steps: 5 })
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

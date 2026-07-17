import { render } from 'ink-testing-library'
import { expect, test } from 'vitest'
import { createGame, getLegalMoves } from '../../src/engine'
import type { GameState } from '../../src/engine'
import { SplitPanel } from '../../src/ui/SplitPanel'
import { initialSelection, reduce } from '../../src/ui/selection'
import type { TurnContext } from '../../src/ui/selection'
import { card, place, setHand } from '../support'

const strip = (frame: string | undefined): string => (frame ?? '').replace(/\[[0-9;]*m/g, '')

const contextFor = (state: GameState): TurnContext => ({
  state,
  legalMoves: getLegalMoves(state, 0),
  human: 0
})

test('shows candidate positions and the steps still to allocate', () => {
  let state = createGame(['human', 'bot'])
  state = place(state, 'p0m0', { zone: 'track', index: 0 })
  state = place(state, 'p0m1', { zone: 'track', index: 20 })
  state = setHand(state, 0, [card('7')])
  const ctx = contextFor(state)
  const selection = reduce(initialSelection(), { kind: 'confirm' }, ctx).selection
  if (selection.step !== 'splitAllocation') throw new Error('expected splitAllocation')

  const { lastFrame } = render(<SplitPanel selection={selection} ctx={ctx} />)
  const text = strip(lastFrame())
  expect(text).toContain('split 7')
  expect(text).toContain('7 left')
  expect(text).toContain('@0')
  expect(text).toContain('@20')
})

import { describe, expect, test } from 'vitest'
import { createGame, getLegalMoves } from '../../src/engine'
import type { GameState, Move } from '../../src/engine'
import { initialSelection, reduce } from '../../src/ui/selection'
import type { SelectionEvent, TurnContext } from '../../src/ui/selection'
import { card, place, setHand } from '../support'

const contextFor = (state: GameState): TurnContext => ({
  state,
  legalMoves: getLegalMoves(state, state.currentPlayer),
  human: state.currentPlayer
})

const run = (state: GameState, events: SelectionEvent[]) => {
  const ctx = contextFor(state)
  let selection = initialSelection()
  let commit: Move | undefined
  for (const event of events) {
    const result = reduce(selection, event, ctx)
    selection = result.selection
    commit = result.commit ?? commit
  }
  return { selection, commit }
}

describe('selection — card and marble picking', () => {
  test('picking a numbered card then its only marble commits the move', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = setHand(state, 0, [card('6')])
    const { commit } = run(state, [{ kind: 'confirm' }, { kind: 'confirm' }])
    expect(commit).toEqual({ type: 'move', card: card('6'), marbleId: 'p0m0', steps: 6 })
  })

  test('a card with two landing outcomes opens a destination choice', () => {
    // A marble near the lane mouth: a step count that can enter the lane OR stay.
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 44 })
    state = setHand(state, 0, [card('6')])
    const ctx = contextFor(state)
    const moves = ctx.legalMoves.filter(move => move.type === 'move')
    // Precondition: the engine really offers two outcomes here (ring + lane).
    expect(moves.length).toBe(2)
    // confirm card -> confirm marble -> now at pickDestination
    let selection = initialSelection()
    selection = reduce(selection, { kind: 'confirm' }, ctx).selection
    selection = reduce(selection, { kind: 'confirm' }, ctx).selection
    expect(selection.step).toBe('pickDestination')
    // cycle to the second option and commit it
    const afterRight = reduce(selection, { kind: 'right' }, ctx)
    const committed = reduce(afterRight.selection, { kind: 'confirm' }, ctx).commit
    expect(moves).toContainEqual(committed)
  })

  test('esc from pickMarble returns to pickCard', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = setHand(state, 0, [card('6')])
    const ctx = contextFor(state)
    let selection = initialSelection()
    selection = reduce(selection, { kind: 'confirm' }, ctx).selection
    expect(selection.step).toBe('pickMarble')
    selection = reduce(selection, { kind: 'back' }, ctx).selection
    expect(selection.step).toBe('pickCard')
  })
})

describe('selection — exit and Jack', () => {
  test('an exit card commits directly for its single marble', () => {
    let state = createGame(['human', 'bot'])
    state = setHand(state, 0, [card('A')])
    const { commit } = run(state, [{ kind: 'confirm' }, { kind: 'confirm' }])
    expect(commit?.type).toBe('exit')
  })

  test('a Jack routes marble -> target and commits a swap', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 3 })
    state = place(state, 'p1m0', { zone: 'track', index: 9 })
    state = setHand(state, 0, [card('J')])
    const ctx = contextFor(state)
    // Precondition: a swap is legal.
    expect(ctx.legalMoves.some(move => move.type === 'swap')).toBe(true)
    const { commit } = run(state, [{ kind: 'confirm' }, { kind: 'confirm' }, { kind: 'confirm' }])
    expect(commit?.type).toBe('swap')
  })
})

describe('selection — forced discard', () => {
  test('when only discards are legal, confirming a card discards it', () => {
    // All marbles home + a card that cannot exit -> only discards.
    let state = createGame(['human', 'bot'])
    state = setHand(state, 0, [card('5')])
    const ctx = contextFor(state)
    expect(ctx.legalMoves.every(move => move.type === 'discard')).toBe(true)
    const { commit } = run(state, [{ kind: 'confirm' }])
    expect(commit).toEqual({ type: 'discard', card: card('5') })
  })
})

describe('selection — push (the 5)', () => {
  test('picking a 5 then an opponent marble commits a push', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p1m0', { zone: 'track', index: 20 })
    state = setHand(state, 0, [card('5')])
    const ctx = contextFor(state)
    // Precondition: a push is legal.
    expect(ctx.legalMoves.some(move => move.type === 'push')).toBe(true)
    const { commit } = run(state, [{ kind: 'confirm' }, { kind: 'confirm' }])
    expect(commit).toEqual({ type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 })
  })
})

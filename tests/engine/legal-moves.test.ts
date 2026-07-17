import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { getLegalMoves } from '../../src/engine/moves'
import { place, setHand, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], 48, () => 0)

describe('getLegalMoves: exits', () => {
  it('offers an exit for each home marble on an Ace', () => {
    const state = setHand(game(), 0, [card('A')])
    const moveList = getLegalMoves(state, 0)
    expect(moveList.filter(move => move.type === 'exit')).toHaveLength(4)
  })

  it('does not offer an exit when the start cell holds an own marble', () => {
    let state = setHand(game(), 0, [card('K')])
    state = place(state, 'p0m0', { zone: 'track', index: 0 }) // start cell blocked
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'exit')).toBe(false)
  })
})

describe('getLegalMoves: linear moves', () => {
  it('offers a forward move for a marble on the ring', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    const moveList = getLegalMoves(state, 0)
    expect(moveList).toContainEqual({ type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5 })
  })

  it('rejects a move that lands on an own marble', () => {
    let state = setHand(game(), 0, [card('2')])
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    state = place(state, 'p0m1', { zone: 'track', index: 12 })
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'move' && move.marbleId === 'p0m0')).toBe(false)
  })
})

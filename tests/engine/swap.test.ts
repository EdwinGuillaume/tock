import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { getLegalMoves, applyMove } from '../../src/engine/moves'
import { place, setHand, findMarble, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], () => 0)

describe('jack swap', () => {
  it('offers a swap between own and opponent ring marbles', () => {
    let state = setHand(game(), 0, [card('J')])
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p1m0', { zone: 'track', index: 20 })
    const moveList = getLegalMoves(state, 0)
    expect(moveList).toContainEqual({ type: 'swap', card: card('J'), marbleId: 'p0m0', targetMarbleId: 'p1m0' })
  })

  it('does not swap with home or finish marbles', () => {
    let state = setHand(game(), 0, [card('J')])
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p1m0', { zone: 'finish', index: 0 })
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'swap')).toBe(false)
  })

  it('exchanges positions when applied', () => {
    let state = setHand(game(), 0, [card('J')])
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p1m0', { zone: 'track', index: 20 })
    const next = applyMove(state, { type: 'swap', card: card('J'), marbleId: 'p0m0', targetMarbleId: 'p1m0' })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'track', index: 20 })
    expect(findMarble(next, 'p1m0').position).toEqual({ zone: 'track', index: 5 })
  })

  it('does not offer an own marble protected on its start cell as a swap source', () => {
    let state = setHand(game(), 0, [card('J')])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })  // own marble on its own start (protected)
    state = place(state, 'p1m0', { zone: 'track', index: 20 }) // unprotected enemy on the ring
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'swap')).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { getLegalMoves } from '../../src/engine/moves'
import { place, setHand, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], 48, () => 0)

describe('start-square protection', () => {
  it('cannot land on an opponent protected on its start cell', () => {
    let state = setHand(game(), 0, [card('3')])
    state = place(state, 'p0m0', { zone: 'track', index: 9 })
    state = place(state, 'p1m0', { zone: 'track', index: 12 }) // player 1 start = 12
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'move' && move.marbleId === 'p0m0')).toBe(false)
  })

  it('cannot pass over a protected marble', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 9 })
    state = place(state, 'p1m0', { zone: 'track', index: 12 }) // sits between 9 and 14
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'move' && move.marbleId === 'p0m0')).toBe(false)
  })

  it('is not protected once off its own start cell', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 9 })
    state = place(state, 'p1m0', { zone: 'track', index: 13 }) // off its start (12) -> not protected
    const moveList = getLegalMoves(state, 0)
    // p0m0 + 5 -> lands on 14, passing over 13 (unprotected) is allowed
    expect(moveList.some(move => move.type === 'move' && move.marbleId === 'p0m0')).toBe(true)
  })

  it('excludes a protected marble as a jack target', () => {
    let state = setHand(game(), 0, [card('J')])
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p1m0', { zone: 'track', index: 12 }) // protected on its start
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'swap')).toBe(false)
  })

  it('does not let an own marble parked at its start block a lane entry that never crosses it', () => {
    let state = setHand(game(), 0, [card('10')])
    state = place(state, 'p0m0', { zone: 'track', index: 40 }) // mover: 10 steps reaches finish index 2
    state = place(state, 'p0m1', { zone: 'track', index: 0 })  // own marble on its start (protected)
    const moveList = getLegalMoves(state, 0)
    // enter-lane path (40 -> mouth 47 -> finish) never touches ring cell 0, so it must be offered
    expect(moveList).toContainEqual({ type: 'move', card: card('10'), marbleId: 'p0m0', steps: 10, enterLane: true })
    // stay-on-ring path (40 -> 2) DOES cross the protected cell 0, so it must be rejected
    expect(moveList.some(move => move.type === 'move' && move.marbleId === 'p0m0' && move.enterLane === undefined)).toBe(false)
  })
})

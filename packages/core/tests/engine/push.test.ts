import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { getLegalMoves, applyMove } from '../../src/engine/moves'
import { place, setHand, card, findMarble } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], 48, () => 0)

describe('getLegalMoves: push (the 5)', () => {
  it('offers a push for each eligible opponent marble on the ring', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p1m0', { zone: 'track', index: 20 })
    const moveList = getLegalMoves(state, 0)
    expect(moveList).toContainEqual({ type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 })
  })

  it('does not push an opponent protected on its own start cell', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p1m0', { zone: 'track', index: 12 }) // player 1 start = 12, protected
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'push')).toBe(false)
  })

  it('does not push the player\'s own marbles', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 20 }) // own marble on the ring
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'push')).toBe(false)
  })

  it('does not push a marble in the nest or the finish', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p1m0', { zone: 'finish', index: 0 }) // off the ring
    // p1m1..p1m3 remain home; no opponent is on the ring
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'push')).toBe(false)
  })

  it('does not push over a protected marble in the path', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p1m0', { zone: 'track', index: 20 }) // 20 -> 25 passes over 24
    state = place(state, 'p2m0', { zone: 'track', index: 24 }) // player 2 start = 24, protected
    const moveList = getLegalMoves(state, 0)
    // p2m0 is protected (no push), and p1m0's path crosses it (no push)
    expect(moveList.some(move => move.type === 'push')).toBe(false)
  })

  it('emits a push for each of two eligible opponent marbles', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p1m0', { zone: 'track', index: 20 }) // -> 25, clear and unprotected
    state = place(state, 'p2m0', { zone: 'track', index: 5 }) // -> 10, clear and unprotected
    const moveList = getLegalMoves(state, 0)
    expect(moveList.filter(move => move.type === 'push')).toHaveLength(2)
  })
})

describe('applyMove: push (the 5)', () => {
  it('advances the pushed opponent marble forward exactly 5', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p1m0', { zone: 'track', index: 20 })
    const next = applyMove(state, { type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 })
    expect(findMarble(next, 'p1m0').position).toEqual({ zone: 'track', index: 25 })
  })

  it('keeps the pushed marble on the ring when it crosses its own mouth (overshoot)', () => {
    // player 1 mouth = 11, start = 12. From index 8 a push of 5 would reach the
    // lane geometrically, but a push is ring-only: it overshoots to track 13.
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p1m0', { zone: 'track', index: 8 })
    const next = applyMove(state, { type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 })
    expect(findMarble(next, 'p1m0').position).toEqual({ zone: 'track', index: 13 })
  })

  it('captures a third player\'s marble the push lands on', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p1m0', { zone: 'track', index: 20 })
    state = place(state, 'p2m0', { zone: 'track', index: 25 }) // sits on the landing cell
    const next = applyMove(state, { type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 })
    expect(findMarble(next, 'p1m0').position).toEqual({ zone: 'track', index: 25 })
    expect(findMarble(next, 'p2m0').position).toEqual({ zone: 'home' })
  })

  it('does not mutate the input state', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p1m0', { zone: 'track', index: 20 })
    const before = findMarble(state, 'p1m0').position
    applyMove(state, { type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 })
    expect(findMarble(state, 'p1m0').position).toEqual(before)
  })
})

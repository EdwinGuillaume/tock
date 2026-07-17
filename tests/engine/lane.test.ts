import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { getLegalMoves, applyMove } from '../../src/engine/moves'
import { place, setHand, findMarble, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], 48, () => 0)

describe('lane entry choice', () => {
  it('offers both stay-on-ring and enter-lane for a crossing displacement', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 45 }) // player 0 mouth = 47
    const moveList = getLegalMoves(state, 0).filter(move => move.type === 'move' && move.marbleId === 'p0m0')
    expect(moveList).toContainEqual({ type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5 })
    expect(moveList).toContainEqual({ type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5, enterLane: true })
  })

  it('applies the enter-lane choice into the finish', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 45 })
    const next = applyMove(state, { type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5, enterLane: true })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'finish', index: 2 })
  })

  it('never offers a lane entry for a backward 4 — only the ring move', () => {
    let state = setHand(game(), 0, [card('4')])
    state = place(state, 'p0m0', { zone: 'track', index: 0 }) // on its start cell
    const moveList = getLegalMoves(state, 0)
    // the marble only steps back on the ring (0 - 4 -> index 44); a marble
    // cannot enter its home going backward, so no enter-lane move is generated
    expect(moveList).toContainEqual({ type: 'move', card: card('4'), marbleId: 'p0m0', steps: -4 })
    expect(moveList.some(move =>
      move.type === 'move' && move.marbleId === 'p0m0' && move.enterLane === true
    )).toBe(false)
  })

  it('moves a marble deeper inside the finish with exact count', () => {
    let state = setHand(game(), 0, [card('2')])
    state = place(state, 'p0m0', { zone: 'finish', index: 0 })
    const next = applyMove(state, { type: 'move', card: card('2'), marbleId: 'p0m0', steps: 2 })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'finish', index: 2 })
  })

  it('rejects overshooting the last finish cell', () => {
    let state = setHand(game(), 0, [card('6')])
    state = place(state, 'p0m0', { zone: 'finish', index: 1 }) // 1 + 6 = 7 > 3
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'move' && move.marbleId === 'p0m0')).toBe(false)
  })

  it('declares a winner when all four marbles reach the finish', () => {
    // three marbles parked deepest-first (3,2,1); the last enters finish 0
    let state = setHand(game(), 0, [card('2')])
    state = place(state, 'p0m0', { zone: 'finish', index: 3 })
    state = place(state, 'p0m1', { zone: 'finish', index: 2 })
    state = place(state, 'p0m2', { zone: 'finish', index: 1 })
    state = place(state, 'p0m3', { zone: 'track', index: 46 }) // mouth 47: +2 enters finish 0
    const next = applyMove(state, { type: 'move', card: card('2'), marbleId: 'p0m3', steps: 2, enterLane: true })
    expect(findMarble(next, 'p0m3').position).toEqual({ zone: 'finish', index: 0 })
    expect(next.winner).toBe(0)
  })

  it('does not let a finish move jump over an own parked marble in the lane', () => {
    let state = setHand(game(), 0, [card('3')])
    state = place(state, 'p0m0', { zone: 'finish', index: 0 })
    state = place(state, 'p0m1', { zone: 'finish', index: 2 }) // parked ahead in the lane
    const moveList = getLegalMoves(state, 0)
    // p0m0 (finish 0) + 3 -> finish 3 would jump over p0m1 at finish 2 -> illegal
    expect(moveList.some(move => move.type === 'move' && move.marbleId === 'p0m0')).toBe(false)
  })
})

describe('lane entry on a 72-cell ring', () => {
  const bigGame = () => createGame(['human', 'bot', 'bot', 'bot'], 72, () => 0)

  it('enters the finish across the mouth at index 71', () => {
    // player 0 mouth = 71. From 69 a 5 crosses the mouth at step 2, remaining
    // 3 -> finish index 2 (an index that only exists on the 72-cell ring).
    let state = setHand(bigGame(), 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 69 })
    const next = applyMove(state, { type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5, enterLane: true })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'finish', index: 2 })
  })

  it('exits onto the start square that sits 18 cells into the ring', () => {
    // seat 1 starts at index 18 on a 72-ring (it would be 12 on a 48-ring).
    const state = setHand({ ...bigGame(), currentPlayer: 1 }, 1, [card('A')])
    const next = applyMove(state, { type: 'exit', card: card('A'), marbleId: 'p1m0' })
    expect(findMarble(next, 'p1m0').position).toEqual({ zone: 'track', index: 18 })
  })
})

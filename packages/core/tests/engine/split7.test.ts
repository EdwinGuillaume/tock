import { describe, it, expect } from 'vitest'
import type { Move } from '../../src/engine/types'
import { createGame } from '../../src/engine/state'
import { getLegalMoves, applyMove } from '../../src/engine/moves'
import { place, setHand, findMarble, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], 48, () => 0)
const isSplit = (move: Move): move is Extract<Move, { type: 'split7' }> => move.type === 'split7'

describe('split 7', () => {
  it('offers a single-marble full 7', () => {
    let state = setHand(game(), 0, [card('7')])
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    const splitList = getLegalMoves(state, 0).filter(isSplit)
    expect(splitList).toContainEqual({
      type: 'split7', card: card('7'),
      partList: [{ marbleId: 'p0m0', steps: 7 }]
    })
  })

  it('offers a two-marble split totalling 7', () => {
    let state = setHand(game(), 0, [card('7')])
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    state = place(state, 'p0m1', { zone: 'track', index: 20 })
    const splitList = getLegalMoves(state, 0).filter(isSplit)
    const totalList = splitList.map(move => move.partList.reduce((sum, part) => sum + part.steps, 0))
    expect(totalList.every(total => total === 7)).toBe(true)
    expect(splitList.some(move => move.partList.length === 2)).toBe(true)
  })

  it('applies a split sequentially', () => {
    let state = setHand(game(), 0, [card('7')])
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    state = place(state, 'p0m1', { zone: 'track', index: 20 })
    const next = applyMove(state, {
      type: 'split7', card: card('7'),
      partList: [{ marbleId: 'p0m0', steps: 3 }, { marbleId: 'p0m1', steps: 4 }]
    })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'track', index: 13 })
    expect(findMarble(next, 'p0m1').position).toEqual({ zone: 'track', index: 24 })
  })

  it('finds a split that is only legal under a specific application order', () => {
    let state = setHand(game(), 0, [card('7')])
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    state = place(state, 'p0m1', { zone: 'track', index: 13 })
    const splitList = getLegalMoves(state, 0).filter(isSplit)
    const matches = (move: Extract<import('../../src/engine/types').Move, { type: 'split7' }>) => {
      const stepsById = new Map(move.partList.map(part => [part.marbleId, part.steps]))
      return move.partList.length === 2 && stepsById.get('p0m0') === 3 && stepsById.get('p0m1') === 4
    }
    expect(splitList.some(matches)).toBe(true)
    const chosen = splitList.find(matches)
    if (!chosen) throw new Error('expected partition not found')
    const next = applyMove(state, chosen)
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'track', index: 13 })
    expect(findMarble(next, 'p0m1').position).toEqual({ zone: 'track', index: 17 })
  })
})

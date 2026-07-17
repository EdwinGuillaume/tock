import { describe, it, expect } from 'vitest'
import { pickMove, pickRandomMove } from '../../src/ai/bot'
import { scoreMove } from '../../src/ai/score'
import { createGame, getLegalMoves } from '../../src/engine'
import { place, setHand, card } from '../../tests/support'
import type { GameState, Move } from '../../src/engine'

const game = (): GameState => createGame(['bot', 'bot', 'bot', 'bot'], 48, () => 0)

describe('pickRandomMove', () => {
  const moveList: Move[] = [
    { type: 'discard', card: card('2') },
    { type: 'discard', card: card('3') },
    { type: 'discard', card: card('4') }
  ]

  it('selects deterministically from the injected RNG', () => {
    expect(pickRandomMove(moveList, () => 0)).toBe(moveList[0])
    expect(pickRandomMove(moveList, () => 0.9)).toBe(moveList[2]) // floor(0.9 * 3) = 2
  })

  it('throws on an empty list', () => {
    expect(() => pickRandomMove([], () => 0)).toThrow()
  })
})

describe('pickMove', () => {
  it('returns the highest-scoring legal move', () => {
    // p0m0 can capture p1m0 with a 5; p0m1 can only advance -> capture wins
    const state = setHand(
      place(
        place(place(game(), 'p0m0', { zone: 'track', index: 0 }), 'p0m1', { zone: 'track', index: 30 }),
        'p1m0',
        { zone: 'track', index: 5 }
      ),
      0,
      [card('5')]
    )
    expect(pickMove(state, () => 0)).toMatchObject({ type: 'move', marbleId: 'p0m0', steps: 5 })
  })

  it('breaks ties using the RNG, always choosing a top-scored move', () => {
    // two equal forward moves (no capture, no danger) -> a genuine tie
    const state = setHand(
      place(place(game(), 'p0m0', { zone: 'track', index: 5 }), 'p0m1', { zone: 'track', index: 25 }),
      0,
      [card('3')]
    )
    const bestScore = Math.max(...getLegalMoves(state, 0).map(move => scoreMove(state, move)))
    const pickList = [0, 0.34, 0.67, 0.99].map(value => pickMove(state, () => value))
    for (const chosen of pickList) {
      expect(scoreMove(state, chosen)).toBe(bestScore)
    }
    expect(new Set(pickList.map(move => JSON.stringify(move))).size).toBeGreaterThan(1)
  })

  it('throws when the current player has no legal move (empty hand)', () => {
    const state = setHand(game(), 0, [])
    expect(() => pickMove(state, () => 0)).toThrow()
  })
})

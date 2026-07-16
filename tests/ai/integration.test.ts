import { afterEach, describe, it, expect } from 'vitest'
import { pickMove, scoreMove, pickRandomMove, WEIGHTS } from '../../src/ai'
import { applyMove, createGame, getLegalMoves } from '../../src/engine'

// Deterministic Park-Miller LCG so self-play is fully reproducible. The engine's
// applyMove refills empty hands via redealIfNeeded, which uses Math.random by
// default (applyMove takes no RNG argument), so we point Math.random at the same
// seeded stream for the duration of the run and restore it afterwards — no
// uncontrolled randomness leaks into the test.
const makeRandom = (seed: number): (() => number) => {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

const realRandom = Math.random
afterEach(() => {
  Math.random = realRandom
})

describe('AI public API', () => {
  it('exposes the bot surface through the barrel', () => {
    expect(typeof pickMove).toBe('function')
    expect(typeof scoreMove).toBe('function')
    expect(typeof pickRandomMove).toBe('function')
    expect(WEIGHTS.finish).toBeGreaterThan(WEIGHTS.capture)
  })
})

describe('bot self-play', () => {
  it('plays four greedy bots deterministically to a conclusion without throwing', () => {
    const random = makeRandom(12345)
    Math.random = random
    let state = createGame(['bot', 'bot', 'bot', 'bot'], random)
    let iterations = 0
    const maxIterations = 20000
    while (state.winner === null && iterations < maxIterations) {
      iterations += 1
      // Lockstep invariant: every active hand depletes together and applyMove
      // refills them in the same step, so the current player always holds at
      // least one card and a legal move always exists — no turn is ever skipped.
      const moveList = getLegalMoves(state, state.currentPlayer)
      expect(moveList.length).toBeGreaterThan(0)
      state = applyMove(state, pickMove(state, random))
    }
    const someoneReachedFinish = state.marbleList.some(marble => marble.position.zone === 'finish')
    expect(state.winner !== null || someoneReachedFinish).toBe(true)
  })
})

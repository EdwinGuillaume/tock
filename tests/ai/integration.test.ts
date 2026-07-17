import { describe, it, expect } from 'vitest'
import { pickMove, scoreMove, pickRandomMove, WEIGHTS } from '../../src/ai'
import { applyMove, createGame, getLegalMoves } from '../../src/engine'

// Deterministic Park-Miller LCG so self-play is fully reproducible. The same
// seeded stream is threaded into createGame, pickMove (tie-break), and applyMove
// (per-turn draw + reshuffle), so nothing reads the global Math.random.
const makeRandom = (seed: number): (() => number) => {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

const playGame = (seed: number) => {
  const random = makeRandom(seed)
  let state = createGame(['bot', 'bot', 'bot', 'bot'], random)
  const moveLog: string[] = []
  let iterations = 0
  const maxIterations = 20000
  while (state.winner === null && iterations < maxIterations) {
    iterations += 1
    const moveList = getLegalMoves(state, state.currentPlayer)
    expect(moveList.length).toBeGreaterThan(0)
    // Continuous-draw invariant: every active seat always holds exactly five cards.
    for (const player of state.playerList) {
      if (player.kind !== 'inactive') expect(player.hand).toHaveLength(5)
    }
    const move = pickMove(state, random)
    moveLog.push(JSON.stringify(move))
    state = applyMove(state, move, random)
  }
  return { state, moveLog }
}

describe('AI public API', () => {
  it('exposes the bot surface through the barrel', () => {
    expect(typeof pickMove).toBe('function')
    expect(typeof scoreMove).toBe('function')
    expect(typeof pickRandomMove).toBe('function')
    expect(WEIGHTS.finish).toBeGreaterThan(WEIGHTS.capture)
  })
})

describe('bot self-play', () => {
  it('plays four greedy bots to a conclusion with every hand held at five', () => {
    const { state } = playGame(12345)
    const someoneReachedFinish = state.marbleList.some(marble => marble.position.zone === 'finish')
    expect(state.winner !== null || someoneReachedFinish).toBe(true)
  })

  it('is fully deterministic: two runs from the same seed match move for move', () => {
    const first = playGame(999)
    const second = playGame(999)
    expect(first.moveLog).toEqual(second.moveLog)
    expect(first.state).toEqual(second.state)
  })
})

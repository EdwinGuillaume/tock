import { describe, it, expect } from 'vitest'
import { createGame, getLegalMoves, applyMove } from '../../src/engine'

describe('engine integration', () => {
  it('plays legal moves without throwing and always offers at least one move', () => {
    // fixed rng for the initial deal; bots always take the first legal move
    let state = createGame(['bot', 'bot', 'bot', 'bot'], 48, () => 0)
    for (let ply = 0; ply < 2000 && state.winner === null; ply++) {
      const moveList = getLegalMoves(state, state.currentPlayer)
      expect(moveList.length).toBeGreaterThan(0) // at worst a discard is available
      state = applyMove(state, moveList[0]!)
    }
    // reached here without throwing; state is still a valid 4-seat game
    expect(state.playerList).toHaveLength(4)
  })

  it('re-exports the public functions', async () => {
    const engine = await import('../../src/engine')
    expect(typeof engine.createGame).toBe('function')
    expect(typeof engine.getLegalMoves).toBe('function')
    expect(typeof engine.applyMove).toBe('function')
  })
})

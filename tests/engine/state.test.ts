import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'

describe('createGame', () => {
  it('creates 4 marbles in home per active player and none for inactive seats', () => {
    const state = createGame(['human', 'bot', 'bot', 'inactive'])
    expect(state.marbleList.filter(marble => marble.owner === 0)).toHaveLength(4)
    expect(state.marbleList.filter(marble => marble.owner === 3)).toHaveLength(0)
    expect(state.marbleList.every(marble => marble.position.zone === 'home')).toBe(true)
  })

  it('deals a hand of 5 to each active player only', () => {
    const state = createGame(['human', 'bot', 'inactive', 'inactive'])
    expect(state.playerList[0]!.hand).toHaveLength(5)
    expect(state.playerList[1]!.hand).toHaveLength(5)
    expect(state.playerList[2]!.hand).toHaveLength(0)
  })

  it('starts on the first active player with no winner', () => {
    const state = createGame(['inactive', 'bot', 'bot', 'human'])
    expect(state.currentPlayer).toBe(1)
    expect(state.winner).toBeNull()
  })

  it('leaves the draw pile with the undealt remainder', () => {
    const state = createGame(['human', 'bot', 'bot', 'bot'])
    // 52 - (4 players * 5 cards) = 32
    expect(state.drawPile).toHaveLength(32)
  })
})

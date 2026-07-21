import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { applyMove, nextPlayer } from '../../src/engine/moves'
import { place, setHand, findMarble, card } from '../../tests/support'

const fourPlayers = () => createGame(['human', 'bot', 'bot', 'bot'], 48, () => 0)

describe('applyMove: exit', () => {
  it('moves a home marble onto its start cell', () => {
    let state = fourPlayers()
    state = setHand(state, 0, [card('A')])
    const next = applyMove(state, { type: 'exit', card: card('A'), marbleId: 'p0m0' })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'track', index: 0 })
  })

  it('does not mutate the input state', () => {
    let state = fourPlayers()
    state = setHand(state, 0, [card('A')])
    const before = findMarble(state, 'p0m0').position
    applyMove(state, { type: 'exit', card: card('A'), marbleId: 'p0m0' })
    expect(findMarble(state, 'p0m0').position).toEqual(before)
    expect(before).toEqual({ zone: 'home' })
  })
})

describe('applyMove: move + capture', () => {
  it('advances a marble along the ring', () => {
    let state = fourPlayers()
    state = setHand(state, 0, [card('6')])
    state = place(state, 'p0m0', { zone: 'track', index: 3 })
    const next = applyMove(state, { type: 'move', card: card('6'), marbleId: 'p0m0', steps: 6 })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'track', index: 9 })
  })

  it('sends an opponent marble home when landing on it', () => {
    let state = fourPlayers()
    state = setHand(state, 0, [card('3')])
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p1m0', { zone: 'track', index: 8 })
    const next = applyMove(state, { type: 'move', card: card('3'), marbleId: 'p0m0', steps: 3 })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'track', index: 8 })
    expect(findMarble(next, 'p1m0').position).toEqual({ zone: 'home' })
  })
})

describe('applyMove: bookkeeping', () => {
  it('discards the played card, refills the hand, and advances the turn', () => {
    let state = fourPlayers()
    state = setHand(state, 0, [card('A'), card('K')])
    const next = applyMove(state, { type: 'exit', card: card('A'), marbleId: 'p0m0' })
    // played A goes to the discard; a replacement is drawn, so the hand size is preserved
    expect(next.playerList[0]!.hand).toHaveLength(2)
    expect(next.playerList[0]!.hand).toContainEqual(card('K'))
    expect(next.discardPile).toContainEqual(card('A'))
    expect(next.currentPlayer).toBe(1)
  })

  it('nextPlayer skips inactive seats', () => {
    const state = createGame(['human', 'inactive', 'bot', 'inactive'], 48, () => 0)
    expect(nextPlayer({ ...state, currentPlayer: 0 })).toBe(2)
    expect(nextPlayer({ ...state, currentPlayer: 2 })).toBe(0)
  })
})

import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { getLegalMoves, applyMove } from '../../src/engine/moves'
import { setHand, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], () => 0)

describe('discard', () => {
  it('offers a discard per distinct rank when nothing is playable', () => {
    // all marbles in home, hand has no exit card -> must discard
    const state = setHand(game(), 0, [card('5'), card('5'), card('9')])
    const moveList = getLegalMoves(state, 0)
    expect(moveList.every(move => move.type === 'discard')).toBe(true)
    const rankSet = new Set(moveList.map(move => move.card.rank))
    expect(rankSet).toEqual(new Set(['5', '9']))
  })

  it('offers no discard when a real move exists', () => {
    const state = setHand(game(), 0, [card('A')]) // can exit
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'discard')).toBe(false)
  })
})

describe('redeal', () => {
  it('deals fresh hands once every active hand is empty', () => {
    let state = game()
    for (const seat of [0, 1, 2, 3] as const) {
      state = setHand(state, seat, [card('9')]) // home marbles, 9 cannot exit -> discard
    }
    // four discards, one per player, empties all hands then redeals
    state = applyMove(state, { type: 'discard', card: card('9') })
    state = applyMove(state, { type: 'discard', card: card('9') })
    state = applyMove(state, { type: 'discard', card: card('9') })
    state = applyMove(state, { type: 'discard', card: card('9') })
    expect(state.playerList[0]!.hand).toHaveLength(5)
    expect(state.playerList[3]!.hand).toHaveLength(5)
  })
})

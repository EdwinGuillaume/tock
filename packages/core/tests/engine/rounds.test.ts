import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { getLegalMoves, applyMove } from '../../src/engine/moves'
import { setHand, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], 48, () => 0)

describe('discard', () => {
  it('offers a discard per card when nothing is playable, so any card is discardable', () => {
    // all marbles in home, hand has no exit card -> must discard. Two same-rank
    // cards (different suits) must each be individually discardable, not collapsed
    // to one — the UI maps a chosen card to its move by rank AND suit.
    const state = setHand(game(), 0, [card('5', 'hearts'), card('5', 'spades'), card('9')])
    const moveList = getLegalMoves(state, 0)
    expect(moveList.every(move => move.type === 'discard')).toBe(true)
    expect(moveList).toContainEqual({ type: 'discard', card: card('5', 'hearts') })
    expect(moveList).toContainEqual({ type: 'discard', card: card('5', 'spades') })
    expect(moveList).toContainEqual({ type: 'discard', card: card('9') })
    expect(moveList).toHaveLength(3)
  })

  it('offers no discard when a real move exists', () => {
    const state = setHand(game(), 0, [card('A')]) // can exit
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'discard')).toBe(false)
  })
})

describe('continuous draw', () => {
  it('refills the hand to five and removes one card from the draw pile each turn', () => {
    let state = game()
    state = setHand(state, 0, [card('9'), card('9'), card('9'), card('9'), card('9')])
    const beforeDraw = state.drawPile.length
    const next = applyMove(state, { type: 'discard', card: card('9') })
    expect(next.playerList[0]!.hand).toHaveLength(5)
    expect(next.drawPile).toHaveLength(beforeDraw - 1)
    expect(next.discardPile).toContainEqual(card('9'))
  })

  it('reshuffles the discard pile (including the just-played card) into an empty draw pile', () => {
    let state = game()
    state = setHand(state, 0, [card('9'), card('9'), card('9'), card('9'), card('9')])
    state = { ...state, drawPile: [], discardPile: [card('2'), card('3')] }
    const next = applyMove(state, { type: 'discard', card: card('9') })
    // discard [2,3] + the just-played 9 = 3 cards reshuffled into the draw pile, one drawn
    expect(next.playerList[0]!.hand).toHaveLength(5)
    expect(next.discardPile).toEqual([])
    expect(next.drawPile).toHaveLength(2)
  })
})

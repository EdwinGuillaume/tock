import { describe, expect, it } from 'vitest'
import { createGame, getLegalMoves } from '@tock/core'
import {
  ghostsForCard,
  handIsPlayable,
  isDiscardOnly,
  isSplitCard,
  movesForCard,
  ownSwapMarbleIds,
  sameCard,
  swapMovesForCard,
  swapTargetsFor
} from '../src/moveSelection'
import { card, place, setHand } from './support'

describe('moveSelection', () => {
  it('sameCard matches on rank + suit', () => {
    expect(sameCard({ rank: 'A', suit: 'clubs' }, { rank: 'A', suit: 'clubs' })).toBe(true)
    expect(sameCard({ rank: 'A', suit: 'clubs' }, { rank: 'A', suit: 'spades' })).toBe(false)
  })

  it('movesForCard returns the exit move for an Ace with a home marble', () => {
    const state = setHand(createGame(['human', 'bot'], 48), 0, [card('A', 'clubs')])
    const legal = getLegalMoves(state, 0)
    const moveList = movesForCard(card('A', 'clubs'), legal)
    expect(moveList.length).toBeGreaterThanOrEqual(1)
    expect(moveList.every(move => move.type === 'exit')).toBe(true)
  })

  it('emits one ghost per legal landing of an exit move, each at a numeric cell', () => {
    const state = setHand(createGame(['human', 'bot'], 48), 0, [card('A', 'clubs')])
    const legal = getLegalMoves(state, 0)
    const ghostList = ghostsForCard(card('A', 'clubs'), state, legal)
    expect(ghostList.length).toBeGreaterThanOrEqual(1)
    expect(ghostList.every(ghost => typeof ghost.cx === 'number' && typeof ghost.cy === 'number')).toBe(true)
  })

  it('handIsPlayable is true for a playable Ace and false for a stranded 2', () => {
    const state = setHand(createGame(['human', 'bot'], 48), 0, [card('A', 'clubs'), card('2', 'clubs')])
    const legal = getLegalMoves(state, 0)
    expect(handIsPlayable(card('A', 'clubs'), legal)).toBe(true)
    expect(handIsPlayable(card('2', 'clubs'), legal)).toBe(false)
  })

  it('a 7 with a marble on the ring is a split card with no ghosts', () => {
    const state = setHand(
      place(createGame(['human', 'bot'], 48), 'p0m0', { zone: 'track', index: 10 }),
      0,
      [card('7', 'clubs')]
    )
    const legal = getLegalMoves(state, 0)
    expect(isSplitCard(card('7', 'clubs'), legal)).toBe(true)
    expect(ghostsForCard(card('7', 'clubs'), state, legal).length).toBe(0)
  })

  it('a Jack with an own and an enemy marble on the ring yields consistent swap helpers and no ghosts', () => {
    const state = setHand(
      place(
        place(createGame(['human', 'bot'], 48), 'p0m0', { zone: 'track', index: 10 }),
        'p1m0',
        { zone: 'track', index: 20 }
      ),
      0,
      [card('J', 'clubs')]
    )
    const legal = getLegalMoves(state, 0)
    const jack = card('J', 'clubs')
    expect(swapMovesForCard(jack, legal).length).toBeGreaterThanOrEqual(1)
    expect(ownSwapMarbleIds(jack, legal)).toContain('p0m0')
    expect(swapTargetsFor(jack, 'p0m0', legal).length).toBeGreaterThanOrEqual(1)
    expect(ghostsForCard(jack, state, legal).length).toBe(0)
  })

  it('an all-home hand with no exit or move is discard-only', () => {
    const state = setHand(createGame(['human', 'bot'], 48), 0, [card('2', 'clubs'), card('3', 'clubs')])
    const legal = getLegalMoves(state, 0)
    expect(isDiscardOnly(card('2', 'clubs'), legal)).toBe(true)
  })
})

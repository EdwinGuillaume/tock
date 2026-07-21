import { describe, it, expect } from 'vitest'
import { drawCard } from '../../src/engine/state'
import { card } from '../../tests/support'

describe('drawCard', () => {
  it('draws the top card and leaves the discard pile untouched when the draw pile has cards', () => {
    const result = drawCard([card('A'), card('2')], [card('K')], () => 0)
    expect(result.card).toEqual(card('A'))
    expect(result.drawPile).toEqual([card('2')])
    expect(result.discardPile).toEqual([card('K')])
  })

  it('reshuffles the discard pile into an empty draw pile, then draws', () => {
    const result = drawCard([], [card('3'), card('4')], () => 0)
    expect(result.card).toEqual(card('3'))
    expect(result.drawPile).toEqual([card('4')])
    expect(result.discardPile).toEqual([])
  })

  it('returns card: null and leaves both piles empty when both are empty', () => {
    const result = drawCard([], [], () => 0)
    expect(result.card).toBeNull()
    expect(result.drawPile).toEqual([])
    expect(result.discardPile).toEqual([])
  })
})

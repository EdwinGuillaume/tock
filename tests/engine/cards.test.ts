import { describe, it, expect } from 'vitest'
import { createDeck, moveSteps, canExit, shuffle } from '../../src/engine/cards'

describe('cards', () => {
  it('builds a 52-card deck with no duplicates', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)
    const keyList = deck.map(deckCard => `${deckCard.rank}-${deckCard.suit}`)
    expect(new Set(keyList).size).toBe(52)
  })

  it('maps ranks to step counts', () => {
    expect(moveSteps('A')).toBe(1)
    expect(moveSteps('K')).toBe(13)
    expect(moveSteps('Q')).toBe(12)
    expect(moveSteps('4')).toBe(-4)
    expect(moveSteps('10')).toBe(10)
    expect(moveSteps('J')).toBeNull()
    expect(moveSteps('7')).toBeNull()
    expect(moveSteps('2')).toBe(2)
    expect(moveSteps('3')).toBe(3)
    expect(moveSteps('5')).toBe(5)
    expect(moveSteps('6')).toBe(6)
    expect(moveSteps('8')).toBe(8)
    expect(moveSteps('9')).toBe(9)
  })

  it('knows which ranks can exit a marble', () => {
    expect(canExit('A')).toBe(true)
    expect(canExit('K')).toBe(true)
    expect(canExit('Q')).toBe(false)
  })

  it('shuffles into a new array with an injected rng', () => {
    const rng = () => 0
    const deck = createDeck()
    const shuffled = shuffle(deck, rng)
    expect(shuffled).toHaveLength(52)
    expect(shuffled).not.toBe(deck) // new array, input untouched
  })
})

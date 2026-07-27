import { describe, expect, it } from 'vitest'
import { cardRuleList, rulesGoal, specialMoveList } from '../src/rulesContent'

const everyRank = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

describe('rulesContent', () => {
  it('states a non-empty goal', () => {
    expect(rulesGoal.length).toBeGreaterThan(0)
  })

  it('covers all 13 card ranks exactly once', () => {
    const listed = cardRuleList.flatMap(rule => rule.ranks)
    expect(listed.slice().sort()).toEqual(everyRank.slice().sort())
  })

  it('gives every card rule a non-empty effect and at least one rank', () => {
    for (const rule of cardRuleList) {
      expect(rule.ranks.length).toBeGreaterThan(0)
      expect(rule.effect.length).toBeGreaterThan(0)
    }
  })

  it('lists the three special moves with non-empty text', () => {
    expect(specialMoveList).toHaveLength(3)
    for (const move of specialMoveList) {
      expect(move.title.length).toBeGreaterThan(0)
      expect(move.text.length).toBeGreaterThan(0)
    }
  })
})

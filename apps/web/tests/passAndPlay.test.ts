import { describe, expect, it } from 'vitest'
import { createGame } from '@tock/core'
import { activeHumanSeat, humanSeatIds, needsHandoff } from '../src/passAndPlay'

describe('pass-and-play gating', () => {
  it('lists only human seats', () => {
    const state = createGame(['human', 'bot', 'human'], 48)
    expect(humanSeatIds(state)).toEqual([0, 2])
  })

  it('requires a handoff when the turn passes to a different human', () => {
    const state = { ...createGame(['human', 'human'], 48), currentPlayer: 1 as const }
    expect(needsHandoff(0, state, [0, 1])).toBe(true)
  })

  it('does not require a handoff before a bot seat', () => {
    const state = { ...createGame(['human', 'bot'], 48), currentPlayer: 1 as const }
    expect(needsHandoff(0, state, [0])).toBe(false)
  })

  it('does not require a handoff in a solo (single human) game', () => {
    const state = { ...createGame(['human', 'bot'], 48), currentPlayer: 0 as const }
    expect(needsHandoff(1, state, [0])).toBe(false)
  })

  it('does not require a handoff when the current seat is a bot, even with two humans in the game', () => {
    const state = { ...createGame(['human', 'human', 'bot'], 48), currentPlayer: 2 as const }
    expect(needsHandoff(1, state, [0, 1])).toBe(false)
  })
})

describe('active human seat (whose hand to display)', () => {
  it('is the current seat when a human is playing', () => {
    const state = { ...createGame(['human', 'bot'], 48), currentPlayer: 0 as const }
    expect(activeHumanSeat(state, [0])).toBe(0)
  })

  it('stays the sole human while a bot is taking its turn (solo vs bots)', () => {
    const state = { ...createGame(['human', 'bot'], 48), currentPlayer: 1 as const }
    expect(activeHumanSeat(state, [0])).toBe(0)
  })

  it('is the human who last held the device while a bot plays between two humans', () => {
    // seats in turn order: human(0), bot(1), human(2), bot(3)
    const base = createGame(['human', 'bot', 'human', 'bot'], 48)
    expect(activeHumanSeat({ ...base, currentPlayer: 1 as const }, [0, 2])).toBe(0)
    expect(activeHumanSeat({ ...base, currentPlayer: 3 as const }, [0, 2])).toBe(2)
  })

  it('returns null when there is no human seat', () => {
    const state = createGame(['bot', 'bot'], 48)
    expect(activeHumanSeat(state, [])).toBeNull()
  })
})

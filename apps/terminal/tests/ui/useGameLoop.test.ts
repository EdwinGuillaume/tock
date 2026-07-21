import { describe, expect, test } from 'vitest'
import { createGame } from '@tock/core'
import { actorKind } from '../../src/ui/hooks/useGameLoop'
import { place } from '../support'

describe('useGameLoop — actorKind', () => {
  test('reports the human turn', () => {
    const state = createGame(['human', 'bot'])
    expect(actorKind(state, 0)).toBe('human')
  })

  test('reports a bot turn', () => {
    const state = { ...createGame(['human', 'bot']), currentPlayer: 1 as const }
    expect(actorKind(state, 0)).toBe('bot')
  })

  test('reports game over when a winner is set', () => {
    let state = createGame(['human', 'bot'])
    for (let slot = 0; slot < 4; slot++) state = place(state, `p0m${slot}`, { zone: 'finish', index: slot })
    state = { ...state, winner: 0 }
    expect(actorKind(state, 0)).toBe('gameover')
  })
})

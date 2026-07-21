import { describe, expect, test } from 'vitest'
import { applyMove, createGame } from '@tock/core'
import { moveLabel, positionLabel } from '../../src/ui/format'
import { card, place, setHand } from '../support'

describe('format — positionLabel', () => {
  test('labels each zone', () => {
    expect(positionLabel({ zone: 'home' })).toBe('home')
    expect(positionLabel({ zone: 'track', index: 12 })).toBe('@12')
    expect(positionLabel({ zone: 'finish', index: 0 })).toBe('finish 1')
  })
})

describe('format — moveLabel', () => {
  test('describes a plain forward move', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = setHand(state, 0, [card('6')])
    const move = { type: 'move', card: card('6'), marbleId: 'p0m0', steps: 6 } as const
    const after = applyMove(state, move)
    expect(moveLabel(state, after, move)).toBe('red plays 6 — @0→6')
  })

  test('flags a capture', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = place(state, 'p1m0', { zone: 'track', index: 6 })
    state = setHand(state, 0, [card('6')])
    const move = { type: 'move', card: card('6'), marbleId: 'p0m0', steps: 6 } as const
    const after = applyMove(state, move)
    expect(moveLabel(state, after, move)).toBe('red plays 6 — @0→6, captured!')
  })

  test('describes a discard', () => {
    const state = createGame(['human', 'bot'])
    const move = { type: 'discard', card: card('Q') } as const
    const after = applyMove(state, move)
    expect(moveLabel(state, after, move)).toBe('red discards Q')
  })

  test('describes a push', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p1m0', { zone: 'track', index: 20 })
    state = setHand(state, 0, [card('5')])
    const move = { type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 } as const
    const after = applyMove(state, move)
    expect(moveLabel(state, after, move)).toBe('red plays 5 — pushes green @20→25')
  })

  test('flags a capture on a push', () => {
    let state = createGame(['human', 'bot', 'bot', 'bot'])
    state = place(state, 'p1m0', { zone: 'track', index: 20 })
    state = place(state, 'p2m0', { zone: 'track', index: 25 })
    state = setHand(state, 0, [card('5')])
    const move = { type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 } as const
    const after = applyMove(state, move)
    expect(moveLabel(state, after, move)).toBe('red plays 5 — pushes green @20→25, captured!')
  })
})

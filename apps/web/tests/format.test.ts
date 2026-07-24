import { describe, expect, it } from 'vitest'
import type { Move } from '@tock/core'
import { applyMove, createGame, getLegalMoves } from '@tock/core'
import { card, findMarble, place, setHand } from './support'
import { moveLabel } from '../src/format'

describe('moveLabel', () => {
  it('appends the captured opponent, in its own colour, when a move sends it home', () => {
    let state = createGame(['human', 'bot'], 48)
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    state = place(state, 'p1m0', { zone: 'track', index: 13 })
    state = setHand(state, 0, [card('3', 'clubs')])

    const move = getLegalMoves(state, 0).find(candidate => candidate.type === 'move') as Move
    const after = applyMove(state, move)

    // The move really did capture: the opponent marble is back home.
    expect(findMarble(after, 'p1m0').position.zone).toBe('home')

    const entry = moveLabel(state, after, move)
    expect(entry.some(segment => typeof segment === 'string' && segment.includes('capture'))).toBe(true)
    // Player 1 is green — its name renders as a coloured token.
    expect(entry.some(segment => typeof segment === 'object' && segment.color === 'green')).toBe(true)
  })

  it('adds no capture clause for a plain move that lands on an empty cell', () => {
    let state = createGame(['human', 'bot'], 48)
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    state = setHand(state, 0, [card('3', 'clubs')])

    const move = getLegalMoves(state, 0).find(candidate => candidate.type === 'move') as Move
    const after = applyMove(state, move)

    const entry = moveLabel(state, after, move)
    expect(entry.some(segment => typeof segment === 'string' && segment.includes('capture'))).toBe(false)
  })
})

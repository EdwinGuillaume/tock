import { describe, it, expect } from 'vitest'
import type { Position, Move, Card } from '../../src/engine/types'

describe('core types', () => {
  it('constructs a track position', () => {
    const position: Position = { zone: 'track', index: 5 }
    expect(position.index).toBe(5)
  })

  it('constructs a discard move', () => {
    const playedCard: Card = { rank: 'A', suit: 'hearts' }
    const move: Move = { type: 'discard', card: playedCard }
    expect(move.type).toBe('discard')
  })
})

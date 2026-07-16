import { describe, it, expect } from 'vitest'
import { exposureFor } from '../../src/ai/score'
import { createGame } from '../../src/engine'
import { place } from '../../tests/support'
import type { GameState, MarbleId, Position } from '../../src/engine'

const game = (): GameState => createGame(['bot', 'bot', 'bot', 'bot'], () => 0)

const withMarbles = (entryList: [MarbleId, Position][]): GameState =>
  entryList.reduce((state, [id, position]) => place(state, id, position), game())

describe('exposureFor', () => {
  it('penalises an own marble with an opponent one cell behind (strongest forward threat)', () => {
    const state = withMarbles([
      ['p0m0', { zone: 'track', index: 5 }],
      ['p1m0', { zone: 'track', index: 4 }]
    ])
    expect(exposureFor(state, 0)).toBe(13) // 14 - 1
  })

  it('is zero when the nearest opponent is out of reach', () => {
    const state = withMarbles([
      ['p0m0', { zone: 'track', index: 5 }],
      ['p1m0', { zone: 'track', index: 20 }]
    ])
    expect(exposureFor(state, 0)).toBe(0)
  })

  it('never penalises a marble protected on its own start square', () => {
    const state = withMarbles([
      ['p0m0', { zone: 'track', index: 0 }], // player 0 start
      ['p1m0', { zone: 'track', index: 47 }] // one cell behind
    ])
    expect(exposureFor(state, 0)).toBe(0)
  })

  it('counts the backward-4 threat from an opponent just ahead', () => {
    const state = withMarbles([
      ['p0m0', { zone: 'track', index: 5 }],
      ['p1m0', { zone: 'track', index: 8 }] // 3 ahead
    ])
    expect(exposureFor(state, 0)).toBe(2) // 5 - 3
  })

  it('keeps only the strongest threat per marble', () => {
    const state = withMarbles([
      ['p0m0', { zone: 'track', index: 5 }],
      ['p1m0', { zone: 'track', index: 4 }], // 1 behind -> 13
      ['p2m0', { zone: 'track', index: 8 }] // 3 ahead -> 2
    ])
    expect(exposureFor(state, 0)).toBe(13)
  })

  it('sums exposure across several own marbles', () => {
    const state = withMarbles([
      ['p0m0', { zone: 'track', index: 5 }],
      ['p1m0', { zone: 'track', index: 4 }], // threatens p0m0 -> 13
      ['p0m1', { zone: 'track', index: 30 }],
      ['p2m0', { zone: 'track', index: 29 }] // threatens p0m1 -> 13
    ])
    expect(exposureFor(state, 0)).toBe(26)
  })

  it('ignores own marbles off the track (home or finish)', () => {
    const state = withMarbles([
      ['p0m0', { zone: 'finish', index: 0 }],
      ['p1m0', { zone: 'track', index: 47 }]
    ])
    expect(exposureFor(state, 0)).toBe(0)
  })

  it('scores the farthest forward threat (13 behind) at weight 1, and 14 behind at 0', () => {
    const atThirteen = withMarbles([
      ['p0m0', { zone: 'track', index: 20 }],
      ['p1m0', { zone: 'track', index: 7 }] // 13 behind
    ])
    const atFourteen = withMarbles([
      ['p0m0', { zone: 'track', index: 20 }],
      ['p1m0', { zone: 'track', index: 6 }] // 14 behind, out of reach
    ])
    expect(exposureFor(atThirteen, 0)).toBe(1)
    expect(exposureFor(atFourteen, 0)).toBe(0)
  })

  it('scores the farthest backward-4 threat (4 ahead) at weight 1, and 5 ahead at 0', () => {
    const atFour = withMarbles([
      ['p0m0', { zone: 'track', index: 20 }],
      ['p1m0', { zone: 'track', index: 24 }] // 4 ahead
    ])
    const atFive = withMarbles([
      ['p0m0', { zone: 'track', index: 20 }],
      ['p1m0', { zone: 'track', index: 25 }] // 5 ahead, out of reach
    ])
    expect(exposureFor(atFour, 0)).toBe(1)
    expect(exposureFor(atFive, 0)).toBe(0)
  })
})

import { describe, it, expect } from 'vitest'
import { advancement, WEIGHTS } from '../../src/ai/score'
import { startCell } from '../../src/engine'
import type { Marble } from '../../src/engine'

const marbleAt = (owner: 0 | 1 | 2 | 3, position: Marble['position']): Marble => ({
  id: `p${owner}m0`,
  owner,
  position
})

describe('advancement (48-cell ring)', () => {
  it('scores a home marble at 0', () => {
    expect(advancement(marbleAt(0, { zone: 'home' }), 48)).toBe(0)
  })

  it('scores a marble on its own start square at 1', () => {
    expect(advancement(marbleAt(0, { zone: 'track', index: startCell(0, 48) }), 48)).toBe(1)
  })

  it('increases as a marble advances along the ring', () => {
    const near = advancement(marbleAt(0, { zone: 'track', index: startCell(0, 48) + 3 }), 48)
    const far = advancement(marbleAt(0, { zone: 'track', index: startCell(0, 48) + 20 }), 48)
    expect(far).toBeGreaterThan(near)
  })

  it('measures distance from the owner start, wrapping the ring', () => {
    // player 1 starts at 12; index 11 is one cell behind it (the lane mouth),
    // i.e. almost a full lap travelled
    expect(advancement(marbleAt(1, { zone: 'track', index: 11 }), 48)).toBe(48)
  })

  it('ranks any finish slot above any track cell, deeper slots higher', () => {
    const track = advancement(marbleAt(0, { zone: 'track', index: startCell(0, 48) + 20 }), 48)
    const shallow = advancement(marbleAt(0, { zone: 'finish', index: 0 }), 48)
    const deep = advancement(marbleAt(0, { zone: 'finish', index: 3 }), 48)
    expect(shallow).toBeGreaterThan(track)
    expect(deep).toBeGreaterThan(shallow)
  })
})

describe('advancement (72-cell ring)', () => {
  it('measures distance from the owner start, wrapping the bigger ring', () => {
    // seat 1 starts at 18 on a 72-ring; index 17 is the lane mouth just behind
    // it -> a near-full 71-cell lap travelled.
    expect(advancement(marbleAt(1, { zone: 'track', index: 17 }), 72)).toBe(72)
  })

  it('ranks a finish slot above every ring cell on the 72-ring', () => {
    const farTrack = advancement(marbleAt(0, { zone: 'track', index: startCell(0, 72) + 60 }), 72)
    const shallow = advancement(marbleAt(0, { zone: 'finish', index: 0 }), 72)
    expect(shallow).toBe(73) // ringSize + 1 + 0
    expect(shallow).toBeGreaterThan(farTrack)
  })
})

describe('WEIGHTS ordering (the scoring contract)', () => {
  it('ranks parking > capture > exit > per-cell progress, with a positive exposure penalty', () => {
    expect(WEIGHTS.finish).toBeGreaterThan(WEIGHTS.capture)
    expect(WEIGHTS.capture).toBeGreaterThan(WEIGHTS.exit)
    expect(WEIGHTS.exit).toBeGreaterThan(WEIGHTS.progress)
    expect(WEIGHTS.exposure).toBeGreaterThan(0)
  })
})

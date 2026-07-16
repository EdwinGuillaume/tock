import { describe, it, expect } from 'vitest'
import { advancement, WEIGHTS } from '../../src/ai/score'
import { startCell } from '../../src/engine'
import type { Marble } from '../../src/engine'

const marbleAt = (owner: 0 | 1 | 2 | 3, position: Marble['position']): Marble => ({
  id: `p${owner}m0`,
  owner,
  position
})

describe('advancement', () => {
  it('scores a home marble at 0', () => {
    expect(advancement(marbleAt(0, { zone: 'home' }))).toBe(0)
  })

  it('scores a marble on its own start square at 1', () => {
    expect(advancement(marbleAt(0, { zone: 'track', index: startCell(0) }))).toBe(1)
  })

  it('increases as a marble advances along the ring', () => {
    const near = advancement(marbleAt(0, { zone: 'track', index: startCell(0) + 3 }))
    const far = advancement(marbleAt(0, { zone: 'track', index: startCell(0) + 20 }))
    expect(far).toBeGreaterThan(near)
  })

  it('measures distance from the owner start, wrapping the ring', () => {
    // player 1 starts at 12; index 11 is one cell behind it (the lane mouth),
    // i.e. almost a full lap travelled
    expect(advancement(marbleAt(1, { zone: 'track', index: 11 }))).toBe(48)
  })

  it('ranks any finish slot above any track cell, deeper slots higher', () => {
    const track = advancement(marbleAt(0, { zone: 'track', index: startCell(0) + 20 }))
    const shallow = advancement(marbleAt(0, { zone: 'finish', index: 0 }))
    const deep = advancement(marbleAt(0, { zone: 'finish', index: 3 }))
    expect(shallow).toBeGreaterThan(track)
    expect(deep).toBeGreaterThan(shallow)
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

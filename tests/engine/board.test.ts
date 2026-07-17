import { describe, it, expect } from 'vitest'
import { startCell, laneMouth, ringDestinations, quadrantSize } from '../../src/engine/board'

describe('board geometry (48-cell ring)', () => {
  it('derives 12 cells per quadrant', () => {
    expect(quadrantSize(48)).toBe(12)
  })

  it('places start cells one quadrant apart', () => {
    expect(startCell(0, 48)).toBe(0)
    expect(startCell(1, 48)).toBe(12)
    expect(startCell(3, 48)).toBe(36)
  })

  it('places the lane mouth just behind the start cell', () => {
    expect(laneMouth(0, 48)).toBe(47)
    expect(laneMouth(1, 48)).toBe(11)
  })

  it('moves forward on the ring without reaching the mouth', () => {
    const reach = ringDestinations(0, 5, 3, 48)
    expect(reach.ring).toEqual({ zone: 'track', index: 8 })
    expect(reach.lane).toBeNull()
  })

  it('wraps forward around the ring', () => {
    expect(ringDestinations(1, 46, 5, 48).ring).toEqual({ zone: 'track', index: 3 })
    expect(ringDestinations(1, 46, 5, 48).lane).toBeNull()
  })

  it('offers a lane landing when a forward path crosses the mouth', () => {
    // player 0, mouth at 47. From 45 forward 5: crosses 47 at step 2,
    // remaining 3 -> finish index 2. Ring-stay lands on 2.
    const reach = ringDestinations(0, 45, 5, 48)
    expect(reach.ring).toEqual({ zone: 'track', index: 2 })
    expect(reach.lane).toEqual({ zone: 'finish', index: 2 })
  })

  it('keeps a backward 4 on the ring — a marble never enters its home going backward', () => {
    // player 0 on its start (0), backward 4: even though the path crosses the
    // mouth (47), a backward move never diverts into the finish lane. It stays
    // on the ring at index 44.
    const reach = ringDestinations(0, 0, -4, 48)
    expect(reach.ring).toEqual({ zone: 'track', index: 44 })
    expect(reach.lane).toBeNull()
  })

  it('rejects overshooting the lane', () => {
    // player 0 from 45 forward 8 would be finish index 5 -> no lane landing
    expect(ringDestinations(0, 45, 8, 48).lane).toBeNull()
  })
})

describe('board geometry (72-cell ring)', () => {
  it('derives 18 cells per quadrant', () => {
    expect(quadrantSize(72)).toBe(18)
  })

  it('places start cells one 18-cell quadrant apart', () => {
    expect(startCell(0, 72)).toBe(0)
    expect(startCell(1, 72)).toBe(18)
    expect(startCell(2, 72)).toBe(36)
    expect(startCell(3, 72)).toBe(54)
  })

  it('places the lane mouth just behind the start cell', () => {
    expect(laneMouth(0, 72)).toBe(71)
    expect(laneMouth(1, 72)).toBe(17)
  })

  it('offers a lane landing when a forward path crosses the mouth', () => {
    // player 0, mouth at 71. From 69 forward 5: crosses 71 at step 2,
    // remaining 3 -> finish index 2. Ring-stay lands on index 2.
    const reach = ringDestinations(0, 69, 5, 72)
    expect(reach.ring).toEqual({ zone: 'track', index: 2 })
    expect(reach.lane).toEqual({ zone: 'finish', index: 2 })
  })

  it('keeps a backward 4 on the ring on the big ring too', () => {
    const reach = ringDestinations(0, 0, -4, 72)
    expect(reach.ring).toEqual({ zone: 'track', index: 68 })
    expect(reach.lane).toBeNull()
  })
})

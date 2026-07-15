import { describe, it, expect } from 'vitest'
import { startCell, laneMouth, ringDestinations } from '../../src/engine/board'

describe('board geometry', () => {
  it('places start cells one quadrant apart', () => {
    expect(startCell(0)).toBe(0)
    expect(startCell(1)).toBe(12)
    expect(startCell(3)).toBe(36)
  })

  it('places the lane mouth just behind the start cell', () => {
    expect(laneMouth(0)).toBe(47)
    expect(laneMouth(1)).toBe(11)
  })

  it('moves forward on the ring without reaching the mouth', () => {
    const reach = ringDestinations(0, 5, 3)
    expect(reach.ring).toEqual({ zone: 'track', index: 8 })
    expect(reach.lane).toBeNull()
  })

  it('wraps forward around the ring', () => {
    expect(ringDestinations(1, 46, 5).ring).toEqual({ zone: 'track', index: 3 })
    expect(ringDestinations(1, 46, 5).lane).toBeNull()
  })

  it('offers a lane landing when a forward path crosses the mouth', () => {
    // player 0, mouth at 47. From 45 forward 5: crosses 47 at step 2,
    // remaining 3 -> finish index 2. Ring-stay lands on 2.
    const reach = ringDestinations(0, 45, 5)
    expect(reach.ring).toEqual({ zone: 'track', index: 2 })
    expect(reach.lane).toEqual({ zone: 'finish', index: 2 })
  })

  it('enters the lane on a backward 4 from the start cell (the 4-trick)', () => {
    // player 0 on its start (0), backward 4: crosses mouth 47 after 1 step,
    // remaining 3 -> finish index 2. Ring-stay lands on 44.
    const reach = ringDestinations(0, 0, -4)
    expect(reach.ring).toEqual({ zone: 'track', index: 44 })
    expect(reach.lane).toEqual({ zone: 'finish', index: 2 })
  })

  it('rejects overshooting the lane', () => {
    // player 0 from 45 forward 8 would be finish index 5 -> no lane landing
    expect(ringDestinations(0, 45, 8).lane).toBeNull()
  })
})

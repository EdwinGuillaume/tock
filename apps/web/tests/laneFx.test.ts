import { describe, expect, it } from 'vitest'
import { createGame } from '@tock/core'
import { laneEntries } from '../src/laneFx'
import { place } from './support'

describe('laneEntries', () => {
  const base = createGame(['human', 'bot', 'bot', 'bot'], 48)

  it('detects a marble crossing from the ring into the finish lane', () => {
    const before = place(base, 'p0m0', { zone: 'track', index: 10 })
    const after = place(before, 'p0m0', { zone: 'finish', index: 0 })
    expect(laneEntries(before, after)).toEqual([{ marbleId: 'p0m0', owner: 0, finishIndex: 0 }])
  })

  it('detects two marbles entering at once (a 7 split across two marbles)', () => {
    const staged = place(place(base, 'p0m0', { zone: 'track', index: 10 }), 'p0m1', { zone: 'track', index: 12 })
    const after = place(place(staged, 'p0m0', { zone: 'finish', index: 0 }), 'p0m1', { zone: 'finish', index: 1 })
    expect(laneEntries(staged, after)).toHaveLength(2)
  })

  it('ignores a marble moving deeper WITHIN the finish lane', () => {
    const before = place(base, 'p0m0', { zone: 'finish', index: 1 })
    const after = place(before, 'p0m0', { zone: 'finish', index: 3 })
    expect(laneEntries(before, after)).toEqual([])
  })

  it('ignores a marble that stays on the ring', () => {
    const before = place(base, 'p0m0', { zone: 'track', index: 10 })
    const after = place(before, 'p0m0', { zone: 'track', index: 14 })
    expect(laneEntries(before, after)).toEqual([])
  })

  it('ignores a captured marble sent home (home is not finish)', () => {
    const before = place(base, 'p0m0', { zone: 'track', index: 10 })
    const after = place(before, 'p0m0', { zone: 'home' })
    expect(laneEntries(before, after)).toEqual([])
  })

  it('detects a bot-owned marble entering its lane', () => {
    const before = place(base, 'p1m0', { zone: 'track', index: 20 })
    const after = place(before, 'p1m0', { zone: 'finish', index: 0 })
    expect(laneEntries(before, after)).toEqual([{ marbleId: 'p1m0', owner: 1, finishIndex: 0 }])
  })
})

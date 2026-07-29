import { describe, expect, it } from 'vitest'
import { pickSample, soundManifest, type SoundId } from '../src/audio/sounds'

describe('pickSample', () => {
  it('picks by index = floor(random * length)', () => {
    expect(pickSample(['a', 'b', 'c'], () => 0)).toBe('a')
    expect(pickSample(['a', 'b', 'c'], () => 0.5)).toBe('b')
  })

  it('clamps when random returns 1', () => {
    expect(pickSample(['a', 'b', 'c'], () => 1)).toBe('c')
  })

  it('throws on an empty pool', () => {
    expect(() => pickSample([], () => 0)).toThrow()
  })
})

describe('soundManifest', () => {
  it('gives every SoundId a non-empty pool', () => {
    ;(Object.keys(soundManifest) as SoundId[]).forEach(id => {
      expect(soundManifest[id].pool.length).toBeGreaterThan(0)
    })
  })
})

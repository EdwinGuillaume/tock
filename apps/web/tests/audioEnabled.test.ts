import { describe, expect, it } from 'vitest'
import { computeAudioEnabled } from '../src/audio/enabled'

describe('computeAudioEnabled', () => {
  it('is false in a plain browser tab', () => {
    expect(computeAudioEnabled({ standalone: false, dev: false, forced: false })).toBe(false)
  })

  it('is true when standalone (installed app)', () => {
    expect(computeAudioEnabled({ standalone: true, dev: false, forced: false })).toBe(true)
  })

  it('is true under dev or the ?audio override', () => {
    expect(computeAudioEnabled({ standalone: false, dev: true, forced: false })).toBe(true)
    expect(computeAudioEnabled({ standalone: false, dev: false, forced: true })).toBe(true)
  })
})

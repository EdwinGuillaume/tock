import { afterEach, describe, expect, it, vi } from 'vitest'
import { duration, echoDuration, prefersReducedMotion } from '../src/motion'

const setMatch = (matches: boolean) => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {} }))
}

afterEach(() => vi.unstubAllGlobals())

describe('motion', () => {
  it('exposes durations', () => {
    expect(duration.fast).toBe(0.16)
    expect(duration.base).toBe(0.3)
    expect(echoDuration).toBe(3.2)
  })

  it('reads the reduced-motion preference', () => {
    setMatch(true)
    expect(prefersReducedMotion()).toBe(true)
    setMatch(false)
    expect(prefersReducedMotion()).toBe(false)
  })
})

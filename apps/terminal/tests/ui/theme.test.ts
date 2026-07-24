import { describe, expect, test } from 'vitest'
import { glyph, inkColor } from '../../src/ui/theme'

describe('theme', () => {
  test('maps every player color to an Ink color name', () => {
    expect(inkColor.red).toBe('red')
    expect(inkColor.green).toBe('green')
    expect(inkColor.purple).toBe('magentaBright')
    expect(inkColor.blue).toBe('blueBright')
  })

  test('exposes the full board glyph set', () => {
    expect(glyph.marble).toBe('●')
    expect(glyph.emptyRing).toBe('·')
    expect(glyph.emptyFinish).toBe('◇')
    expect(glyph.filledFinish).toBe('◆')
    expect(glyph.emptyNest).toBe('○')
    expect(glyph.center).toBe('✦')
  })
})

import type { Color } from '@tock/core'

// Ink color name per player color. Blue uses the brighter variant so it stays
// legible on dark terminal backgrounds (spec §10).
export const inkColor: Record<Color, string> = {
  red: 'red',
  green: 'green',
  yellow: 'yellow',
  blue: 'blueBright'
}

// Board glyphs (spec §7). All single-width so the 13x13 grid stays aligned.
export const glyph = {
  marble: '●',
  emptyRing: '·',
  emptyFinish: '◇',
  filledFinish: '◆',
  emptyNest: '○',
  filledNest: '●',
  center: '✦',
  landing: '□'
} as const

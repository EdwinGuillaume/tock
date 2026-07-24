import type { Color } from '@tock/core'

// Ink color name per player color. Blue and purple use the brighter variants so
// they stay legible on dark terminal backgrounds (spec §10). Ink has no "purple",
// so purple maps to magentaBright — a vivid violet, clearly distinct from red.
export const inkColor: Record<Color, string> = {
  red: 'red',
  green: 'green',
  purple: 'magentaBright',
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

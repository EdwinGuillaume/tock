import type { Color } from '@tock/core'

// Wood & marbles palette (design spec §5.2). light = top-left highlight stop,
// dark = bottom-right shadow stop of each marble's radial gradient.
export const seatColor: Record<Color, { light: string, dark: string }> = {
  red: { light: '#ff7a7f', dark: '#b52d33' },
  green: { light: '#7fdc90', dark: '#2e7d43' },
  yellow: { light: '#ffe08a', dark: '#cc9a1f' },
  blue: { light: '#86adff', dark: '#2f5bc4' }
}

export const theme = {
  board: '#5c3a17',
  boardEdge: '#3a250f',
  hole: '#4a2f12',
  laneHub: '#6b4620',
  cardFace: '#f7f0dd',
  cardInk: '#222222',
  cardInkRed: '#b52d33',
  text: '#e6e9f0',
  textDim: '#7c8496',
  ghost: '#4a7be5'
}

export const marbleGradientId = (color: Color): string => `marble-${color}`

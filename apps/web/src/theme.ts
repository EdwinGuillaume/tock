import type { Color } from '@tock/core'

// "Feutrine & or" palette. Marble radial gradient runs light (top-left highlight)
// -> dark (bottom-right shadow). `soft` is an "r,g,b" triple for translucent glows,
// home-pod tints, and finish-socket rims.
export const seatColor: Record<Color, { light: string, dark: string, soft: string }> = {
  red: { light: '#ff8a8f', dark: '#c02b31', soft: '229,72,77' },
  green: { light: '#86e6a0', dark: '#2e8a4a', soft: '70,167,88' },
  yellow: { light: '#ffe79a', dark: '#d29a1e', soft: '255,197,61' },
  blue: { light: '#93b6ff', dark: '#345fd0', soft: '79,139,255' }
}

export const theme = {
  feltGradient: 'radial-gradient(130% 90% at 50% 45%, #1f5147 0%, #0c211d 72%)',
  feltPanel: '#173e35',
  socketDark: '#05100d',
  socketMid: '#0a201b',
  socketRim: '#1b4d42',
  gold: '#ffd873',
  goldButtonTop: '#ffcf5f',
  goldButtonBottom: '#e6a636',
  goldButtonLip: '#9c6b1e',
  goldDim: '#d8b871',
  ink: '#e8eaf0',
  inkDim: '#9aa2b4',
  hairline: 'rgba(255,216,115,.14)',
  cardFace: '#f5ecd6',
  cardInk: '#2a2320',
  cardInkRed: '#c8323a',
  cardBack: 'linear-gradient(135deg,#3a2a12,#1c1408)',
  fontDisplay: "'Fredoka', system-ui, sans-serif",
  fontUi: "'Inter', system-ui, sans-serif",
  radius: { sm: 8, md: 12, lg: 16, pill: 20, card: 10 },
  shadowCard: '0 8px 14px rgba(0,0,0,.45)',
  shadowFloat: '0 16px 26px rgba(0,0,0,.5)',
  glowGold: '0 0 22px rgba(255,216,115,.6)',
  ease: { accel: 'cubic-bezier(.7,0,.84,0)', spring: 'cubic-bezier(.34,1.56,.64,1)' }
}

export const marbleGradientId = (color: Color): string => `marble-${color}`

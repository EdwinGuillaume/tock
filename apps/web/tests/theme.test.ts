import { describe, expect, it } from 'vitest'
import { marbleGradientId, seatColor, theme } from '../src/theme'

describe('wood theme', () => {
  it('exposes a light+dark stop for every seat color', () => {
    for (const color of ['red', 'green', 'yellow', 'blue'] as const) {
      expect(seatColor[color].light).toMatch(/^#/)
      expect(seatColor[color].dark).toMatch(/^#/)
    }
  })

  it('derives a stable, unique gradient id per color', () => {
    expect(marbleGradientId('red')).toBe('marble-red')
    expect(marbleGradientId('blue')).toBe('marble-blue')
  })

  it('provides board + card tokens', () => {
    expect(theme.board).toMatch(/^#|gradient/)
    expect(theme.cardFace).toMatch(/^#/)
  })
})

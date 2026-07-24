import { describe, expect, it } from 'vitest'
import { seatColor, theme, marbleGradientId } from '../src/theme'

describe('theme tokens', () => {
  it('exposes the four seat colours with light/dark/soft', () => {
    for (const color of ['red', 'green', 'purple', 'blue'] as const) {
      expect(seatColor[color].light).toMatch(/^#/)
      expect(seatColor[color].dark).toMatch(/^#/)
      expect(seatColor[color].soft).toMatch(/^\d+,\d+,\d+$/)
    }
  })

  it('exposes the core felt & gold tokens', () => {
    expect(theme.gold).toBe('#ffd873')
    expect(theme.feltPanel).toBe('#173e35')
    expect(theme.cardFace).toBe('#f5ecd6')
    expect(theme.fontDisplay).toContain('Fredoka')
    expect(theme.ease.accel).toContain('cubic-bezier')
  })

  it('builds a marble gradient id', () => {
    expect(marbleGradientId('red')).toBe('marble-red')
  })
})

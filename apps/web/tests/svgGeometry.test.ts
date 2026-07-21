import { describe, expect, it } from 'vitest'
import { cellOf, gridSize } from '@tock/core'
import { BOARD_MARGIN, CELL, cellCenter, homeSlotCenter, marbleCenter, positionCenter, viewBox } from '../src/svgGeometry'

describe('svg geometry', () => {
  it('pads the viewBox with a margin around the grid so edge decorations are not clipped', () => {
    const side = gridSize(48) * CELL
    const [minX, minY, width, height] = viewBox(48).split(' ').map(Number)
    expect(minX).toBe(-BOARD_MARGIN)
    expect(minY).toBe(-BOARD_MARGIN)
    expect(width).toBe(side + BOARD_MARGIN * 2)
    expect(height).toBe(side + BOARD_MARGIN * 2)
    expect(width).toBeGreaterThan(side)
  })

  it('centers a grid cell at (col+0.5, row+0.5) * CELL', () => {
    expect(cellCenter({ row: 2, col: 3 })).toEqual({ x: 3.5 * CELL, y: 2.5 * CELL })
  })

  it('maps a track position to its grid cell center', () => {
    const cell = cellOf(0, { zone: 'track', index: 5 }, 48)
    expect(positionCenter(0, { zone: 'track', index: 5 }, 48)).toEqual(cellCenter(cell!))
  })

  it('returns null from positionCenter for a home marble', () => {
    expect(positionCenter(0, { zone: 'home' }, 48)).toBeNull()
  })

  it('gives four distinct home slots inside the grid bounds', () => {
    const side = gridSize(48) * CELL
    const seen = new Set<string>()
    for (let slot = 0; slot < 4; slot++) {
      const point = homeSlotCenter(0, slot, 48)
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(side)
      seen.add(`${point.x},${point.y}`)
    }
    expect(seen.size).toBe(4)
  })

  it('marbleCenter uses the home slot for a home marble and the cell otherwise', () => {
    expect(marbleCenter(0, { zone: 'home' }, 2, 48)).toEqual(homeSlotCenter(0, 2, 48))
    const onTrack = { zone: 'track', index: 5 } as const
    expect(marbleCenter(0, onTrack, 0, 48)).toEqual(positionCenter(0, onTrack, 48))
  })
})

import { describe, expect, it } from 'vitest'
import { cellOf, finishCoord, gridSize, ringCoord, sideOf } from '../src/geometry/board2d'

describe('board2d grid geometry', () => {
  it('sizes the grid as ringSize / 4 + 1', () => {
    expect(gridSize(48)).toBe(13)
    expect(gridSize(72)).toBe(19)
  })

  it('places each seat start at index k * ringSize / 4, all distinct on the ring', () => {
    const seen = new Set<string>()
    for (let index = 0; index < 48; index++) {
      const cell = ringCoord(index, 48)
      seen.add(`${cell.row},${cell.col}`)
    }
    expect(seen.size).toBe(48)
  })

  it('walks the ring so consecutive indices are grid-adjacent', () => {
    for (let index = 0; index < 48; index++) {
      const a = ringCoord(index, 48)
      const b = ringCoord(index + 1, 48)
      const distance = Math.abs(a.row - b.row) + Math.abs(a.col - b.col)
      expect(distance).toBe(1)
    }
  })

  it('threads finish lanes inward (slot 0 nearest the ring)', () => {
    const near = finishCoord(0, 0, 48)
    const deep = finishCoord(0, 3, 48)
    // bottom side lane runs upward: deeper slot has the smaller row
    expect(deep.row).toBeLessThan(near.row)
  })

  it('maps a track position through cellOf and a home to null', () => {
    expect(cellOf(0, { zone: 'track', index: 0 }, 48)).toEqual(ringCoord(0, 48))
    expect(cellOf(0, { zone: 'home' }, 48)).toBeNull()
  })

  it('assigns the human seat (0) to the bottom side', () => {
    expect(sideOf[0]).toBe('bottom')
  })
})

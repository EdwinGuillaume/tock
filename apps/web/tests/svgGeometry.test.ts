import { describe, expect, it } from 'vitest'
import { cellOf, gridSize } from '@tock/core'
import { BOARD_MARGIN, CELL, boardCenter, cellCenter, finishThread, homeSlotCenter, marbleCenter, positionCenter, ringChannelPath, viewBox } from '../src/svgGeometry'

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

describe('redesign geometry', () => {
  it('closes the ring channel path with the right number of points', () => {
    const path = ringChannelPath(48)
    expect(path.startsWith('M')).toBe(true)
    expect(path.trimEnd().endsWith('Z')).toBe(true)
    // 48 ring cells -> 47 L segments after the initial M
    expect((path.match(/L/g) ?? []).length).toBe(47)
  })

  it('puts the board centre at the middle grid cell', () => {
    const center = boardCenter(48) // gridSize(48) = 13 -> centre cell index 6
    expect(center.x).toBeCloseTo(6.5 * CELL)
    expect(center.y).toBeCloseTo(6.5 * CELL)
  })

  it('rotates homes clockwise: seat 0 (bottom/red) sits bottom-left', () => {
    const slot0 = homeSlotCenter(0, 0, 48)
    const center = boardCenter(48)
    expect(slot0.x).toBeLessThan(center.x) // left half
    expect(slot0.y).toBeGreaterThan(center.y) // bottom half
  })

  it('rotates homes clockwise: seat 1 (left/green) sits top-left', () => {
    const slot = homeSlotCenter(1, 0, 48)
    const center = boardCenter(48)
    expect(slot.x).toBeLessThan(center.x)
    expect(slot.y).toBeLessThan(center.y)
  })

  it('threads a finish lane from the ring mouth toward the centre', () => {
    const thread = finishThread(0, 48) // bottom seat: mouth below, stop above (toward centre)
    expect(thread.mouth.y).toBeGreaterThan(thread.stop.y)
    expect(thread.mouth.x).toBeCloseTo(thread.stop.x)
  })
})

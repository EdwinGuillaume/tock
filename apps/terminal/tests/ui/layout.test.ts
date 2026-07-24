import { describe, expect, test } from 'vitest'
import { createGame, laneMouth, startCell } from '@tock/core'
import { cellOf, finishCoord, gridSize, movePreviewCells, ringCoord, sideOf } from '../../src/ui/layout'
import { place, setHand, card } from '../support'

// The rounded inner-corner cells sit diagonally 2 away from mid on both axes
// (an offset forced by the arm/mid geometry, not a magic number) — e.g. index 5
// of the 48-cell ring is { row: 8, col: 4 } against mid 6, so tolerance must be 2.
const onPlus = (cell: { row: number, col: number }, size: number): boolean => {
  const mid = (size - 1) / 2
  const rowOffset = Math.abs(cell.row - mid)
  const colOffset = Math.abs(cell.col - mid)
  // On a cross arm (one axis within 1 of mid) or a rounded inner corner (both axes exactly 2).
  return rowOffset <= 1 || colOffset <= 1 || (rowOffset === 2 && colOffset === 2)
}

describe('layout — ring geometry (48-cell cross)', () => {
  test('lays out a 13x13 grid', () => {
    expect(gridSize(48)).toBe(13)
  })

  test('each seat start lands at its arm tip, human (red) at the bottom', () => {
    expect(sideOf[0]).toBe('bottom')
    expect(ringCoord(startCell(0, 48), 48)).toEqual({ row: 12, col: 5 }) // red bottom
    expect(ringCoord(startCell(1, 48), 48)).toEqual({ row: 5, col: 0 })  // green left
    expect(ringCoord(startCell(2, 48), 48)).toEqual({ row: 0, col: 7 })  // purple top
    expect(ringCoord(startCell(3, 48), 48)).toEqual({ row: 7, col: 12 }) // blue right
  })

  test('the path steps up the arm from the start, then rounds the inner corner', () => {
    expect(ringCoord(1, 48)).toEqual({ row: 11, col: 5 })
    expect(ringCoord(5, 48)).toEqual({ row: 8, col: 4 }) // bottom->left rounded corner
  })

  test('all 48 ring cells are distinct and lie on the plus shape', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 48; i++) {
      const cell = ringCoord(i, 48)
      expect(onPlus(cell, 13)).toBe(true)
      seen.add(`${cell.row},${cell.col}`)
    }
    expect(seen.size).toBe(48)
  })

  test('ringCoord wraps and normalizes out-of-range indices', () => {
    expect(ringCoord(48, 48)).toEqual(ringCoord(0, 48))
    expect(ringCoord(47, 48)).toEqual({ row: 12, col: 6 })
  })

  test('each seat lane mouth cell is adjacent to its finish slot 0', () => {
    for (const seat of [0, 1, 2, 3] as const) {
      const mouth = ringCoord(laneMouth(seat, 48), 48)
      const slot0 = finishCoord(seat, 0, 48)
      expect(Math.abs(mouth.row - slot0.row) + Math.abs(mouth.col - slot0.col)).toBe(1)
    }
  })

  test('finish lanes thread inward from each arm, slot 0 nearest the ring', () => {
    expect(finishCoord(0, 0, 48)).toEqual({ row: 11, col: 6 })
    expect(finishCoord(0, 3, 48)).toEqual({ row: 8, col: 6 })
    expect(finishCoord(1, 0, 48)).toEqual({ row: 6, col: 1 })
    expect(finishCoord(2, 0, 48)).toEqual({ row: 1, col: 6 })
    expect(finishCoord(3, 0, 48)).toEqual({ row: 6, col: 11 })
  })
})

describe('layout — ring geometry (72-cell cross)', () => {
  test('lays out a 19x19 grid', () => {
    expect(gridSize(72)).toBe(19)
  })

  test('each seat start lands at its arm tip on the 19x19 grid', () => {
    expect(ringCoord(startCell(0, 72), 72)).toEqual({ row: 18, col: 8 })
    expect(ringCoord(startCell(1, 72), 72)).toEqual({ row: 8, col: 0 })
    expect(ringCoord(startCell(2, 72), 72)).toEqual({ row: 0, col: 10 })
    expect(ringCoord(startCell(3, 72), 72)).toEqual({ row: 10, col: 18 })
  })

  test('the path steps up the arm from the start', () => {
    expect(ringCoord(1, 72)).toEqual({ row: 17, col: 8 })
  })

  test('all 72 ring cells are distinct and lie on the plus shape', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 72; i++) {
      const cell = ringCoord(i, 72)
      expect(onPlus(cell, 19)).toBe(true)
      seen.add(`${cell.row},${cell.col}`)
    }
    expect(seen.size).toBe(72)
  })

  test('each seat lane mouth cell is adjacent to its finish slot 0', () => {
    for (const seat of [0, 1, 2, 3] as const) {
      const mouth = ringCoord(laneMouth(seat, 72), 72)
      const slot0 = finishCoord(seat, 0, 72)
      expect(Math.abs(mouth.row - slot0.row) + Math.abs(mouth.col - slot0.col)).toBe(1)
    }
  })

  test('finish lanes thread inward from the 19x19 arm centres', () => {
    expect(finishCoord(0, 0, 72)).toEqual({ row: 17, col: 9 })
    expect(finishCoord(0, 3, 72)).toEqual({ row: 14, col: 9 })
    expect(finishCoord(1, 0, 72)).toEqual({ row: 9, col: 1 })
    expect(finishCoord(2, 0, 72)).toEqual({ row: 1, col: 9 })
    expect(finishCoord(3, 0, 72)).toEqual({ row: 9, col: 17 })
  })
})

describe('layout — cellOf & preview', () => {
  test('cellOf maps zones; home is off-grid (null)', () => {
    expect(cellOf(0, { zone: 'home' }, 48)).toBeNull()
    expect(cellOf(0, { zone: 'track', index: 0 }, 48)).toEqual({ row: 12, col: 5 })
    expect(cellOf(0, { zone: 'finish', index: 0 }, 48)).toEqual({ row: 11, col: 6 })
  })

  test('cellOf uses the given ring size for a 72-cell board', () => {
    expect(cellOf(0, { zone: 'track', index: 0 }, 72)).toEqual({ row: 18, col: 8 })
  })

  test('movePreviewCells returns the moved marble destination on a 48-cell board', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = setHand(state, 0, [card('6')])
    const move = { type: 'move', card: card('6'), marbleId: 'p0m0', steps: 6 } as const
    const cells = movePreviewCells(state, move)
    expect(cells).toContainEqual(ringCoord(6, 48))
  })

  test('movePreviewCells maps onto the 72-cell grid when the game uses one', () => {
    let state = createGame(['human', 'bot'], 72)
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = setHand(state, 0, [card('6')])
    const move = { type: 'move', card: card('6'), marbleId: 'p0m0', steps: 6 } as const
    const cells = movePreviewCells(state, move)
    expect(cells).toContainEqual(ringCoord(6, 72))
  })

  test('movePreviewCells previews the pushed opponent marble landing', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p1m0', { zone: 'track', index: 20 })
    state = setHand(state, 0, [card('5')])
    const move = { type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 } as const
    const cells = movePreviewCells(state, move)
    expect(cells).toContainEqual(ringCoord(25, 48))
  })
})

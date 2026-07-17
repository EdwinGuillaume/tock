import { describe, expect, test } from 'vitest'
import { createGame, startCell } from '../../src/engine'
import { cellOf, finishCoord, gridSize, movePreviewCells, ringCoord, sideOf } from '../../src/ui/layout'
import { place, setHand, card } from '../support'

const onBorder = (cell: { row: number, col: number }, size: number): boolean =>
  cell.row === 0 || cell.row === size - 1 || cell.col === 0 || cell.col === size - 1

describe('layout — ring geometry (48-cell ring)', () => {
  test('lays out a 13x13 grid', () => {
    expect(gridSize(48)).toBe(13)
  })

  test('each seat start lands at the midpoint of its side, human at the bottom', () => {
    expect(sideOf[0]).toBe('bottom')
    expect(ringCoord(startCell(0, 48), 48)).toEqual({ row: 12, col: 6 }) // red bottom-mid
    expect(ringCoord(startCell(1, 48), 48)).toEqual({ row: 6, col: 0 })  // green left-mid
    expect(ringCoord(startCell(2, 48), 48)).toEqual({ row: 0, col: 6 })  // yellow top-mid
    expect(ringCoord(startCell(3, 48), 48)).toEqual({ row: 6, col: 12 }) // blue right-mid
  })

  test('the four corners fall at indices 6/18/30/42', () => {
    expect(ringCoord(6, 48)).toEqual({ row: 12, col: 0 })
    expect(ringCoord(18, 48)).toEqual({ row: 0, col: 0 })
    expect(ringCoord(30, 48)).toEqual({ row: 0, col: 12 })
    expect(ringCoord(42, 48)).toEqual({ row: 12, col: 12 })
  })

  test('all 48 ring cells are distinct and on the grid border', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 48; i++) {
      const cell = ringCoord(i, 48)
      expect(onBorder(cell, 13)).toBe(true)
      seen.add(`${cell.row},${cell.col}`)
    }
    expect(seen.size).toBe(48)
  })

  test('ringCoord wraps and normalizes out-of-range indices', () => {
    expect(ringCoord(48, 48)).toEqual(ringCoord(0, 48))
    expect(ringCoord(47, 48)).toEqual({ row: 12, col: 7 })
  })

  test('finish lanes thread inward from each side, slot 0 nearest the ring', () => {
    expect(finishCoord(0, 0, 48)).toEqual({ row: 11, col: 6 })
    expect(finishCoord(0, 3, 48)).toEqual({ row: 8, col: 6 })
    expect(finishCoord(1, 0, 48)).toEqual({ row: 6, col: 1 })
    expect(finishCoord(2, 0, 48)).toEqual({ row: 1, col: 6 })
    expect(finishCoord(3, 0, 48)).toEqual({ row: 6, col: 11 })
  })
})

describe('layout — ring geometry (72-cell ring)', () => {
  test('lays out a 19x19 grid', () => {
    expect(gridSize(72)).toBe(19)
  })

  test('each seat start lands at the midpoint of its 18-cell side', () => {
    expect(ringCoord(startCell(0, 72), 72)).toEqual({ row: 18, col: 9 })
    expect(ringCoord(startCell(1, 72), 72)).toEqual({ row: 9, col: 0 })
    expect(ringCoord(startCell(2, 72), 72)).toEqual({ row: 0, col: 9 })
    expect(ringCoord(startCell(3, 72), 72)).toEqual({ row: 9, col: 18 })
  })

  test('the four corners fall at indices 9/27/45/63', () => {
    expect(ringCoord(9, 72)).toEqual({ row: 18, col: 0 })
    expect(ringCoord(27, 72)).toEqual({ row: 0, col: 0 })
    expect(ringCoord(45, 72)).toEqual({ row: 0, col: 18 })
    expect(ringCoord(63, 72)).toEqual({ row: 18, col: 18 })
  })

  test('all 72 ring cells are distinct and on the 19x19 border', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 72; i++) {
      const cell = ringCoord(i, 72)
      expect(onBorder(cell, 19)).toBe(true)
      seen.add(`${cell.row},${cell.col}`)
    }
    expect(seen.size).toBe(72)
  })

  test('finish lanes thread inward from the 19x19 side midpoints', () => {
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
    expect(cellOf(0, { zone: 'track', index: 0 }, 48)).toEqual({ row: 12, col: 6 })
    expect(cellOf(0, { zone: 'finish', index: 0 }, 48)).toEqual({ row: 11, col: 6 })
  })

  test('cellOf uses the given ring size for a 72-cell board', () => {
    expect(cellOf(0, { zone: 'track', index: 0 }, 72)).toEqual({ row: 18, col: 9 })
  })

  test('movePreviewCells returns the moved marble destination on a 48-cell board', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = setHand(state, 0, [card('5')])
    const move = { type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5 } as const
    const cells = movePreviewCells(state, move)
    expect(cells).toContainEqual(ringCoord(5, 48))
  })

  test('movePreviewCells maps onto the 72-cell grid when the game uses one', () => {
    let state = createGame(['human', 'bot'], 72)
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = setHand(state, 0, [card('5')])
    const move = { type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5 } as const
    const cells = movePreviewCells(state, move)
    expect(cells).toContainEqual(ringCoord(5, 72))
  })
})

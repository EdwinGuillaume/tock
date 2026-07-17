import { describe, expect, test } from 'vitest'
import { createGame, ringSize, startCell } from '../../src/engine'
import { cellOf, finishCoord, movePreviewCells, ringCoord, sideOf } from '../../src/ui/layout'
import { place, setHand, card } from '../support'

const onBorder = (cell: { row: number, col: number }): boolean =>
  cell.row === 0 || cell.row === 12 || cell.col === 0 || cell.col === 12

describe('layout — ring geometry', () => {
  test('each seat start lands at the midpoint of its side, human at the bottom', () => {
    expect(sideOf[0]).toBe('bottom')
    expect(ringCoord(startCell(0))).toEqual({ row: 12, col: 6 }) // red bottom-mid
    expect(ringCoord(startCell(1))).toEqual({ row: 6, col: 0 })  // green left-mid
    expect(ringCoord(startCell(2))).toEqual({ row: 0, col: 6 })  // yellow top-mid
    expect(ringCoord(startCell(3))).toEqual({ row: 6, col: 12 }) // blue right-mid
  })

  test('the four corners fall at indices 6/18/30/42', () => {
    expect(ringCoord(6)).toEqual({ row: 12, col: 0 })
    expect(ringCoord(18)).toEqual({ row: 0, col: 0 })
    expect(ringCoord(30)).toEqual({ row: 0, col: 12 })
    expect(ringCoord(42)).toEqual({ row: 12, col: 12 })
  })

  test('all 48 ring cells are distinct and on the grid border', () => {
    const seen = new Set<string>()
    for (let i = 0; i < ringSize; i++) {
      const cell = ringCoord(i)
      expect(onBorder(cell)).toBe(true)
      seen.add(`${cell.row},${cell.col}`)
    }
    expect(seen.size).toBe(ringSize)
  })

  test('ringCoord wraps and normalizes out-of-range indices', () => {
    expect(ringCoord(ringSize)).toEqual(ringCoord(0))
    expect(ringCoord(47)).toEqual({ row: 12, col: 7 })
  })

  test('finish lanes thread inward from each side, slot 0 nearest the ring', () => {
    expect(finishCoord(0, 0)).toEqual({ row: 11, col: 6 })
    expect(finishCoord(0, 3)).toEqual({ row: 8, col: 6 })
    expect(finishCoord(1, 0)).toEqual({ row: 6, col: 1 })
    expect(finishCoord(2, 0)).toEqual({ row: 1, col: 6 })
    expect(finishCoord(3, 0)).toEqual({ row: 6, col: 11 })
  })
})

describe('layout — cellOf & preview', () => {
  test('cellOf maps zones; home is off-grid (null)', () => {
    expect(cellOf(0, { zone: 'home' })).toBeNull()
    expect(cellOf(0, { zone: 'track', index: 0 })).toEqual({ row: 12, col: 6 })
    expect(cellOf(0, { zone: 'finish', index: 0 })).toEqual({ row: 11, col: 6 })
  })

  test('movePreviewCells returns the moved marble destination', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = setHand(state, 0, [card('5')])
    const move = { type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5 } as const
    const cells = movePreviewCells(state, move)
    expect(cells).toContainEqual(ringCoord(5))
  })
})

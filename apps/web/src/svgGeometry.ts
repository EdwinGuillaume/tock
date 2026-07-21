import type { PlayerId, Position } from '@tock/core'
import { cellOf, gridSize, sideOf } from '@tock/core'
import type { Cell } from '@tock/core'

export const CELL = 10
export const MARBLE_R = 3.6
export const HOLE_R = 4.2
// Slack around the grid so decorations on edge cells (the start-square rings sit
// half a cell from the border and are wider than the hole) are not clipped by the
// SVG viewport.
export const BOARD_MARGIN = 3

export const viewBox = (ringSize: number): string => {
  const side = gridSize(ringSize) * CELL
  return `${-BOARD_MARGIN} ${-BOARD_MARGIN} ${side + BOARD_MARGIN * 2} ${side + BOARD_MARGIN * 2}`
}

export const cellCenter = (cell: Cell): { x: number, y: number } => ({
  x: (cell.col + 0.5) * CELL,
  y: (cell.row + 0.5) * CELL
})

export const positionCenter = (
  owner: PlayerId,
  position: Position,
  ringSize: number
): { x: number, y: number } | null => {
  const cell = cellOf(owner, position, ringSize)
  return cell ? cellCenter(cell) : null
}

// Home nests sit in the empty corner nearest the owner's side, laid out as a
// 2x2 cluster. The corner is picked from sideOf so each seat's home hugs its arm.
export const homeSlotCenter = (
  owner: PlayerId,
  slotIndex: number,
  ringSize: number
): { x: number, y: number } => {
  const cellsPerSide = gridSize(ringSize)
  const near = 1.5
  const far = cellsPerSide - 1.5
  const corner: Record<string, { cx: number, cy: number }> = {
    bottom: { cx: far, cy: far },
    left: { cx: near, cy: far },
    top: { cx: near, cy: near },
    right: { cx: far, cy: near }
  }
  const spot = corner[sideOf[owner]] ?? { cx: near, cy: near }
  const dx = (slotIndex % 2) * 1.2 - 0.6
  const dy = (slotIndex < 2 ? -1 : 1) * 0.6
  return { x: (spot.cx + dx) * CELL, y: (spot.cy + dy) * CELL }
}

export const marbleCenter = (
  owner: PlayerId,
  position: Position,
  slotIndex: number,
  ringSize: number
): { x: number, y: number } =>
  positionCenter(owner, position, ringSize) ?? homeSlotCenter(owner, slotIndex, ringSize)

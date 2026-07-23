import type { PlayerId, Position } from '@tock/core'
import { cellOf, finishCoord, gridSize, ringCoord, sideOf } from '@tock/core'
import type { Cell } from '@tock/core'

export const CELL = 10
export const SOCKET_R = 3.6
export const MARBLE_R = 3.2
export const CHANNEL_W = 9
export const EMBLEM_R = 6
export const BOARD_MARGIN = 4

export const viewBox = (ringSize: number): string => {
  const side = gridSize(ringSize) * CELL
  return `${-BOARD_MARGIN} ${-BOARD_MARGIN} ${side + BOARD_MARGIN * 2} ${side + BOARD_MARGIN * 2}`
}

export const cellCenter = (cell: Cell): { x: number, y: number } => ({
  x: (cell.col + 0.5) * CELL,
  y: (cell.row + 0.5) * CELL
})

export const boardCenter = (ringSize: number): { x: number, y: number } => {
  const mid = (gridSize(ringSize) - 1) / 2
  return cellCenter({ row: mid, col: mid })
}

export const positionCenter = (
  owner: PlayerId,
  position: Position,
  ringSize: number
): { x: number, y: number } | null => {
  const cell = cellOf(owner, position, ringSize)
  return cell ? cellCenter(cell) : null
}

// The continuous ring as one closed SVG path through every ring-cell centre in
// order (index 0..ringSize-1). Rendered as a wide rounded stroke = the felt track.
export const ringChannelPath = (ringSize: number): string => {
  const points = Array.from({ length: ringSize }, (_unused, index) => cellCenter(ringCoord(index, ringSize)))
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ') + ' Z'
}

// Gold-thread endpoints for a seat's finish lane: from the lane mouth (nearest the
// ring, finish slot 0) to the emblem's edge (the thread stops at the emblem, never
// crosses it). Each lane is axis-aligned, so the stop is the board centre offset by
// EMBLEM_R back toward the mouth.
export const finishThread = (
  owner: PlayerId,
  ringSize: number
): { mouth: { x: number, y: number }, stop: { x: number, y: number } } => {
  const mouth = cellCenter(finishCoord(owner, 0, ringSize))
  const center = boardCenter(ringSize)
  const offset: Record<string, { x: number, y: number }> = {
    bottom: { x: center.x, y: center.y + EMBLEM_R },
    top: { x: center.x, y: center.y - EMBLEM_R },
    left: { x: center.x - EMBLEM_R, y: center.y },
    right: { x: center.x + EMBLEM_R, y: center.y }
  }
  return { mouth, stop: offset[sideOf[owner]] ?? center }
}

// Home nests sit in the corner CLOCKWISE-adjacent to the seat's arm (on the side of
// its start square): bottom -> bottom-left, left -> top-left, top -> top-right,
// right -> bottom-right. Laid out as a 2x2 cluster.
export const homeSlotCenter = (
  owner: PlayerId,
  slotIndex: number,
  ringSize: number
): { x: number, y: number } => {
  const cellsPerSide = gridSize(ringSize)
  const near = 1.5
  const far = cellsPerSide - 1.5
  const corner: Record<string, { cx: number, cy: number }> = {
    bottom: { cx: near, cy: far },
    left: { cx: near, cy: near },
    top: { cx: far, cy: near },
    right: { cx: far, cy: far }
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

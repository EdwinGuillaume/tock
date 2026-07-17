import type { GameState, MarbleId, Move, PlayerId, Position } from '../engine'
import { applyMove } from '../engine'

// The grid is a square of `ringSize / 4 + 1` cells per side; the ring is drawn
// as a plus/cross inside it (see ringCoord) and finish lanes thread up each arm.
export const gridSize = (ringSize: number): number => ringSize / 4 + 1

export type Cell = { row: number, col: number }
export type Side = 'bottom' | 'left' | 'top' | 'right'

// A highlighted cell. `selected` emphasizes a real marble (the one under the
// cursor, or a cell a completed move landed on) — the glyph stays, drawn
// inverse. `landing` previews a destination a marble *would* reach if chosen —
// drawn as a white square, since nothing sits there yet.
export type HighlightKind = 'selected' | 'landing'
export type Highlight = { cell: Cell, kind: HighlightKind }

// Seat -> board side. Human is always seat 0 and sits at the bottom (spec §7).
export const sideOf: Record<PlayerId, Side> = {
  0: 'bottom',
  1: 'left',
  2: 'top',
  3: 'right'
}

// The ring traces the plus/cross perimeter: the two outer lanes of each arm, the
// arm tips, and one rounded cell at each inner corner. Built once per ring size
// and cached, then indexed. The walk starts at red's start square (bottom arm,
// left outer lane) and runs bottom -> left -> top -> right, so seat k lands at
// index k * ringSize / 4 — matching startCell.
const ringCache = new Map<number, Cell[]>()

const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

const isPlus = (row: number, col: number, mid: number): boolean =>
  Math.abs(col - mid) <= 1 || Math.abs(row - mid) <= 1

const buildRing = (ringSize: number): Cell[] => {
  const side = gridSize(ringSize)
  const mid = (side - 1) / 2
  const arm = (side - 3) / 2
  const inGrid = (row: number, col: number): boolean =>
    row >= 0 && row < side && col >= 0 && col < side
  const onRing = (row: number, col: number): boolean => {
    // isPlus only compares against mid, with no grid bounds, so a cell must be
    // confirmed in-grid first or the walk can escape past an arm tip.
    if (!inGrid(row, col)) return false
    // The rounded inner-corner cells sit diagonally outside the base cross
    // shape (isPlus is false there), so this check must run before the
    // isPlus guard or the corners are unreachable and the walk stalls.
    const isCorner =
      (row === arm - 1 || row === side - arm) && (col === arm - 1 || col === side - arm)
    if (isCorner) return true
    if (!isPlus(row, col, mid)) return false
    return STEP.some(([dr, dc]) => !inGrid(row + dr, col + dc) || !isPlus(row + dr, col + dc, mid))
  }
  const neighbours = (cell: Cell): Cell[] =>
    STEP.map(([dr, dc]) => ({ row: cell.row + dr, col: cell.col + dc })).filter(next =>
      onRing(next.row, next.col)
    )
  const same = (a: Cell, b: Cell): boolean => a.row === b.row && a.col === b.col
  const start: Cell = { row: side - 1, col: mid - 1 }
  const order: Cell[] = [start]
  let prev = start
  let cur: Cell = { row: side - 2, col: mid - 1 }
  while (!same(cur, start)) {
    order.push(cur)
    // Defensive cap: a valid ring never exceeds ringSize cells, so this breaks
    // out instead of hanging the UI if a future geometry change never cycles back.
    if (order.length > ringSize) break
    const next = neighbours(cur).find(candidate => !same(candidate, prev))
    if (!next) break
    prev = cur
    cur = next
  }
  return order
}

// Ring index -> grid cell on the plus perimeter. Index is normalised mod ringSize
// (wraps), matching the abstract loop.
export const ringCoord = (index: number, ringSize: number): Cell => {
  const ring = ringCache.get(ringSize) ?? buildRing(ringSize)
  ringCache.set(ringSize, ring)
  const i = ((index % ringSize) + ringSize) % ringSize
  return ring[i] ?? { row: 0, col: 0 }
}

// Finish-lane cell for `owner`'s slot `index` (0 nearest the ring, 3 deepest),
// threading inward from that side's midpoint toward the centre.
export const finishCoord = (owner: PlayerId, index: number, ringSize: number): Cell => {
  const g = ringSize / 4
  const mid = g / 2
  const step = index + 1
  switch (sideOf[owner]) {
    case 'bottom': return { row: g - step, col: mid }
    case 'top': return { row: step, col: mid }
    case 'left': return { row: mid, col: step }
    case 'right': return { row: mid, col: g - step }
  }
}

// A marble position -> its grid cell, or null when off the grid (home nest).
export const cellOf = (owner: PlayerId, position: Position, ringSize: number): Cell | null => {
  if (position.zone === 'track') return ringCoord(position.index, ringSize)
  if (position.zone === 'finish') return finishCoord(owner, position.index, ringSize)
  return null
}

const samePosition = (a: Position, b: Position): boolean =>
  a.zone === b.zone && ('index' in a && 'index' in b ? a.index === b.index : true)

// Destination cells of the acting player's marbles that changed position as a
// result of `move` — used to highlight the candidate landing(s). Reads the
// resulting state via the engine's immutable applyMove (positions only).
export const movePreviewCells = (state: GameState, move: Move): Cell[] => {
  const after = applyMove(state, move)
  // A push moves an opponent marble, not the actor's; preview that marble.
  if (move.type === 'push') {
    const pushed = after.marbleList.find(candidate => candidate.id === move.marbleId)
    const cell = pushed ? cellOf(pushed.owner, pushed.position, state.ringSize) : null
    return cell ? [cell] : []
  }
  const actor = state.currentPlayer
  const cellList: Cell[] = []
  for (const marble of after.marbleList) {
    if (marble.owner !== actor) continue
    const before = state.marbleList.find(candidate => candidate.id === marble.id)
    if (!before) continue
    if (samePosition(before.position, marble.position)) continue
    const cell = cellOf(actor, marble.position, state.ringSize)
    if (cell) cellList.push(cell)
  }
  return cellList
}

// Destination cells, after applying `move`, of the given marbles — used to
// preview where specific marbles will land (e.g. a split's focused + locked
// marbles, without lighting the auto-chosen remainder).
export const marbleCellsAfter = (state: GameState, move: Move, idList: MarbleId[]): Cell[] => {
  const after = applyMove(state, move)
  const cellList: Cell[] = []
  for (const id of idList) {
    const marble = after.marbleList.find(candidate => candidate.id === id)
    if (!marble) continue
    const cell = cellOf(marble.owner, marble.position, after.ringSize)
    if (cell) cellList.push(cell)
  }
  return cellList
}

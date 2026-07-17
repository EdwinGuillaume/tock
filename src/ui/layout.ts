import type { GameState, MarbleId, Move, PlayerId, Position } from '../engine'
import { applyMove, ringSize } from '../engine'

export const gridSize = 13

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

// Ring index -> grid cell on the 13x13 border. Index 0 (red's start) is
// bottom-middle; travel runs counterclockwise (bottom -> left -> top -> right),
// matching startCell(seat) = seat*12 landing each start at a side midpoint.
export const ringCoord = (index: number): Cell => {
  const i = ((index % ringSize) + ringSize) % ringSize
  if (i <= 6) return { row: 12, col: 6 - i }
  if (i <= 18) return { row: 12 - (i - 6), col: 0 }
  if (i <= 30) return { row: 0, col: i - 18 }
  if (i <= 42) return { row: i - 30, col: 12 }
  return { row: 12, col: 12 - (i - 42) }
}

// Finish-lane cell for `owner`'s slot `index` (0 nearest the ring, 3 deepest),
// threading inward from that side's midpoint toward the centre.
export const finishCoord = (owner: PlayerId, index: number): Cell => {
  const step = index + 1
  switch (sideOf[owner]) {
    case 'bottom': return { row: 12 - step, col: 6 }
    case 'top': return { row: step, col: 6 }
    case 'left': return { row: 6, col: step }
    case 'right': return { row: 6, col: 12 - step }
  }
}

// A marble position -> its grid cell, or null when off the grid (home nest).
export const cellOf = (owner: PlayerId, position: Position): Cell | null => {
  if (position.zone === 'track') return ringCoord(position.index)
  if (position.zone === 'finish') return finishCoord(owner, position.index)
  return null
}

const samePosition = (a: Position, b: Position): boolean =>
  a.zone === b.zone && ('index' in a && 'index' in b ? a.index === b.index : true)

// Destination cells of the acting player's marbles that changed position as a
// result of `move` — used to highlight the candidate landing(s). Reads the
// resulting state via the engine's immutable applyMove (positions only).
export const movePreviewCells = (state: GameState, move: Move): Cell[] => {
  const actor = state.currentPlayer
  const after = applyMove(state, move)
  const cellList: Cell[] = []
  for (const marble of after.marbleList) {
    if (marble.owner !== actor) continue
    const before = state.marbleList.find(candidate => candidate.id === marble.id)
    if (!before) continue
    if (samePosition(before.position, marble.position)) continue
    const cell = cellOf(actor, marble.position)
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
    const cell = cellOf(marble.owner, marble.position)
    if (cell) cellList.push(cell)
  }
  return cellList
}

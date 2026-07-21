import type { GameState, MarbleId, Move, Position } from '@tock/core'
import { applyMove, cellOf } from '@tock/core'
import type { Cell } from '@tock/core'

export type { Cell, Side } from '@tock/core'
export { gridSize, sideOf, ringCoord, finishCoord, cellOf } from '@tock/core'

// A highlighted cell. `selected` emphasizes a real marble (the one under the
// cursor, or a cell a completed move landed on) — the glyph stays, drawn
// inverse. `landing` previews a destination a marble *would* reach if chosen —
// drawn as a white square, since nothing sits there yet.
export type HighlightKind = 'selected' | 'landing'
export type Highlight = { cell: Cell, kind: HighlightKind }

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

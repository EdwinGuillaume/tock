import { useInput } from 'ink'
import { useState } from 'react'
import type { GameState, Move, PlayerId } from '../../engine'
import { getLegalMoves } from '../../engine'
import type { Cell, Highlight } from '../layout'
import { cellOf, marbleCellsAfter, movePreviewCells } from '../layout'
import type { Selection, SelectionEvent, TurnContext } from '../selection'
import { initialSelection, marbleChoices, optionMoves, projectedSplitMove, reduce, splitCandidates } from '../selection'

type UseTurnInputArgs = {
  state: GameState
  human: PlayerId
  active: boolean
  onCommit: (move: Move) => void
}

const eventFor = (inputKey: { leftArrow: boolean, rightArrow: boolean, return: boolean, escape: boolean, backspace: boolean }): SelectionEvent | null => {
  if (inputKey.leftArrow) return { kind: 'left' }
  if (inputKey.rightArrow) return { kind: 'right' }
  if (inputKey.return) return { kind: 'confirm' }
  if (inputKey.escape || inputKey.backspace) return { kind: 'back' }
  return null
}

const landing = (cell: Cell): Highlight => ({ cell, kind: 'landing' })

// Distinct destination cells reached by any of `moveList`, as landing squares.
const landingsOf = (moveList: Move[], ctx: TurnContext): Highlight[] => {
  const cellList: Cell[] = []
  for (const move of moveList) {
    for (const cell of movePreviewCells(ctx.state, move)) {
      if (!cellList.some(existing => existing.row === cell.row && existing.col === cell.col)) cellList.push(cell)
    }
  }
  return cellList.map(landing)
}

// Cells to highlight for the current selection: the marble under the cursor is
// emphasized in place (`selected`), and every cell it could reach is previewed
// as a landing square (`landing`) so the player never has to count squares.
export const highlightFor = (selection: Selection, ctx: TurnContext): Highlight[] => {
  if (selection.step === 'pickMarble') {
    const id = marbleChoices(selection.card, ctx)[selection.marbleCursor]
    const marble = ctx.state.marbleList.find(candidate => candidate.id === id)
    if (!marble) return []
    const landings = landingsOf(optionMoves(selection.card, marble.id, ctx), ctx)
    const cell = cellOf(marble.owner, marble.position, ctx.state.ringSize)
    // A home marble (exit) has no grid cell of its own; only its landing shows.
    return cell ? [{ cell, kind: 'selected' }, ...landings] : landings
  }
  if (selection.step === 'splitAllocation') {
    const focusId = splitCandidates(selection.card, ctx)[selection.focusIndex]
    const move = projectedSplitMove(selection, ctx)
    if (move) {
      // Preview where the focused (and already-locked) marbles land — skip the
      // auto-chosen remainder the player has not decided yet.
      const lockedIdList = selection.assigned.filter(part => part.steps > 0).map(part => part.marbleId)
      const idList = focusId === undefined ? lockedIdList : [...lockedIdList, focusId]
      return marbleCellsAfter(ctx.state, move, idList).map(landing)
    }
    // Draft is 0 (skip) or no projection yet: mark the focused marble in place.
    const marble = ctx.state.marbleList.find(candidate => candidate.id === focusId)
    const cell = marble ? cellOf(marble.owner, marble.position, ctx.state.ringSize) : null
    return cell ? [{ cell, kind: 'selected' }] : []
  }
  if (selection.step === 'pickDestination') {
    const move = optionMoves(selection.card, selection.marbleId, ctx)[selection.optionCursor]
    return move ? movePreviewCells(ctx.state, move).map(landing) : []
  }
  if (selection.step === 'pickTarget') {
    const move = optionMoves(selection.card, selection.marbleId, ctx)[selection.targetCursor]
    return move ? movePreviewCells(ctx.state, move).map(landing) : []
  }
  return []
}

export const useTurnInput = ({ state, human, active, onCommit }: UseTurnInputArgs) => {
  const [selection, setSelection] = useState<Selection>(initialSelection)
  const ctx: TurnContext = { state, legalMoves: getLegalMoves(state, human), human }

  useInput((input, inputKey) => {
    const event = eventFor(inputKey)
    if (!event) return
    const result = reduce(selection, event, ctx)
    setSelection(result.selection)
    if (result.commit) {
      setSelection(initialSelection())
      onCommit(result.commit)
    }
  }, { isActive: active })

  return { selection, highlight: highlightFor(selection, ctx) }
}

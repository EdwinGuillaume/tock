import type { Card, GameState, MarbleId, Move } from '@tock/core'
import { applyMove } from '@tock/core'
import { marbleCenter } from './svgGeometry'

export type Ghost = { key: string, move: Move, cx: number, cy: number, label?: string }

export const sameCard = (a: Card, b: Card): boolean => a.rank === b.rank && a.suit === b.suit

export const movesForCard = (card: Card, legalMoves: Move[]): Move[] =>
  legalMoves.filter(move => sameCard(move.card, card))

export const handIsPlayable = (card: Card, legalMoves: Move[]): boolean =>
  movesForCard(card, legalMoves).length > 0

export const isSplitCard = (card: Card, legalMoves: Move[]): boolean =>
  movesForCard(card, legalMoves).some(move => move.type === 'split7')

export const isDiscardOnly = (card: Card, legalMoves: Move[]): boolean => {
  const list = movesForCard(card, legalMoves)
  return list.length > 0 && list.every(move => move.type === 'discard')
}

// The marble whose landing a ghost should mark: the actor's marble for
// exit/move, the pushed opponent marble for push.
const landingMarbleId = (move: Move): MarbleId | null => {
  if (move.type === 'exit' || move.type === 'move' || move.type === 'push') return move.marbleId
  return null
}

// One ghost per exit/move/push outcome, placed at the post-move cell of the
// relevant marble (read from the engine's immutable applyMove — positions only).
// The slot argument is always 0: exit/move/push post-move positions are always
// track or finish, never home, so marbleCenter's home-slot fallback never fires.
export const ghostsForCard = (card: Card, state: GameState, legalMoves: Move[]): Ghost[] => {
  const ghostList: Ghost[] = []
  movesForCard(card, legalMoves).forEach((move, index) => {
    const id = landingMarbleId(move)
    if (id === null) return
    const after = applyMove(state, move)
    const marble = after.marbleList.find(candidate => candidate.id === id)
    if (!marble) return
    const point = marbleCenter(marble.owner, marble.position, 0, state.ringSize)
    const label = move.type === 'move' && move.enterLane ? '⌂' : String('steps' in move ? move.steps : '')
    ghostList.push({ key: `ghost-${index}`, move, cx: point.x, cy: point.y, label: label || undefined })
  })
  return ghostList
}

export const swapMovesForCard = (card: Card, legalMoves: Move[]): Move[] =>
  movesForCard(card, legalMoves).filter(move => move.type === 'swap')

export const ownSwapMarbleIds = (card: Card, legalMoves: Move[]): MarbleId[] => {
  const idList: MarbleId[] = []
  for (const move of swapMovesForCard(card, legalMoves)) {
    if (move.type === 'swap' && !idList.includes(move.marbleId)) idList.push(move.marbleId)
  }
  return idList
}

export const swapTargetsFor = (card: Card, marbleId: MarbleId, legalMoves: Move[]): Move[] =>
  swapMovesForCard(card, legalMoves).filter(move => move.type === 'swap' && move.marbleId === marbleId)

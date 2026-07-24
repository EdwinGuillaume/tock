import type { Card, GameState, MarbleId, Move } from '@tock/core'
import { applyMove } from '@tock/core'
import { marbleCenter } from './svgGeometry'

export type Ghost = { key: string, move: Move, cx: number, cy: number, label?: string }

export const sameCard = (a: Card, b: Card): boolean => a.rank === b.rank && a.suit === b.suit

export const movesForCard = (card: Card, legalMoves: Move[]): Move[] =>
  legalMoves.filter(move => sameCard(move.card, card))

export const handIsPlayable = (card: Card, legalMoves: Move[]): boolean =>
  movesForCard(card, legalMoves).length > 0

// Distinct own marbles that appear across the card's 7-split partitions.
const splitCandidateCount = (card: Card, legalMoves: Move[]): number => {
  const idSet = new Set<MarbleId>()
  for (const move of movesForCard(card, legalMoves)) {
    if (move.type === 'split7') for (const part of move.partList) idSet.add(part.marbleId)
  }
  return idSet.size
}

// A 7 needs the allocation panel only when two or more marbles can share it.
// With a single movable marble the 7 degenerates to a normal move card, routed
// through the ghost flow like a Queen or King.
export const isSplitCard = (card: Card, legalMoves: Move[]): boolean =>
  splitCandidateCount(card, legalMoves) > 1

export const isDiscardOnly = (card: Card, legalMoves: Move[]): boolean => {
  const list = movesForCard(card, legalMoves)
  return list.length > 0 && list.every(move => move.type === 'discard')
}

// The marble whose landing a ghost should mark: the actor's marble for
// exit/move/push, and — for a single-part 7 (only one movable marble) — that
// marble. Multi-part splits go through the allocation panel and never reach here.
const landingMarbleId = (move: Move): MarbleId | null => {
  if (move.type === 'exit' || move.type === 'move' || move.type === 'push') return move.marbleId
  if (move.type === 'split7' && move.partList.length === 1) return move.partList[0]?.marbleId ?? null
  return null
}

// The glyph shown on a destination ghost: '⌂' when the marble enters its finish
// lane, otherwise the step count; empty for an exit (it lands on the start cell).
const ghostLabel = (move: Move): string => {
  const part = move.type === 'split7' ? move.partList[0] : undefined
  const entersLane = (move.type === 'move' && move.enterLane === true) || part?.enterLane === true
  if (entersLane) return '⌂'
  if (move.type === 'split7') return part ? String(part.steps) : ''
  return 'steps' in move ? String(move.steps) : ''
}

// One ghost per exit/move/push (and single-part split7) outcome, placed at the
// post-move cell of the relevant marble (read from the engine's immutable
// applyMove — positions only). The slot argument is always 0: those post-move
// positions are always track or finish, never home, so marbleCenter's home-slot
// fallback never fires.
export const ghostsForCard = (card: Card, state: GameState, legalMoves: Move[]): Ghost[] => {
  const ghostList: Ghost[] = []
  movesForCard(card, legalMoves).forEach((move, index) => {
    const id = landingMarbleId(move)
    if (id === null) return
    const after = applyMove(state, move)
    const marble = after.marbleList.find(candidate => candidate.id === id)
    if (!marble) return
    const point = marbleCenter(marble.owner, marble.position, 0, state.ringSize)
    const label = ghostLabel(move)
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

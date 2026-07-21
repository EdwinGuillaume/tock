import type { Card, GameState, MarbleId, Move } from '@tock/core'
import { applyMove } from '@tock/core'
import type { Ghost } from './moveSelection'
import { sameCard } from './moveSelection'
import { marbleCenter } from './svgGeometry'

export type SplitPart = { marbleId: MarbleId, steps: number, enterLane?: boolean }
export type SplitDraft = { card: Card, assigned: SplitPart[] }

const TOTAL = 7

export const startSplit = (card: Card): SplitDraft => ({ card, assigned: [] })

export const splitRemaining = (draft: SplitDraft): number =>
  TOTAL - draft.assigned.reduce((sum, part) => sum + part.steps, 0)

export const allocate = (draft: SplitDraft, part: SplitPart): SplitDraft =>
  ({ card: draft.card, assigned: [...draft.assigned, part] })

export const undoLast = (draft: SplitDraft): SplitDraft =>
  ({ card: draft.card, assigned: draft.assigned.slice(0, -1) })

const splitPartLists = (card: Card, legalMoves: Move[]): SplitPart[][] =>
  legalMoves.flatMap(move => (move.type === 'split7' && sameCard(move.card, card) ? [move.partList] : []))

const stepsOf = (partList: SplitPart[], marbleId: MarbleId): number =>
  partList.find(part => part.marbleId === marbleId)?.steps ?? 0

const laneOf = (partList: SplitPart[], marbleId: MarbleId): boolean =>
  partList.find(part => part.marbleId === marbleId)?.enterLane ?? false

// Partitions still consistent with everything assigned so far.
const compatible = (card: Card, assigned: SplitPart[], legalMoves: Move[]): SplitPart[][] =>
  splitPartLists(card, legalMoves).filter(partList =>
    assigned.every(part =>
      stepsOf(partList, part.marbleId) === part.steps &&
      laneOf(partList, part.marbleId) === (part.enterLane ?? false)
    )
  )

export const splitCandidateIds = (card: Card, legalMoves: Move[]): MarbleId[] => {
  const idList: MarbleId[] = []
  for (const partList of splitPartLists(card, legalMoves)) {
    for (const part of partList) if (!idList.includes(part.marbleId)) idList.push(part.marbleId)
  }
  return idList
}

// The distinct still-reachable (steps, enterLane) landings for one marble, each
// as a ghost placed at where that marble would sit if only this part applied.
// The slot argument is always 0: a split part previews the marble advancing by
// steps > 0, so its post-move position is always track or finish, never home
// — marbleCenter's home-slot fallback never fires, so the slot index is unused.
export const splitGhostsForMarble = (
  draft: SplitDraft,
  marbleId: MarbleId,
  state: GameState,
  legalMoves: Move[]
): Ghost[] => {
  const live = compatible(draft.card, draft.assigned, legalMoves)
  const seen = new Set<string>()
  const ghostList: Ghost[] = []
  live.forEach(partList => {
    const steps = stepsOf(partList, marbleId)
    if (steps <= 0) return
    const enterLane = laneOf(partList, marbleId)
    const key = `${steps}-${enterLane}`
    if (seen.has(key)) return
    seen.add(key)
    // Preview by applying the WHOLE legal partition, not this marble's part in
    // isolation: a single part can be illegal when its landing is only freed by
    // another marble moving first (the engine handles that ordering, and rejects
    // an out-of-order lone part). Applying the full partList is always legal, and
    // this marble's resulting cell is exactly where the ghost belongs.
    const after = applyMove(state, { type: 'split7', card: draft.card, partList })
    const marble = after.marbleList.find(candidate => candidate.id === marbleId)
    if (!marble) return
    const point = marbleCenter(marble.owner, marble.position, 0, state.ringSize)
    // The ghost still allocates ONLY this marble's part into the draft.
    const move: Move = { type: 'split7', card: draft.card, partList: [{ marbleId, steps, enterLane }] }
    ghostList.push({ key: `split-${marbleId}-${key}`, move, cx: point.x, cy: point.y, label: String(steps) })
  })
  return ghostList
}

// The single completed split7 move matching the assigned non-zero parts, order-
// and zero-insensitive. Defined only when the budget is fully spent.
export const completedSplitMove = (draft: SplitDraft, legalMoves: Move[]): Move | undefined => {
  if (splitRemaining(draft) !== 0) return undefined
  const nonZero = draft.assigned.filter(part => part.steps > 0)
  return splitPartLists(draft.card, legalMoves)
    .map(partList => ({ type: 'split7', card: draft.card, partList } as Move))
    .find(move =>
      move.type === 'split7' &&
      move.partList.length === nonZero.length &&
      nonZero.every(part =>
        stepsOf(move.partList, part.marbleId) === part.steps &&
        laneOf(move.partList, part.marbleId) === (part.enterLane ?? false)
      )
    )
}

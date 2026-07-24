import type { GameState, MarbleId, PlayerId } from '@tock/core'

export type LaneEntry = { marbleId: MarbleId, owner: PlayerId, finishIndex: number }

// Marbles whose position.zone went from a non-finish zone to 'finish' between
// `before` and `after` — i.e. they crossed the lane mouth into the couloir.
// Move-type agnostic (works for a plain move, a 7-split part, or any future
// path in) and seat-agnostic (fires for human and bot marbles alike), because
// it reads only the state transition, not the Move or whose turn it is.
export const laneEntries = (before: GameState, after: GameState): LaneEntry[] => {
  const entryList: LaneEntry[] = []
  for (const marble of before.marbleList) {
    if (marble.position.zone === 'finish') continue
    const post = after.marbleList.find(candidate => candidate.id === marble.id)
    if (post && post.position.zone === 'finish') {
      entryList.push({ marbleId: marble.id, owner: marble.owner, finishIndex: post.position.index })
    }
  }
  return entryList
}

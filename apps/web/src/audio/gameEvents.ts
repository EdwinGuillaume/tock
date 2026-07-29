import type { Color, GameState } from '@tock/core'
import { colorOf } from '@tock/core'

// A capture is any marble that was off its home nest before the move and is back
// home after — true for a plain move, a 7-split, an exit, and the push (which can
// even send a third player's or the mover's own marble home). Detected by diffing
// states, so it is agnostic to move type.
export const capturedColorList = (before: GameState, after: GameState): Color[] => {
  const result: Color[] = []
  for (const marble of before.marbleList) {
    if (marble.position.zone === 'home') continue
    const post = after.marbleList.find(candidate => candidate.id === marble.id)
    if (post && post.position.zone === 'home') result.push(colorOf(marble.owner))
  }
  return result
}

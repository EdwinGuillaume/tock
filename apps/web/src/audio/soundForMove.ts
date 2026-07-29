import type { GameState, Move } from '@tock/core'
import { laneEntries } from '../laneFx'
import { capturedColorList } from './gameEvents'
import type { SoundId } from './sounds'

// The Move union member names double as SoundIds, so move.type maps directly.
// A marble crossing into its finish lane is a special beat: detected by the same
// before/after diff the lane-entry animation uses (laneEntries), so the cue fires
// exactly when the animation does — for a plain move OR a 7-split part. A plain
// move that enters replaces 'move' with 'laneEntry'; any other entering move
// type (e.g. split7) keeps its own cue and layers 'laneEntry' on top. Multiple
// ids are the superposition case (e.g. ['split7','laneEntry']) — played together.
export const soundForMove = (before: GameState, after: GameState, move: Move): SoundId[] => {
  const entered = laneEntries(before, after).length > 0
  const base: SoundId = move.type === 'move' && entered ? 'laneEntry' : move.type
  const list: SoundId[] = [base]
  if (entered && base !== 'laneEntry') list.push('laneEntry')
  if (capturedColorList(before, after).length > 0) list.push('capture')
  if (after.winner !== null) list.push('win')
  return list
}

// The full set for one committed move: move sounds + accents, plus the soft draw
// cue when a human drew the fresh card (continuous draw). Gated here rather than
// in soundForMove because seat-humanity is a UI concern, not move semantics.
export const soundsForCommit = (before: GameState, after: GameState, move: Move, moverIsHuman: boolean): SoundId[] => {
  const list = soundForMove(before, after, move)
  if (moverIsHuman) list.push('draw')
  return list
}

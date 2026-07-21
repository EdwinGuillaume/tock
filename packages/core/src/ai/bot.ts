import type { GameState, Move } from '../engine'
import { getLegalMoves } from '../engine'
import { scoreMove, cardKeepValue } from './score'

// Pick one move uniformly at random from a non-empty list, using an injected RNG
// so callers stay deterministic under test.
export const pickRandomMove = (moveList: Move[], random: () => number = Math.random): Move => {
  const index = Math.floor(random() * moveList.length)
  const chosen = moveList[index]
  if (!chosen) throw new Error('pickRandomMove: empty or out-of-range move list')
  return chosen
}

// Greedy one-move-lookahead: score every legal move for the current player, keep
// those tied at the best score, break the tie at random. Throws if there is no
// legal move — the game loop must skip empty-handed players before calling this.
export const pickMove = (state: GameState, random: () => number = Math.random): Move => {
  const moveList = getLegalMoves(state, state.currentPlayer)
  if (moveList.length === 0) throw new Error('pickMove: no legal moves for the current player')
  const scoredList = moveList.map(move => ({ move, score: scoreMove(state, move) }))
  const bestScore = Math.max(...scoredList.map(entry => entry.score))
  const topList = scoredList.filter(entry => entry.score === bestScore).map(entry => entry.move)
  // Forced-discard turn: getLegalMoves offers `discard` moves only when nothing
  // else is playable, so if every top move is a discard, keep the strong cards
  // and throw the weakest. The lowest keep-value is unique (distinct per rank,
  // and discards are de-duplicated by rank), so this is deterministic; the RNG
  // path is kept for uniformity and as a defensive fallback.
  const discardTopList = topList.filter(move => move.type === 'discard')
  if (discardTopList.length === topList.length && discardTopList.length > 0) {
    const keepList = discardTopList.map(move => ({ move, keep: cardKeepValue(move.card.rank) }))
    const minKeep = Math.min(...keepList.map(entry => entry.keep))
    const weakestList = keepList.filter(entry => entry.keep === minKeep).map(entry => entry.move)
    return pickRandomMove(weakestList, random)
  }
  return pickRandomMove(topList, random)
}

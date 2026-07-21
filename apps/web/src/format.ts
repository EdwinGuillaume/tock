import type { GameState, Move } from '@tock/core'
import { colorOf } from '@tock/core'

// Short, human-readable log line for a committed move. Kept deliberately simple
// for M1 (the terminal has a richer moveLabel; this is the web's own copy).
export const moveLabel = (before: GameState, after: GameState, move: Move): string => {
  const who = colorOf(before.currentPlayer)
  switch (move.type) {
    case 'exit': return `${who} exits a marble (${move.card.rank})`
    case 'move': return `${who} moves ${move.steps}${move.enterLane ? ' into the lane' : ''}`
    case 'push': return `${who} pushes an opponent 5`
    case 'swap': return `${who} swaps (Jack)`
    case 'split7': return `${who} splits the 7`
    case 'discard': return `${who} discards ${move.card.rank}`
  }
}

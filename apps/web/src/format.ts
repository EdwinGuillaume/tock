import type { Color, GameState, MarbleId, Move, Rank } from '@tock/core'
import { colorOf } from '@tock/core'
import { capturedColorList } from './audio/gameEvents'

export const colorLabel: Record<Color, string> = { red: 'Rouge', green: 'Vert', purple: 'Violet', blue: 'Bleu' }

const rankLabel: Record<Rank, string> = {
  A: 'As', J: 'Valet', Q: 'Dame', K: 'Roi',
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10'
}

// The single French letter shown on a card face: the engine keeps English ranks
// (A/J/Q/K), the UI displays them the French way (Valet -> V, Dame -> D, Roi -> R).
// The ace and number cards read the same in both languages.
export const rankGlyph: Record<Rank, string> = {
  A: 'A', J: 'V', Q: 'D', K: 'R',
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10'
}

// A log line is a sequence of segments — bare text and coloured player tokens —
// so the mover (and any opponent it acts on) each read in their own seat colour.
// The colour -> French name mapping lives in `colorLabel`; a token only carries
// the colour, and GameLog resolves the name so there is one source of truth.
export type LogSegment = string | { color: Color }
export type LogEntry = LogSegment[]

const ownerColor = (state: GameState, id: MarbleId): Color => {
  const marble = state.marbleList.find(candidate => candidate.id === id)
  return colorOf(marble ? marble.owner : state.currentPlayer)
}

const baseLine = (before: GameState, move: Move): LogEntry => {
  const mover: LogSegment = { color: colorOf(before.currentPlayer) }
  switch (move.type) {
    case 'exit':
      return [mover, ` sort une bille (${rankLabel[move.card.rank]})`]
    case 'move':
      return move.steps < 0
        ? [mover, ` recule de ${Math.abs(move.steps)}`]
        : [mover, ` avance de ${move.steps}${move.enterLane ? ' dans le couloir' : ''}`]
    case 'push':
      return [mover, ' pousse ', { color: ownerColor(before, move.marbleId) }, ` de ${move.steps}`]
    case 'swap':
      return [mover, ' échange avec ', { color: ownerColor(before, move.targetMarbleId) }, ' (Valet)']
    case 'split7':
      return [mover, ' répartit un 7']
    case 'discard':
      return [mover, ` défausse ${rankLabel[move.card.rank]}`]
  }
}

// One French log line for a committed move, with any resulting capture appended
// (`… et capture Bleu, Vert`). Kept deliberately terse for the web (the terminal
// has a richer moveLabel; this is the web's own copy).
export const moveLabel = (before: GameState, after: GameState, move: Move): LogEntry => {
  const line = baseLine(before, move)
  const capturedList = capturedColorList(before, after)
  capturedList.forEach((color, index) => {
    line.push(index === 0 ? ' et capture ' : ', ')
    line.push({ color })
  })
  return line
}

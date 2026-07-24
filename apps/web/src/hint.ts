import type { Card, Move } from '@tock/core'

export type HintContext =
  | { kind: 'idle' }
  | { kind: 'onlyDiscards' }
  | { kind: 'pickCard' }
  | { kind: 'ghosts', card: Card, moves: Move[] }
  | { kind: 'swapSource' }
  | { kind: 'swapTarget' }
  | { kind: 'split', focused: boolean, remaining: number }

// Forward step count read straight off the enumerated move, so a Queen yields 12
// without re-deriving a rank->steps map here.
const forwardSteps = (moves: Move[]): number => {
  const forward = moves.find(move => move.type === 'move')
  return forward && forward.type === 'move' ? forward.steps : 0
}

const ghostsHint = (card: Card, moves: Move[]): string => {
  const hasExit = moves.some(move => move.type === 'exit')
  const hasMove = moves.some(move => move.type !== 'exit' && move.type !== 'discard')
  switch (card.rank) {
    case '5': return 'avance un adversaire de 5 — choisis lequel'
    case '4': return 'recule ta bille de 4 cases — choisis laquelle'
    case '7': return 'avance ta bille de 7'
    case 'A':
      if (hasExit && hasMove) return "l'As sort une bille ou l'avance de 1"
      if (hasExit) return "l'As fait sortir une bille"
      return 'avance ta bille de 1'
    case 'K':
      if (hasExit && hasMove) return "le Roi sort une bille ou l'avance de 13"
      if (hasExit) return 'le Roi fait sortir une bille'
      return 'avance ta bille de 13'
    default: return `avance ta bille de ${forwardSteps(moves)}`
  }
}

const splitHint = (focused: boolean, remaining: number): string => {
  if (focused) return "choisis jusqu'où avancer"
  if (remaining === 0) return ''
  if (remaining === 7) return 'le 7 se répartit — choisis une bille'
  return remaining === 1
    ? 'continue — répartis le pas restant'
    : `continue — répartis les ${remaining} pas restants`
}

export const hintFor = (ctx: HintContext): string => {
  switch (ctx.kind) {
    case 'idle': return ''
    case 'onlyDiscards': return 'aucun coup — touche une carte pour la défausser'
    case 'pickCard': return 'choisis une carte'
    case 'ghosts': return ghostsHint(ctx.card, ctx.moves)
    case 'swapSource': return 'échange 2 billes — choisis la tienne'
    case 'swapTarget': return 'choisis la bille adverse à échanger'
    case 'split': return splitHint(ctx.focused, ctx.remaining)
  }
}

import type { GameState, Marble, Move, PlayerId } from '../engine'
import { applyMove, ringSize, startCell } from '../engine'

export const WEIGHTS = {
  progress: 1,
  finish: 60,
  capture: 50,
  exit: 5,
  exposure: 3
} as const

// One monotonic scalar per marble: higher means closer to winning. Home is 0, a
// marble just out of the nest is 1, distance travelled from the owner's start
// grows up to 48, and any finish slot (49..52) beats every ring cell.
export const advancement = (marble: Marble): number => {
  const position = marble.position
  if (position.zone === 'home') return 0
  if (position.zone === 'finish') return ringSize + 1 + position.index
  const distance = (position.index - startCell(marble.owner) + ringSize) % ringSize
  return 1 + distance
}

const maxForwardReach = 13
const maxBackwardReach = 4

// Strongest capture threat against one own track marble, hidden-hand-agnostic:
// an opponent up to 13 cells behind could reach it with a forward card, or up
// to 4 cells ahead with the backward 4. Closer threats weigh more. Path
// clearance is deliberately ignored (heuristic approximation).
const threatAgainst = (targetIndex: number, opponentIndexList: number[]): number => {
  let strongest = 0
  for (const opponentIndex of opponentIndexList) {
    const behind = (targetIndex - opponentIndex + ringSize) % ringSize
    if (behind >= 1 && behind <= maxForwardReach) {
      strongest = Math.max(strongest, maxForwardReach + 1 - behind)
    }
    const ahead = (opponentIndex - targetIndex + ringSize) % ringSize
    if (ahead >= 1 && ahead <= maxBackwardReach) {
      strongest = Math.max(strongest, maxBackwardReach + 1 - ahead)
    }
  }
  return strongest
}

// Total danger to `player`'s marbles in `state`: sum over own track marbles
// (excluding one protected on its own start) of the strongest threat.
export const exposureFor = (state: GameState, player: PlayerId): number => {
  const ownStart = startCell(player)
  const opponentIndexList: number[] = []
  for (const marble of state.marbleList) {
    if (marble.owner !== player && marble.position.zone === 'track') {
      opponentIndexList.push(marble.position.index)
    }
  }
  let total = 0
  for (const marble of state.marbleList) {
    if (marble.owner !== player) continue
    if (marble.position.zone !== 'track') continue
    if (marble.position.index === ownStart) continue
    total += threatAgainst(marble.position.index, opponentIndexList)
  }
  return total
}

// Score a candidate move for state.currentPlayer by simulating applyMove and
// reading the before -> after difference: own advancement gained, marbles
// parked in the finish, opponents captured, exit urgency, minus the danger of
// the resulting board.
export const scoreMove = (state: GameState, move: Move): number => {
  const botId = state.currentPlayer
  const after = applyMove(state, move, () => 0)
  const beforeById = new Map(state.marbleList.map(marble => [marble.id, marble]))

  let advancementDelta = 0
  let enteringFinish = 0
  let captured = 0

  for (const afterMarble of after.marbleList) {
    const beforeMarble = beforeById.get(afterMarble.id)
    if (!beforeMarble) continue
    if (afterMarble.owner === botId) {
      advancementDelta += advancement(afterMarble) - advancement(beforeMarble)
      if (afterMarble.position.zone === 'finish' && beforeMarble.position.zone !== 'finish') {
        enteringFinish += 1
      }
    } else if (afterMarble.position.zone === 'home' && beforeMarble.position.zone === 'track') {
      captured += 1
    }
  }

  const exitUrgency = move.type === 'exit'
    ? state.marbleList.filter(marble => marble.owner === botId && marble.position.zone === 'home').length
    : 0

  return WEIGHTS.progress * advancementDelta
    + WEIGHTS.finish * enteringFinish
    + WEIGHTS.capture * captured
    + WEIGHTS.exit * exitUrgency
    - WEIGHTS.exposure * exposureFor(after, botId)
}

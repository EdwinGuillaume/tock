import type { GameState, Move, Position } from '../engine'
import { colorOf } from '../engine'

export const positionLabel = (position: Position): string => {
  if (position.zone === 'home') return 'home'
  if (position.zone === 'track') return `@${position.index}`
  return `finish ${position.index + 1}`
}

const positionOf = (state: GameState, id: string): Position | null =>
  state.marbleList.find(marble => marble.id === id)?.position ?? null

const samePosition = (a: Position, b: Position): boolean =>
  a.zone === b.zone && ('index' in a && 'index' in b ? a.index === b.index : true)

// A short recap of the move just played, read by diffing before -> after.
export const moveLabel = (before: GameState, after: GameState, move: Move): string => {
  const actor = before.currentPlayer
  const color = colorOf(actor)
  const rank = move.card.rank
  if (move.type === 'discard') return `${color} discards ${rank}`

  const formatDestination = (position: Position): string => {
    if (position.zone === 'track') return `${position.index}`
    return positionLabel(position)
  }

  const changeList: string[] = []
  for (const marble of after.marbleList) {
    if (marble.owner !== actor) continue
    const start = positionOf(before, marble.id)
    if (!start || samePosition(start, marble.position)) continue
    changeList.push(`${positionLabel(start)}→${formatDestination(marble.position)}`)
  }

  const captured = after.marbleList.some(marble => {
    if (marble.owner === actor || marble.position.zone !== 'home') return false
    const start = positionOf(before, marble.id)
    return start !== null && start.zone !== 'home'
  })

  return `${color} plays ${rank} — ${changeList.join(', ')}${captured ? ', captured!' : ''}`
}

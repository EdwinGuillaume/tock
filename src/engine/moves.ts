import type { Card, GameState, Marble, MarbleId, Move, Player, PlayerId, Position } from './types'
import { finishSize, ringDestinations, startCell, stepsToMouth } from './board'
import { canExit, moveSteps } from './cards'
import { drawCard } from './state'

const playerById = (state: GameState, id: PlayerId): Player => {
  const found = state.playerList.find(player => player.id === id)
  if (!found) throw new Error(`player ${id} not found`)
  return found
}

const findMarble = (state: GameState, id: MarbleId): Marble => {
  const found = state.marbleList.find(marble => marble.id === id)
  if (!found) throw new Error(`marble ${id} not found`)
  return found
}

const removeCard = (hand: Card[], target: Card): Card[] => {
  const index = hand.findIndex(handCard => handCard.rank === target.rank && handCard.suit === target.suit)
  if (index < 0) return hand
  return [...hand.slice(0, index), ...hand.slice(index + 1)]
}

const samePosition = (left: Position, right: Position): boolean => {
  if (left.zone !== right.zone) return false
  if (left.zone === 'home' || right.zone === 'home') return true
  return left.index === right.index
}

const activeSeatList = (state: GameState): PlayerId[] =>
  state.playerList.filter(player => player.kind !== 'inactive').map(player => player.id)

export const nextPlayer = (state: GameState): PlayerId => {
  const seatList = activeSeatList(state)
  const currentIndex = seatList.indexOf(state.currentPlayer)
  return seatList[(currentIndex + 1) % seatList.length] ?? state.currentPlayer
}

// Relocate one marble to `to`, sending any opponent already on that ring cell
// back home. Finish cells are private per owner, so captures apply to `track` only.
const relocate = (marbleList: Marble[], mover: Marble, to: Position): Marble[] =>
  marbleList.map(marble => {
    if (marble.id === mover.id) return { ...marble, position: to }
    if (marble.owner !== mover.owner && to.zone === 'track' && samePosition(marble.position, to)) {
      return { ...marble, position: { zone: 'home' } }
    }
    return marble
  })

const withTurnDone = (
  state: GameState,
  actor: Player,
  move: Move,
  marbleList: Marble[],
  random: () => number
): GameState => {
  const handAfterPlay = removeCard(actor.hand, move.card)
  const discardWithPlayed = [...state.discardPile, move.card]
  const drawn = drawCard(state.drawPile, discardWithPlayed, random)
  const refilledHand = drawn.card ? [...handAfterPlay, drawn.card] : handAfterPlay
  return {
    ...state,
    marbleList,
    playerList: state.playerList.map(player =>
      player.id === actor.id ? { ...player, hand: refilledHand } : player
    ),
    drawPile: drawn.drawPile,
    discardPile: drawn.discardPile,
    currentPlayer: nextPlayer({ ...state, marbleList })
  }
}

const isProtected = (marble: Marble, ringSize: number): boolean =>
  marble.position.zone === 'track' && marble.position.index === startCell(marble.owner, ringSize)

// Ring cells strictly between origin and the point where the marble leaves the
// ring (`ringSteps` steps away) must hold no protected marble.
const pathClear = (state: GameState, mover: Marble, steps: number, ringSteps: number): boolean => {
  if (mover.position.zone !== 'track') return true
  const direction = steps >= 0 ? 1 : -1
  for (let step = 1; step < ringSteps; step++) {
    const index = (((mover.position.index + direction * step) % state.ringSize) + state.ringSize) % state.ringSize
    const occupant = state.marbleList.find(
      marble => marble.position.zone === 'track' && marble.position.index === index
    )
    if (occupant && isProtected(occupant, state.ringSize)) return false
  }
  return true
}

// Resolve the destination for a 'move' given the mover's origin and the chosen
// outcome (enterLane). Returns null if the move is not geometrically legal.
const resolveDestination = (
  state: GameState,
  mover: Marble,
  steps: number,
  enterLane: boolean
): Position | null => {
  if (mover.position.zone === 'track') {
    const reach = ringDestinations(mover.owner, mover.position.index, steps, state.ringSize)
    const wanted = enterLane ? reach.lane : reach.ring
    if (!wanted) return null
    const ringStepCount = wanted.zone === 'finish'
      ? stepsToMouth(mover.owner, mover.position.index, steps, state.ringSize)
      : Math.abs(steps)
    if (!pathClear(state, mover, steps, ringStepCount)) return null
    if (wanted.zone === 'finish' && !finishPathClear(state, mover, wanted.index)) return null
    return canLandOn(state, mover, wanted) ? wanted : null
  }

  if (mover.position.zone === 'finish') {
    if (steps <= 0) return null // no backward movement inside the lane
    const target = mover.position.index + steps
    if (target >= finishSize) return null // exact count, no overshoot
    if (!finishPathClear(state, mover, target)) return null
    return { zone: 'finish', index: target }
  }

  return null // home marbles move only via 'exit'
}

// No own marble may sit on any finish cell strictly between the mover and
// `target`, nor on `target` itself (cannot jump over or land on a parked marble).
const finishPathClear = (state: GameState, mover: Marble, target: number): boolean => {
  const from = mover.position.zone === 'finish' ? mover.position.index : -1
  return !state.marbleList.some(
    marble => marble.owner === mover.owner &&
      marble.id !== mover.id &&
      marble.position.zone === 'finish' &&
      marble.position.index > from &&
      marble.position.index <= target
  )
}

const allInFinish = (state: GameState, player: PlayerId): boolean =>
  state.marbleList
    .filter(marble => marble.owner === player)
    .every(marble => marble.position.zone === 'finish')

const applyMoveInner = (state: GameState, move: Move, random: () => number): GameState => {
  const actor = playerById(state, state.currentPlayer)

  if (move.type === 'discard') {
    return withTurnDone(state, actor, move, state.marbleList, random)
  }

  if (move.type === 'exit') {
    const mover = findMarble(state, move.marbleId)
    const to: Position = { zone: 'track', index: startCell(actor.id, state.ringSize) }
    return withTurnDone(state, actor, move, relocate(state.marbleList, mover, to), random)
  }

  if (move.type === 'move') {
    const mover = findMarble(state, move.marbleId)
    const to = resolveDestination(state, mover, move.steps, move.enterLane ?? false)
    if (!to) throw new Error('illegal move passed to applyMove')
    const doneState = withTurnDone(state, actor, move, relocate(state.marbleList, mover, to), random)
    const winner = allInFinish(doneState, actor.id) ? actor.id : doneState.winner
    return { ...doneState, winner }
  }

  if (move.type === 'split7') {
    return applySplit(state, actor, move, random)
  }

  if (move.type === 'swap') {
    const own = findMarble(state, move.marbleId)
    const enemy = findMarble(state, move.targetMarbleId)
    const marbleList = state.marbleList.map(marble => {
      if (marble.id === own.id) return { ...marble, position: enemy.position }
      if (marble.id === enemy.id) return { ...marble, position: own.position }
      return marble
    })
    return withTurnDone(state, actor, move, marbleList, random)
  }

  throw new Error(`move type not supported yet: ${JSON.stringify(move)}`)
}

export const applyMove = (state: GameState, move: Move, random: () => number = Math.random): GameState =>
  applyMoveInner(state, move, random)

const ownMarbleList = (state: GameState, player: PlayerId): Marble[] =>
  state.marbleList.filter(marble => marble.owner === player)

// Is landing on `to` legal for `mover`? Only ring cells can be contested — a
// finish cell is private to its owner (own-lane blocking is handled by
// finishPathClear). An own marble blocks; an opponent is a capture unless it
// is protected on its own start cell.
const canLandOn = (state: GameState, mover: Marble, to: Position): boolean => {
  if (to.zone !== 'track') return true
  const occupant = state.marbleList.find(
    marble => marble.position.zone === 'track' && marble.position.index === to.index
  )
  if (!occupant) return true
  if (occupant.owner === mover.owner) return false
  return !isProtected(occupant, state.ringSize)
}

export const getLegalMoves = (state: GameState, player: PlayerId): Move[] => {
  const hand = playerById(state, player).hand
  const marbleList = ownMarbleList(state, player)
  const result: Move[] = []

  for (const playedCard of hand) {
    const { rank } = playedCard

    if (canExit(rank)) {
      const startIndex = startCell(player, state.ringSize)
      const startBlockedByOwn = marbleList.some(
        marble => marble.position.zone === 'track' && marble.position.index === startIndex
      )
      if (!startBlockedByOwn) {
        for (const marble of marbleList) {
          if (marble.position.zone === 'home') {
            result.push({ type: 'exit', card: playedCard, marbleId: marble.id })
          }
        }
      }
    }

    const steps = moveSteps(rank)
    if (steps !== null) {
      for (const marble of marbleList) {
        if (marble.position.zone === 'home') continue
        // enterLane only matters for a ring origin; a finish-origin move has one outcome
        const laneOptionList = marble.position.zone === 'track' ? [false, true] : [false]
        for (const enterLane of laneOptionList) {
          const to = resolveDestination(state, marble, steps, enterLane)
          if (!to) continue
          const move: Move = enterLane
            ? { type: 'move', card: playedCard, marbleId: marble.id, steps, enterLane: true }
            : { type: 'move', card: playedCard, marbleId: marble.id, steps }
          result.push(move)
        }
      }
    }

    if (rank === '7') {
      for (const partList of enumerateSplits(state, player)) {
        result.push({ type: 'split7', card: playedCard, partList })
      }
    }

    if (rank === 'J') {
      // Protection is defensive only: you may swap away your own marble even on
      // its start cell (you give up its protection), but a protected opponent
      // marble cannot be swap-stolen.
      const ownRingList = marbleList.filter(marble => marble.position.zone === 'track')
      const enemyRingList = state.marbleList.filter(
        marble => marble.owner !== player && marble.position.zone === 'track' && !isProtected(marble, state.ringSize)
      )
      for (const own of ownRingList) {
        for (const enemy of enemyRingList) {
          result.push({ type: 'swap', card: playedCard, marbleId: own.id, targetMarbleId: enemy.id })
        }
      }
    }
  }

  if (result.length === 0) {
    const seenRankSet = new Set<string>()
    for (const playedCard of hand) {
      if (seenRankSet.has(playedCard.rank)) continue
      seenRankSet.add(playedCard.rank)
      result.push({ type: 'discard', card: playedCard })
    }
  }

  return result
}

type SplitPart = { marbleId: MarbleId, steps: number, enterLane?: boolean }

// Apply one part on a working state (reuses the single-move resolver).
const applyPart = (state: GameState, mover: Marble, part: SplitPart): GameState | null => {
  const to = resolveDestination(state, mover, part.steps, part.enterLane ?? false)
  if (!to) return null
  return { ...state, marbleList: relocate(state.marbleList, mover, to) }
}

// Enumerate every legal distribution of exactly 7 across own moveable marbles.
// At each step any not-yet-used marble may take the next part, so partitions
// that are legal only under a particular application order are found. Partitions
// are de-duplicated by a canonical (order-independent) key so a partition legal
// under several orders is emitted once, in one legal order.
const enumerateSplits = (state: GameState, player: PlayerId): SplitPart[][] => {
  const moveableList = ownMarbleList(state, player).filter(marble => marble.position.zone !== 'home')
  const result: SplitPart[][] = []
  const seenKeySet = new Set<string>()

  const keyOf = (partList: SplitPart[]): string =>
    partList
      .map(part => `${part.marbleId}:${part.steps}:${part.enterLane ?? false}`)
      .sort()
      .join('|')

  const recurse = (working: GameState, usedIdSet: Set<string>, remaining: number, chosen: SplitPart[]): void => {
    if (remaining === 0) {
      if (chosen.length === 0) return
      const key = keyOf(chosen)
      if (seenKeySet.has(key)) return
      seenKeySet.add(key)
      result.push(chosen)
      return
    }
    for (const marble of moveableList) {
      if (usedIdSet.has(marble.id)) continue
      const current = findMarble(working, marble.id)
      const laneList = current.position.zone === 'track' ? [false, true] : [false]
      for (let steps = 1; steps <= remaining; steps++) {
        for (const enterLane of laneList) {
          const part: SplitPart = enterLane
            ? { marbleId: marble.id, steps, enterLane: true }
            : { marbleId: marble.id, steps }
          const advanced = applyPart(working, current, part)
          if (!advanced) continue
          recurse(advanced, new Set([...usedIdSet, marble.id]), remaining - steps, [...chosen, part])
        }
      }
    }
  }

  recurse(state, new Set(), 7, [])
  return result
}

const applySplit = (
  state: GameState,
  actor: Player,
  move: Extract<Move, { type: 'split7' }>,
  random: () => number
): GameState => {
  let working: GameState = state
  for (const part of move.partList) {
    const mover = findMarble(working, part.marbleId)
    const advanced = applyPart(working, mover, part)
    if (!advanced) throw new Error('illegal split part passed to applyMove')
    working = advanced
  }
  const doneState = withTurnDone(state, actor, move, working.marbleList, random)
  const winner = allInFinish(doneState, actor.id) ? actor.id : doneState.winner
  return { ...doneState, winner }
}

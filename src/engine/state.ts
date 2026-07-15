import type { Card, Color, GameState, Marble, MarbleId, Player, PlayerId, PlayerKind } from './types'
import { createDeck, shuffle } from './cards'

export const handSize = 5

const playerOrder: PlayerId[] = [0, 1, 2, 3]
const colorByPlayer: Record<PlayerId, Color> = { 0: 'red', 1: 'green', 2: 'yellow', 3: 'blue' }

export const colorOf = (player: PlayerId): Color => colorByPlayer[player]

export const marbleId = (player: PlayerId, index: number): MarbleId => `p${player}m${index}`

export const createGame = (
  kindList: PlayerKind[],
  random: () => number = Math.random
): GameState => {
  const drawPile = shuffle(createDeck(), random)
  const marbleList: Marble[] = []
  const playerList: Player[] = []

  for (const seat of playerOrder) {
    const kind = kindList[seat] ?? 'inactive'
    const hand = kind === 'inactive' ? [] : drawPile.splice(0, handSize)
    playerList.push({ id: seat, color: colorByPlayer[seat], kind, hand })
    if (kind !== 'inactive') {
      for (let index = 0; index < 4; index++) {
        marbleList.push({ id: marbleId(seat, index), owner: seat, position: { zone: 'home' } })
      }
    }
  }

  const firstActive = playerList.find(player => player.kind !== 'inactive')
  return {
    playerList,
    marbleList,
    drawPile,
    discardPile: [],
    currentPlayer: firstActive?.id ?? 0,
    winner: null
  }
}

export const redealIfNeeded = (state: GameState, random: () => number = Math.random): GameState => {
  const activeList = state.playerList.filter(player => player.kind !== 'inactive')
  const allEmpty = activeList.every(player => player.hand.length === 0)
  if (!allEmpty) return state

  let drawPile = [...state.drawPile]
  let discardPile = [...state.discardPile]
  const playerList = state.playerList.map(player => {
    if (player.kind === 'inactive') return player
    const hand: Card[] = []
    for (let slot = 0; slot < handSize; slot++) {
      if (drawPile.length === 0) {
        drawPile = shuffle(discardPile, random)
        discardPile = []
      }
      const drawn = drawPile.shift()
      if (drawn) hand.push(drawn)
    }
    return { ...player, hand }
  })

  return { ...state, playerList, drawPile, discardPile }
}

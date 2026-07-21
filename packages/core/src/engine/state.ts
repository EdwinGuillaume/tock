import type { Card, Color, GameState, Marble, MarbleId, Player, PlayerId, PlayerKind } from './types'
import { createDeck, shuffle } from './cards'
import { DEFAULT_RING_SIZE } from './board'

export const handSize = 5

// Draw the top card, reshuffling the discard pile into an empty draw pile first.
// Returns the drawn card and the updated piles; card is null only when both
// piles are empty.
export const drawCard = (
  drawPile: Card[],
  discardPile: Card[],
  random: () => number = Math.random
): { card: Card | null, drawPile: Card[], discardPile: Card[] } => {
  let draw = drawPile
  let discard = discardPile
  if (draw.length === 0) {
    draw = shuffle(discard, random)
    discard = []
  }
  const [top, ...rest] = draw
  if (top === undefined) return { card: null, drawPile: draw, discardPile: discard }
  return { card: top, drawPile: rest, discardPile: discard }
}

const playerOrder: PlayerId[] = [0, 1, 2, 3]
const colorByPlayer: Record<PlayerId, Color> = { 0: 'red', 1: 'green', 2: 'yellow', 3: 'blue' }

export const colorOf = (player: PlayerId): Color => colorByPlayer[player]

export const marbleId = (player: PlayerId, index: number): MarbleId => `p${player}m${index}`

export const createGame = (
  kindList: PlayerKind[],
  ringSize: number = DEFAULT_RING_SIZE,
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
    winner: null,
    ringSize
  }
}

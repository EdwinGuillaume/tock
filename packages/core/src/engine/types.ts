export type PlayerId = 0 | 1 | 2 | 3
export type Color = 'red' | 'green' | 'purple' | 'blue'
export type MarbleId = string

export type Position =
  | { zone: 'home' }
  | { zone: 'track', index: number }
  | { zone: 'finish', index: number }

export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'
export type Card = { rank: Rank, suit: Suit }

export type Marble = { id: MarbleId, owner: PlayerId, position: Position }

export type Move =
  | { type: 'exit', card: Card, marbleId: MarbleId }
  | { type: 'move', card: Card, marbleId: MarbleId, steps: number, enterLane?: boolean }
  | { type: 'push', card: Card, marbleId: MarbleId, steps: number }
  | { type: 'split7', card: Card, partList: { marbleId: MarbleId, steps: number, enterLane?: boolean }[] }
  | { type: 'swap', card: Card, marbleId: MarbleId, targetMarbleId: MarbleId }
  | { type: 'discard', card: Card }

export type PlayerKind = 'human' | 'bot' | 'inactive'

export type Player = {
  id: PlayerId
  color: Color
  kind: PlayerKind
  hand: Card[]
}

export type GameState = {
  playerList: Player[]
  marbleList: Marble[]
  drawPile: Card[]
  discardPile: Card[]
  currentPlayer: PlayerId
  winner: PlayerId | null
  ringSize: number
}

import type { Card, GameState, Marble, MarbleId, PlayerId, Position, Rank, Suit } from '@tock/core'

export const card = (rank: Rank, suit: Suit = 'hearts'): Card => ({ rank, suit })

export const findMarble = (state: GameState, id: MarbleId): Marble => {
  const marble = state.marbleList.find(candidate => candidate.id === id)
  if (!marble) throw new Error(`marble ${id} not found`)
  return marble
}

export const place = (state: GameState, id: MarbleId, position: Position): GameState => ({
  ...state,
  marbleList: state.marbleList.map(marble => (marble.id === id ? { ...marble, position } : marble))
})

export const setHand = (state: GameState, player: PlayerId, cardList: Card[]): GameState => ({
  ...state,
  playerList: state.playerList.map(entry => (entry.id === player ? { ...entry, hand: cardList } : entry))
})

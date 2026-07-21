import type { GameState, PlayerId } from '@tock/core'

export const humanSeatIds = (state: GameState): PlayerId[] =>
  state.playerList.filter(player => player.kind === 'human').map(player => player.id)

// Whose hand belongs at the bottom of the screen — the human "holding the
// device", not necessarily the seat currently playing. It is the nearest human
// seat at or before the current player in turn order: the current seat itself
// when a human is playing, otherwise the human who last moved (and will get the
// device back after the intervening bots, until the next human's handoff). This
// keeps the human's own cards on screen while bots take their turns instead of
// flashing the bot's hand. Returns null only when the game has no human seat.
export const activeHumanSeat = (state: GameState, humanIdList: PlayerId[]): PlayerId | null => {
  if (humanIdList.length === 0) return null
  const seatList = state.playerList.filter(player => player.kind !== 'inactive').map(player => player.id)
  const currentIndex = seatList.indexOf(state.currentPlayer)
  const count = seatList.length
  if (currentIndex === -1 || count === 0) return humanIdList[0] ?? null
  for (let step = 0; step < count; step++) {
    const seat = seatList[(currentIndex - step + count) % count]
    if (seat !== undefined && humanIdList.includes(seat)) return seat
  }
  return humanIdList[0] ?? null
}

// A handoff screen is needed only when control passes to a human seat that is
// different from the one who just moved. Bot seats never trigger it, and a single
// human game (solo vs bots) never triggers it.
export const needsHandoff = (previousPlayer: PlayerId, state: GameState, humanIdList: PlayerId[]): boolean => {
  if (humanIdList.length < 2) return false
  const current = state.currentPlayer
  return humanIdList.includes(current) && current !== previousPlayer
}

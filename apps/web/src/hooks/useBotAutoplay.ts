import { useEffect } from 'react'
import type { GameState, Move, PlayerId } from '@tock/core'
import { pickMove } from '@tock/core'

export const isHumanSeat = (state: GameState, humanSeatIds: PlayerId[]): boolean =>
  humanSeatIds.includes(state.currentPlayer)

type Args = {
  state: GameState | null
  humanSeatIds: PlayerId[]
  delayMs: number
  commitMove: (move: Move) => void
  random?: () => number
}

// When it is a bot seat's turn, schedule its move after a short delay so the
// human can follow. One timer per state; cleared on change (mirrors the terminal
// useGameLoop).
export const useBotAutoplay = ({ state, humanSeatIds, delayMs, commitMove, random }: Args): void => {
  useEffect(() => {
    if (!state || state.winner !== null) return
    if (isHumanSeat(state, humanSeatIds)) return
    const timer = setTimeout(() => commitMove(pickMove(state, random)), delayMs)
    return () => clearTimeout(timer)
  }, [state, humanSeatIds, delayMs, commitMove, random])
}

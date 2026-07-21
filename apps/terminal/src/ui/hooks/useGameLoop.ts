import { useEffect } from 'react'
import type { GameState, Move, PlayerId } from '@tock/core'
import { pickMove } from '@tock/core'

export const actorKind = (state: GameState, human: PlayerId): 'gameover' | 'human' | 'bot' => {
  if (state.winner !== null) return 'gameover'
  return state.currentPlayer === human ? 'human' : 'bot'
}

type UseGameLoopArgs = {
  state: GameState
  human: PlayerId
  delayMs: number
  onCommit: (move: Move) => void
}

// Auto-plays bot turns: when it is a bot's turn, schedules its move after a
// short delay so the human can follow. One timer per state; cleared on change.
export const useGameLoop = ({ state, human, delayMs, onCommit }: UseGameLoopArgs): void => {
  useEffect(() => {
    if (actorKind(state, human) !== 'bot') return
    const timer = setTimeout(() => onCommit(pickMove(state)), delayMs)
    return () => clearTimeout(timer)
  }, [state, human, delayMs, onCommit])
}

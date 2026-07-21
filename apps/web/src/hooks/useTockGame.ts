import { useCallback, useState } from 'react'
import type { GameState, Move, PlayerKind } from '@tock/core'
import { applyMove, createGame } from '@tock/core'
import { moveLabel } from '../format'

export const useTockGame = () => {
  const [state, setState] = useState<GameState | null>(null)
  const [logList, setLogList] = useState<string[]>([])

  const start = useCallback((kindList: PlayerKind[], ringSize: number) => {
    setState(createGame(kindList, ringSize))
    setLogList([])
  }, [])

  const restart = useCallback(() => {
    setState(null)
    setLogList([])
  }, [])

  const commitMove = useCallback((move: Move) => {
    if (!state) return
    const next = applyMove(state, move)
    setLogList(previous => [...previous, moveLabel(state, next, move)])
    setState(next)
  }, [state])

  return { state, logList, start, restart, commitMove }
}

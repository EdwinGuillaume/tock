import { useCallback, useMemo, useState } from 'react'
import type { Move } from '@tock/core'
import { applyMove, colorOf } from '@tock/core'
import { useTockGame } from '../hooks/useTockGame'
import { useBotAutoplay } from '../hooks/useBotAutoplay'
import { humanSeatIds, needsHandoff } from '../passAndPlay'
import { GameScreen } from './GameScreen'
import { Setup } from './Setup'
import { GameOver } from './GameOver'
import { PassInterstitial } from './PassInterstitial'

const BOT_DELAY_MS = 900

export const App = () => {
  const { state, logList, start, restart, commitMove } = useTockGame()
  const humanIdList = useMemo(() => (state ? humanSeatIds(state) : []), [state])
  const [awaitingHandoff, setAwaitingHandoff] = useState(false)

  // needsHandoff decides from the state AFTER the move, but commitMove updates
  // state asynchronously — so recompute the next state directly with applyMove
  // (pure, same inputs as the hook's own commit) to make the decision now.
  // Used for BOTH the human move path (below, via GameScreen) and the bot
  // autoplay path (useBotAutoplay) — a bot's move can hand off to a human
  // seat just as much as a human's move can, so both must gate on it or the
  // next human's hand gets shown to whoever is still holding the device.
  // Stable per `state` (not per render): humanIdList is itself memoized on
  // [state] and commitMove is stable per [state] (see useTockGame), so this
  // only changes identity when `state` changes — which is exactly when
  // useBotAutoplay's effect should re-arm its timer, not on every render.
  const commitAndPass = useCallback((move: Move) => {
    if (!state) return
    const previous = state.currentPlayer
    commitMove(move)
    const next = applyMove(state, move)
    if (needsHandoff(previous, next, humanSeatIds(next))) setAwaitingHandoff(true)
  }, [state, humanIdList, commitMove])

  useBotAutoplay({ state: awaitingHandoff ? null : state, humanSeatIds: humanIdList, delayMs: BOT_DELAY_MS, commitMove: commitAndPass })

  const handleRestart = () => {
    setAwaitingHandoff(false)
    restart()
  }

  if (!state) return <Setup onStart={(kindList, ringSize) => start(kindList, ringSize)} />
  if (state.winner !== null) return <GameOver winnerColor={colorOf(state.winner)} onRestart={handleRestart} />
  if (awaitingHandoff) return <PassInterstitial color={colorOf(state.currentPlayer)} onReveal={() => setAwaitingHandoff(false)} />

  return <GameScreen state={state} logList={logList} humanSeatIds={humanIdList} commitMove={commitAndPass} />
}

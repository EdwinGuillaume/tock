import { Box, Text, useApp } from 'ink'
import { useCallback, useMemo, useState } from 'react'
import type { GameState, Move, PlayerKind } from '../engine'
import { applyMove, colorOf, createGame, getLegalMoves } from '../engine'
import { Board } from './Board'
import { GameLog } from './GameLog'
import { GameOver } from './GameOver'
import { Hand } from './Hand'
import { Setup } from './Setup'
import { SplitPanel } from './SplitPanel'
import { Status } from './Status'
import { moveLabel } from './format'
import type { Cell } from './layout'
import { movePreviewCells } from './layout'
import { actorKind, useGameLoop } from './hooks/useGameLoop'
import { useTurnInput } from './hooks/useTurnInput'
import type { Selection, TurnContext } from './selection'
import { playableCard } from './selection'

const HUMAN = 0
const BOT_DELAY_MS = 700

const promptFor = (selectionStep: Selection['step']): string => {
  switch (selectionStep) {
    case 'pickCard': return 'choose a card'
    case 'pickMarble': return 'choose a marble'
    case 'pickDestination': return 'choose where to land'
    case 'pickTarget': return 'choose a marble to swap'
    case 'splitAllocation': return 'split the 7 across your marbles'
    default: return 'your turn'
  }
}

export const App = () => {
  const { exit } = useApp()
  const [state, setState] = useState<GameState | null>(null)
  const [logList, setLogList] = useState<string[]>([])
  const [lastMoveCellList, setLastMoveCellList] = useState<Cell[]>([])

  const handleStart = (botCount: number) => {
    const kindList: PlayerKind[] = ['human', ...Array.from({ length: botCount }, () => 'bot' as const)]
    setState(createGame(kindList))
    setLogList([])
    setLastMoveCellList([])
  }

  const handleRestart = () => {
    setState(null)
    setLogList([])
    setLastMoveCellList([])
  }

  // Memoized on `state` so it stays referentially stable within a single turn.
  // useGameLoop's effect depends on onCommit; a fresh closure every render would
  // re-arm the bot timer on every render and keep deferring the bot's move.
  const commitMove = useCallback((move: Move) => {
    if (!state) return
    const next = applyMove(state, move)
    setLogList(previous => [...previous, moveLabel(state, next, move)])
    setLastMoveCellList(movePreviewCells(state, move))
    setState(next)
  }, [state])

  const placeholder = useMemo(() => createGame(['human', 'bot']), [])
  const activeState = state ?? placeholder
  const isPlaying = state !== null && state.winner === null
  const { selection, highlight } = useTurnInput({
    state: activeState,
    human: HUMAN,
    active: isPlaying && state?.currentPlayer === HUMAN,
    onCommit: commitMove
  })

  useGameLoop({
    state: activeState,
    human: HUMAN,
    delayMs: BOT_DELAY_MS,
    onCommit: commitMove
  })

  if (!state) return <Setup onStart={handleStart} />

  if (state.winner !== null) {
    return (
      <GameOver
        winnerColor={colorOf(state.winner)}
        onRestart={handleRestart}
        onQuit={exit}
      />
    )
  }

  const humanHand = state.playerList.find(player => player.id === HUMAN)?.hand ?? []
  const kind = actorKind(state, HUMAN)
  const prompt = kind === 'bot' ? `${colorOf(state.currentPlayer)} is thinking…` : promptFor(selection.step)

  const humanContext: TurnContext | null = kind === 'human'
    ? { state, legalMoves: getLegalMoves(state, HUMAN), human: HUMAN }
    : null
  const playableList = humanContext ? humanHand.map(entry => playableCard(entry, humanContext)) : undefined

  // While the human is choosing, preview their selection; otherwise keep the
  // last move's cells lit so the human can see what a bot just did.
  const boardHighlight = highlight.length > 0 ? highlight : lastMoveCellList

  return (
    <Box flexDirection="column">
      <Text bold>TOCK</Text>
      {/* Board and log sit side by side so a growing log never pushes the board:
          the row is as tall as the board and the log bottom-anchors within it. */}
      <Box>
        <Board state={state} highlight={boardHighlight} />
        <Box marginLeft={2} flexDirection="column" justifyContent="flex-end">
          <GameLog logList={logList} />
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Hand
          hand={humanHand}
          cursor={selection.step === 'pickCard' ? selection.cardCursor : -1}
          active={kind === 'human'}
          playable={playableList}
        />
        {humanContext && selection.step === 'splitAllocation' && (
          <SplitPanel selection={selection} ctx={humanContext} />
        )}
        <Status turnColor={colorOf(state.currentPlayer)} isHuman={kind === 'human'} prompt={prompt} />
      </Box>
    </Box>
  )
}

import { useMemo, useState } from 'react'
import type { GameState, MarbleId, Move, PlayerId } from '@tock/core'
import { colorOf, getLegalMoves } from '@tock/core'
import { isHumanSeat } from '../hooks/useBotAutoplay'
import { activeHumanSeat } from '../passAndPlay'
import type { Ghost as GhostType } from '../moveSelection'
import {
  ghostsForCard, handIsPlayable, isDiscardOnly, isSplitCard,
  movesForCard, ownSwapMarbleIds, swapTargetsFor
} from '../moveSelection'
import type { SplitDraft } from '../splitAllocation'
import {
  allocate, completedSplitMove, splitCandidateIds, splitGhostsForMarble,
  splitRemaining, startSplit, undoLast
} from '../splitAllocation'
import { marbleCenter } from '../svgGeometry'
import { Board } from './Board'
import { Hand } from './Hand'
import { StatusBar } from './StatusBar'
import { GameLog } from './GameLog'
import { SplitControls } from './SplitControls'

type GameScreenProps = {
  state: GameState
  logList: string[]
  humanSeatIds: PlayerId[]
  commitMove: (move: Move) => void
}

type Interaction =
  | { phase: 'pickCard' }
  | { phase: 'ghosts', cardIndex: number }
  | { phase: 'swapTarget', cardIndex: number, marbleId: MarbleId }
  | { phase: 'split', cardIndex: number, draft: SplitDraft, focusMarbleId: MarbleId | null }

export const GameScreen = ({ state, logList, humanSeatIds, commitMove }: GameScreenProps) => {
  const [interaction, setInteraction] = useState<Interaction>({ phase: 'pickCard' })

  const legalMoves = useMemo(
    () => (isHumanSeat(state, humanSeatIds) && state.winner === null ? getLegalMoves(state, state.currentPlayer) : []),
    [state, humanSeatIds]
  )

  // Always the active human's hand — the device holder's cards stay on screen
  // even while a bot is taking its turn (on a human turn this is currentPlayer).
  const handSeat = activeHumanSeat(state, humanSeatIds) ?? state.currentPlayer
  const hand = state.playerList.find(player => player.id === handSeat)?.hand ?? []
  const humanTurn = isHumanSeat(state, humanSeatIds)
  const playableList = hand.map(card => humanTurn && handIsPlayable(card, legalMoves))

  const resetInteraction = () => setInteraction({ phase: 'pickCard' })
  const doCommit = (move: Move) => {
    commitMove(move)
    resetInteraction()
  }

  // --- build the ghost list for the current interaction phase ---
  let ghostList: GhostType[] = []
  if (humanTurn && interaction.phase === 'ghosts') {
    const card = hand[interaction.cardIndex]
    if (card) ghostList = ghostsForCard(card, state, legalMoves)
  } else if (humanTurn && interaction.phase === 'swapTarget') {
    const card = hand[interaction.cardIndex]
    if (card) {
      ghostList = swapTargetsFor(card, interaction.marbleId, legalMoves).map((move, index) => {
        const target = move.type === 'swap' ? move.targetMarbleId : ''
        const marble = state.marbleList.find(candidate => candidate.id === target)
        const slot = state.marbleList.filter(candidate => candidate.owner === marble?.owner).findIndex(candidate => candidate.id === target)
        const point = marble ? marbleCenter(marble.owner, marble.position, slot, state.ringSize) : { x: 0, y: 0 }
        return { key: `swap-${index}`, move, cx: point.x, cy: point.y, label: '⇄' }
      })
    }
  } else if (humanTurn && interaction.phase === 'split' && interaction.focusMarbleId) {
    ghostList = splitGhostsForMarble(interaction.draft, interaction.focusMarbleId, state, legalMoves)
  }

  const handleCard = (index: number) => {
    if (!humanTurn) return
    const card = hand[index]
    if (!card || !handIsPlayable(card, legalMoves)) return
    if (isDiscardOnly(card, legalMoves)) {
      const first = movesForCard(card, legalMoves)[0]
      if (first) doCommit(first)
      return
    }
    if (isSplitCard(card, legalMoves)) {
      setInteraction({ phase: 'split', cardIndex: index, draft: startSplit(card), focusMarbleId: null })
      return
    }
    const own = ownSwapMarbleIds(card, legalMoves)[0]
    if (own) {
      setInteraction({ phase: 'swapTarget', cardIndex: index, marbleId: own })
      return
    }
    setInteraction({ phase: 'ghosts', cardIndex: index })
  }

  // Split: tapping a step ghost allocates that part but never auto-commits —
  // the human must explicitly press Play (SplitControls.onPlay) once the
  // budget reaches 0, so the split UI stays visible for review/undo.
  const handleGhost = (key: string) => {
    const ghost = ghostList.find(entry => entry.key === key)
    if (!ghost) return
    if (interaction.phase === 'split') {
      const part = ghost.move.type === 'split7' ? ghost.move.partList[0] : undefined
      if (!part) return
      const draft = allocate(interaction.draft, part)
      setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft, focusMarbleId: null })
      return
    }
    doCommit(ghost.move)
  }

  // Split: tapping a candidate marble focuses it (so its ghosts appear).
  const splitCard = interaction.phase === 'split' ? hand[interaction.cardIndex] : undefined
  const splitCandidates = interaction.phase === 'split' && splitCard ? splitCandidateIds(splitCard, legalMoves) : []

  const prompt = !humanTurn
    ? `${colorOf(state.currentPlayer)} is thinking…`
    : interaction.phase === 'split' ? 'spend the 7' : interaction.phase === 'pickCard' ? 'choose a card' : 'choose where to land'

  const selectedIndex = interaction.phase === 'pickCard' ? -1 : interaction.cardIndex

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <StatusBar turnColor={colorOf(state.currentPlayer)} drawCount={state.drawPile.length} discardCount={state.discardPile.length} prompt={prompt} />
      <GameLog logList={logList} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>
        <Board
          state={state}
          ghostList={ghostList.map(ghost => ({ key: ghost.key, cx: ghost.cx, cy: ghost.cy, label: ghost.label }))}
          onGhost={handleGhost}
        />
      </div>
      {interaction.phase === 'split' && (
        <>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {splitCandidates.map(id => (
              <button
                key={id}
                onClick={() => setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: interaction.draft, focusMarbleId: id })}
              >
                {id}
              </button>
            ))}
          </div>
          <SplitControls
            remaining={splitRemaining(interaction.draft)}
            canPlay={completedSplitMove(interaction.draft, legalMoves) !== undefined}
            onUndo={() => setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: undoLast(interaction.draft), focusMarbleId: null })}
            onPlay={() => {
              const done = completedSplitMove(interaction.draft, legalMoves)
              if (done) doCommit(done)
            }}
          />
        </>
      )}
      <Hand hand={hand} playableList={playableList} selectedIndex={selectedIndex} onSelect={handleCard} />
    </div>
  )
}

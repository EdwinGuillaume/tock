import { useMemo, useState } from 'react'
import type { GameState, MarbleId, Move, PlayerId } from '@tock/core'
import { colorOf, getLegalMoves } from '@tock/core'
import { isHumanSeat } from '../hooks/useBotAutoplay'
import { colorLabel } from '../format'
import { activeHumanSeat } from '../passAndPlay'
import type { Ghost as GhostType } from '../moveSelection'
import { ghostsForCard, handIsPlayable, isDiscardOnly, isSplitCard, movesForCard, ownSwapMarbleIds, swapTargetsFor } from '../moveSelection'
import type { SplitDraft } from '../splitAllocation'
import { allocate, completedSplitMove, splitCandidateIds, splitGhostsForMarble, splitRemaining, startSplit, undoLast } from '../splitAllocation'
import { marbleCenter } from '../svgGeometry'
import type { HintContext } from '../hint'
import { useHint } from '../hooks/useHint'
import { Board } from './Board'
import { Hand } from './Hand'
import { StatusBar } from './StatusBar'
import { GameLog } from './GameLog'
import { SplitControls } from './SplitControls'
import { Hint } from './Hint'

type GameScreenProps = { state: GameState, logList: string[], humanSeatIds: PlayerId[], commitMove: (move: Move) => void }

type Interaction =
  | { phase: 'pickCard' }
  | { phase: 'ghosts', cardIndex: number }
  | { phase: 'swapTarget', cardIndex: number, marbleId: MarbleId | null }
  | { phase: 'split', cardIndex: number, draft: SplitDraft, focusMarbleId: MarbleId | null }

// Bottom space reserved in the board stage for the overlay column (hint chip, and
// the taller split gauge) so it clears the board. The board stays vertically
// centred in the space that remains above this reserved band.
const BOARD_BOTTOM_CLEARANCE = 110

export const GameScreen = ({ state, logList, humanSeatIds, commitMove }: GameScreenProps) => {
  const [interaction, setInteraction] = useState<Interaction>({ phase: 'pickCard' })

  const legalMoves = useMemo(
    () => (isHumanSeat(state, humanSeatIds) && state.winner === null ? getLegalMoves(state, state.currentPlayer) : []),
    [state, humanSeatIds]
  )

  const handSeat = activeHumanSeat(state, humanSeatIds) ?? state.currentPlayer
  const hand = state.playerList.find(player => player.id === handSeat)?.hand ?? []
  const humanTurn = isHumanSeat(state, humanSeatIds)
  const playableList = hand.map(card => humanTurn && handIsPlayable(card, legalMoves))
  const onlyDiscards = humanTurn && legalMoves.length > 0 && legalMoves.every(move => move.type === 'discard')

  const resetInteraction = () => setInteraction({ phase: 'pickCard' })
  const doCommit = (move: Move) => {
    commitMove(move)
    resetInteraction()
  }

  let ghostList: GhostType[] = []
  if (humanTurn && interaction.phase === 'ghosts') {
    const card = hand[interaction.cardIndex]
    if (card) ghostList = ghostsForCard(card, state, legalMoves)
  } else if (humanTurn && interaction.phase === 'swapTarget' && interaction.marbleId !== null) {
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
    const swapSourceList = ownSwapMarbleIds(card, legalMoves)
    if (swapSourceList.length > 0) {
      // With a single swappable marble the choice is unambiguous, so auto-select
      // it; with two or more, leave the source unset to force an explicit pick.
      const onlySource = swapSourceList.length === 1 ? swapSourceList[0] ?? null : null
      setInteraction({ phase: 'swapTarget', cardIndex: index, marbleId: onlySource })
      return
    }
    setInteraction({ phase: 'ghosts', cardIndex: index })
  }

  const handleGhost = (key: string) => {
    const ghost = ghostList.find(entry => entry.key === key)
    if (!ghost) return
    if (interaction.phase === 'split') {
      const part = ghost.move.type === 'split7' ? ghost.move.partList[0] : undefined
      if (!part) return
      setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: allocate(interaction.draft, part), focusMarbleId: null })
      return
    }
    doCommit(ghost.move)
  }

  const splitCard = interaction.phase === 'split' ? hand[interaction.cardIndex] : undefined
  const splitCandidates = interaction.phase === 'split' && splitCard ? splitCandidateIds(splitCard, legalMoves) : []
  const swapCard = interaction.phase === 'swapTarget' ? hand[interaction.cardIndex] : undefined
  const swapSourceIds = interaction.phase === 'swapTarget' && swapCard ? ownSwapMarbleIds(swapCard, legalMoves) : []

  const turnLine = humanTurn ? 'À toi de jouer' : `${colorLabel[colorOf(state.currentPlayer)]} réfléchit…`
  const buildHintContext = (): HintContext => {
    if (!humanTurn) return { kind: 'idle' }
    if (onlyDiscards) return { kind: 'onlyDiscards' }
    switch (interaction.phase) {
      case 'pickCard': return { kind: 'pickCard' }
      case 'swapTarget': return interaction.marbleId === null ? { kind: 'swapSource' } : { kind: 'swapTarget' }
      case 'split': return { kind: 'split', focused: interaction.focusMarbleId !== null, remaining: splitRemaining(interaction.draft) }
      case 'ghosts': {
        const card = hand[interaction.cardIndex]
        return card ? { kind: 'ghosts', card, moves: movesForCard(card, legalMoves) } : { kind: 'pickCard' }
      }
    }
  }
  const hint = useHint(buildHintContext())
  const selectedIndex = interaction.phase === 'pickCard' ? -1 : interaction.cardIndex
  const selectedMarbleId = interaction.phase === 'swapTarget' ? interaction.marbleId : interaction.phase === 'split' ? interaction.focusMarbleId : null

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <StatusBar turnColor={colorOf(state.currentPlayer)} drawCount={state.drawPile.length} discardCount={state.discardPile.length} prompt={turnLine} />
      <GameLog logList={logList} />
      <div data-testid="board-stage" style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', paddingBottom: BOARD_BOTTOM_CLEARANCE }}>
        <Board
          state={state}
          ghostList={ghostList.map(ghost => ({ key: ghost.key, cx: ghost.cx, cy: ghost.cy, label: ghost.label }))}
          onGhost={handleGhost}
          selectedMarbleId={selectedMarbleId}
          selectableMarbleIds={interaction.phase === 'split' ? splitCandidates : interaction.phase === 'swapTarget' ? swapSourceIds : undefined}
          onSelectMarble={interaction.phase === 'split'
            ? (id: MarbleId) => setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: interaction.draft, focusMarbleId: id })
            : interaction.phase === 'swapTarget'
              ? (id: MarbleId) => setInteraction({ phase: 'swapTarget', cardIndex: interaction.cardIndex, marbleId: id })
              : undefined}
        />
        <div data-testid="split-overlay" style={{ position: 'absolute', left: 0, right: 0, bottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
          <Hint text={hint} />
          {interaction.phase === 'split' && (
            <div style={{ pointerEvents: 'auto' }}>
              <SplitControls
                remaining={splitRemaining(interaction.draft)}
                canPlay={completedSplitMove(interaction.draft, legalMoves) !== undefined}
                onUndo={() => setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: undoLast(interaction.draft), focusMarbleId: null })}
                onPlay={() => {
                  const done = completedSplitMove(interaction.draft, legalMoves)
                  if (done) doCommit(done)
                }}
              />
            </div>
          )}
        </div>
      </div>
      <Hand hand={hand} playableList={playableList} selectedIndex={selectedIndex} discardMode={onlyDiscards} onSelect={handleCard} />
    </div>
  )
}

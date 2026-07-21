import type { Card, GameState, MarbleId, Move, PlayerId } from '@tock/core'

export type SelectionEvent = { kind: 'left' | 'right' | 'confirm' | 'back' }

export type SplitPart = { marbleId: MarbleId, steps: number, enterLane?: boolean }

export type Selection =
  | { step: 'pickCard', cardCursor: number }
  | { step: 'pickMarble', card: Card, marbleCursor: number }
  | { step: 'pickDestination', card: Card, marbleId: MarbleId, optionCursor: number }
  | { step: 'pickTarget', card: Card, marbleId: MarbleId, targetCursor: number }
  | {
      step: 'splitAllocation'
      card: Card
      assigned: SplitPart[]
      focusIndex: number
      phase: 'steps' | 'lane'
      draftSteps: number
      draftLane: boolean
    }

export type SplitSelection = Extract<Selection, { step: 'splitAllocation' }>

export type TurnContext = { state: GameState, legalMoves: Move[], human: PlayerId }
export type ReduceResult = { selection: Selection, commit?: Move }

export const initialSelection = (): Selection => ({ step: 'pickCard', cardCursor: 0 })

export const sameCard = (a: Card, b: Card): boolean => a.rank === b.rank && a.suit === b.suit

export const handCards = (ctx: TurnContext): Card[] =>
  ctx.state.playerList.find(player => player.id === ctx.human)?.hand ?? []

const movesForCard = (card: Card, ctx: TurnContext): Move[] =>
  ctx.legalMoves.filter(move => sameCard(move.card, card))

export const playableCard = (card: Card, ctx: TurnContext): boolean =>
  movesForCard(card, ctx).length > 0

// Marbles selectable for this card (exit/move use `marbleId`; Jack uses the own
// marble id). Order-preserving distinct list.
export const marbleChoices = (card: Card, ctx: TurnContext): MarbleId[] => {
  const idList: MarbleId[] = []
  for (const move of movesForCard(card, ctx)) {
    if (move.type === 'exit' || move.type === 'move' || move.type === 'swap' || move.type === 'push') {
      if (!idList.includes(move.marbleId)) idList.push(move.marbleId)
    }
  }
  return idList
}

export const optionMoves = (card: Card, marbleId: MarbleId, ctx: TurnContext): Move[] =>
  movesForCard(card, ctx).filter(move =>
    (move.type === 'exit' || move.type === 'move' || move.type === 'swap' || move.type === 'push') && move.marbleId === marbleId
  )

const splitPartLists = (card: Card, ctx: TurnContext): SplitPart[][] =>
  movesForCard(card, ctx).flatMap(move => (move.type === 'split7' ? [move.partList] : []))

const stepsOf = (partList: SplitPart[], marbleId: MarbleId): number =>
  partList.find(part => part.marbleId === marbleId)?.steps ?? 0

const laneOf = (partList: SplitPart[], marbleId: MarbleId): boolean =>
  partList.find(part => part.marbleId === marbleId)?.enterLane ?? false

// Partitions consistent with everything locked so far.
const compatible = (partListCollection: SplitPart[][], assigned: SplitPart[]): SplitPart[][] =>
  partListCollection.filter(partList =>
    assigned.every(part => stepsOf(partList, part.marbleId) === part.steps && laneOf(partList, part.marbleId) === (part.enterLane ?? false))
  )

// Candidate marbles, in stable first-seen order across all partitions.
export const splitCandidates = (card: Card, ctx: TurnContext): MarbleId[] => {
  const idList: MarbleId[] = []
  for (const partList of splitPartLists(card, ctx)) {
    for (const part of partList) if (!idList.includes(part.marbleId)) idList.push(part.marbleId)
  }
  return idList
}

// A complete legal split7 move consistent with the locked parts and the focused
// marble's current draft. The focused marble's landing is identical across every
// such move, so any match previews it correctly. Undefined while the focused
// draft is 0 (nothing to land yet).
export const projectedSplitMove = (selection: SplitSelection, ctx: TurnContext): Move | undefined => {
  const focusId = splitCandidates(selection.card, ctx)[selection.focusIndex]
  if (focusId === undefined || selection.draftSteps === 0) return undefined
  return movesForCard(selection.card, ctx).find(move => {
    if (move.type !== 'split7') return false
    const lockedOk = selection.assigned.every(part =>
      stepsOf(move.partList, part.marbleId) === part.steps && laneOf(move.partList, part.marbleId) === (part.enterLane ?? false)
    )
    if (!lockedOk) return false
    if (stepsOf(move.partList, focusId) !== selection.draftSteps) return false
    if (selection.phase === 'lane') return laneOf(move.partList, focusId) === selection.draftLane
    return true
  })
}

// Step counts (including 0 = skip) still reachable for `marbleId`, sorted asc.
export const allowedSteps = (card: Card, assigned: SplitPart[], marbleId: MarbleId, ctx: TurnContext): number[] => {
  const live = compatible(splitPartLists(card, ctx), assigned)
  const valueSet = new Set<number>()
  for (const partList of live) valueSet.add(stepsOf(partList, marbleId))
  return [...valueSet].sort((a, b) => a - b)
}

// enterLane values available for (marbleId, steps) given what is locked.
export const laneOptions = (card: Card, assigned: SplitPart[], marbleId: MarbleId, steps: number, ctx: TurnContext): boolean[] => {
  const live = compatible(splitPartLists(card, ctx), assigned).filter(partList => stepsOf(partList, marbleId) === steps)
  const valueSet = new Set<boolean>()
  for (const partList of live) valueSet.add(laneOf(partList, marbleId))
  return [...valueSet].sort((a, b) => Number(a) - Number(b))
}

const firstDraft = (card: Card, assigned: SplitPart[], marbleId: MarbleId, ctx: TurnContext): number => {
  const valueList = allowedSteps(card, assigned, marbleId, ctx).filter(value => value > 0)
  return valueList[0] ?? 0
}

// The completed split7 Move whose partList matches `assigned` (ignoring order and
// zero-step entries). Exactly one matches because each step was validated live.
const completedSplit = (card: Card, assigned: SplitPart[], ctx: TurnContext): Move | undefined =>
  movesForCard(card, ctx).find(move => {
    if (move.type !== 'split7') return false
    const nonZero = assigned.filter(part => part.steps > 0)
    if (move.partList.length !== nonZero.length) return false
    return nonZero.every(part =>
      stepsOf(move.partList, part.marbleId) === part.steps && laneOf(move.partList, part.marbleId) === (part.enterLane ?? false)
    )
  })

// Advance focus to the next candidate that still has a non-zero option, or
// complete if the 7 is fully spent.
const advanceSplit = (card: Card, assigned: SplitPart[], ctx: TurnContext): ReduceResult => {
  const spent = assigned.reduce((sum, part) => sum + part.steps, 0)
  if (spent === 7) {
    const move = completedSplit(card, assigned, ctx)
    if (move) return { selection: initialSelection(), commit: move }
  }
  const candidateList = splitCandidates(card, ctx)
  const assignedIdSet = new Set(assigned.map(part => part.marbleId))
  const nextIndex = candidateList.findIndex(id => !assignedIdSet.has(id))
  if (nextIndex < 0) {
    const move = completedSplit(card, assigned, ctx)
    return move ? { selection: initialSelection(), commit: move } : { selection: initialSelection() }
  }
  const nextId = candidateList[nextIndex] ?? ''
  return {
    selection: {
      step: 'splitAllocation',
      card,
      assigned,
      focusIndex: nextIndex,
      phase: 'steps',
      draftSteps: firstDraft(card, assigned, nextId, ctx),
      draftLane: false
    }
  }
}

const wrap = (cursor: number, length: number): number =>
  length === 0 ? 0 : ((cursor % length) + length) % length

const step = (cursor: number, event: SelectionEvent, length: number): number => {
  if (event.kind === 'left') return wrap(cursor - 1, length)
  if (event.kind === 'right') return wrap(cursor + 1, length)
  return cursor
}

// Enter a card after it is confirmed at pickCard. (Task 6 adds the split7 case.)
const enterCard = (card: Card, ctx: TurnContext): ReduceResult => {
  const moveList = movesForCard(card, ctx)
  if (moveList.length === 0) return { selection: { step: 'pickCard', cardCursor: handCards(ctx).indexOf(card) } }
  const discardOnly = moveList.every(move => move.type === 'discard')
  if (discardOnly) return { selection: initialSelection(), commit: moveList[0] }
  if (moveList.some(move => move.type === 'split7')) return advanceSplit(card, [], ctx)
  return { selection: { step: 'pickMarble', card, marbleCursor: 0 } }
}

// Confirm a chosen marble: commit if single outcome, else branch.
const enterMarble = (card: Card, marbleId: MarbleId, ctx: TurnContext): ReduceResult => {
  const optionList = optionMoves(card, marbleId, ctx)
  if (optionList.length === 0) return { selection: { step: 'pickMarble', card, marbleCursor: 0 } }
  if (optionList.some(move => move.type === 'swap')) {
    return { selection: { step: 'pickTarget', card, marbleId, targetCursor: 0 } }
  }
  if (optionList.length === 1) return { selection: initialSelection(), commit: optionList[0] }
  return { selection: { step: 'pickDestination', card, marbleId, optionCursor: 0 } }
}

export const reduce = (selection: Selection, event: SelectionEvent, ctx: TurnContext): ReduceResult => {
  if (selection.step === 'pickCard') {
    const hand = handCards(ctx)
    if (event.kind === 'back') return { selection }
    if (event.kind === 'confirm') {
      const card = hand[selection.cardCursor]
      if (!card) return { selection }
      return enterCard(card, ctx)
    }
    return { selection: { step: 'pickCard', cardCursor: step(selection.cardCursor, event, hand.length) } }
  }

  if (selection.step === 'pickMarble') {
    const choiceList = marbleChoices(selection.card, ctx)
    if (event.kind === 'back') return { selection: initialSelection() }
    if (event.kind === 'confirm') {
      const marbleId = choiceList[selection.marbleCursor]
      if (!marbleId) return { selection }
      return enterMarble(selection.card, marbleId, ctx)
    }
    return { selection: { ...selection, marbleCursor: step(selection.marbleCursor, event, choiceList.length) } }
  }

  if (selection.step === 'pickDestination') {
    const optionList = optionMoves(selection.card, selection.marbleId, ctx)
    if (event.kind === 'back') return { selection: { step: 'pickMarble', card: selection.card, marbleCursor: 0 } }
    if (event.kind === 'confirm') {
      const move = optionList[selection.optionCursor]
      return move ? { selection: initialSelection(), commit: move } : { selection }
    }
    return { selection: { ...selection, optionCursor: step(selection.optionCursor, event, optionList.length) } }
  }

  if (selection.step === 'splitAllocation') {
    const candidateList = splitCandidates(selection.card, ctx)
    const focusId = candidateList[selection.focusIndex] ?? ''
    if (event.kind === 'back') {
      if (selection.assigned.length === 0) return { selection: initialSelection() }
      const assigned = selection.assigned.slice(0, -1)
      return advanceSplit(selection.card, assigned, ctx)
    }
    if (selection.phase === 'steps') {
      const valueList = allowedSteps(selection.card, selection.assigned, focusId, ctx)
      const index = valueList.indexOf(selection.draftSteps)
      const safeIndex = index < 0 ? 0 : index
      if (event.kind === 'left' || event.kind === 'right') {
        const nextValue = valueList[wrap(safeIndex + (event.kind === 'right' ? 1 : -1), valueList.length)] ?? selection.draftSteps
        return { selection: { ...selection, draftSteps: nextValue } }
      }
      // confirm: lock this marble
      if (selection.draftSteps === 0) {
        return advanceSplit(selection.card, [...selection.assigned, { marbleId: focusId, steps: 0 }], ctx)
      }
      const laneList = laneOptions(selection.card, selection.assigned, focusId, selection.draftSteps, ctx)
      if (laneList.length > 1) {
        return { selection: { ...selection, phase: 'lane', draftLane: laneList[0] ?? false } }
      }
      const enterLane = laneList[0] ?? false
      return advanceSplit(selection.card, [...selection.assigned, { marbleId: focusId, steps: selection.draftSteps, enterLane }], ctx)
    }
    // phase === 'lane'
    if (event.kind === 'left' || event.kind === 'right') {
      return { selection: { ...selection, draftLane: !selection.draftLane } }
    }
    // confirm the lane choice
    return advanceSplit(selection.card, [...selection.assigned, { marbleId: focusId, steps: selection.draftSteps, enterLane: selection.draftLane }], ctx)
  }

  // pickTarget (Jack)
  const targetList = optionMoves(selection.card, selection.marbleId, ctx)
  if (event.kind === 'back') return { selection: { step: 'pickMarble', card: selection.card, marbleCursor: 0 } }
  if (event.kind === 'confirm') {
    const move = targetList[selection.targetCursor]
    return move ? { selection: initialSelection(), commit: move } : { selection }
  }
  return { selection: { ...selection, targetCursor: step(selection.targetCursor, event, targetList.length) } }
}

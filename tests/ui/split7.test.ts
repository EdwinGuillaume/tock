import { describe, expect, test } from 'vitest'
import { createGame, getLegalMoves } from '../../src/engine'
import type { GameState, Move } from '../../src/engine'
import { allowedSteps, initialSelection, laneOptions, projectedSplitMove, reduce, splitCandidates } from '../../src/ui/selection'
import type { SelectionEvent, TurnContext } from '../../src/ui/selection'
import { card, place, setHand } from '../support'

const contextFor = (state: GameState): TurnContext => ({
  state,
  legalMoves: getLegalMoves(state, state.currentPlayer),
  human: state.currentPlayer
})

const drive = (state: GameState, events: SelectionEvent[]) => {
  const ctx = contextFor(state)
  let selection = initialSelection()
  let commit: Move | undefined
  for (const event of events) {
    const result = reduce(selection, event, ctx)
    selection = result.selection
    commit = result.commit ?? commit
  }
  return { selection, commit, ctx }
}

describe('selection — split 7', () => {
  test('all seven on one marble commits a single-part split7', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = setHand(state, 0, [card('7')])
    // confirm the 7 -> splitAllocation; the single moveable marble can take 7.
    const { selection } = drive(state, [{ kind: 'confirm' }])
    expect(selection.step).toBe('splitAllocation')
    // set draftSteps to the max (7) then lock -> completes and commits.
    const ctx = contextFor(state)
    const seven = allowedSteps(card('7'), [], 'p0m0', ctx)
    expect(seven).toContain(7)
    // Cycle right until draftSteps === 7, then confirm.
    let sel = drive(state, [{ kind: 'confirm' }]).selection
    let commit: Move | undefined
    for (let guard = 0; guard < 20; guard++) {
      const draft = sel.step === 'splitAllocation' ? sel.draftSteps : -1
      if (draft === 7) break
      sel = reduce(sel, { kind: 'right' }, ctx).selection
    }
    const done = reduce(sel, { kind: 'confirm' }, ctx)
    commit = done.commit
    expect(commit?.type).toBe('split7')
    expect(getLegalMoves(state, 0)).toContainEqual(commit)
  })

  test('a 4+3 split across two marbles commits a two-part split7', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = place(state, 'p0m1', { zone: 'track', index: 20 })
    state = setHand(state, 0, [card('7')])
    const ctx = contextFor(state)
    // Confirm the 7, then for the first candidate marble pick 4, lock; second marble takes the remaining 3, lock.
    let sel = reduce(initialSelection(), { kind: 'confirm' }, ctx).selection
    // set first marble to 4
    for (let guard = 0; guard < 20; guard++) {
      if (sel.step === 'splitAllocation' && sel.draftSteps === 4) break
      sel = reduce(sel, { kind: 'right' }, ctx).selection
    }
    const afterFirst = reduce(sel, { kind: 'confirm' }, ctx)
    sel = afterFirst.selection
    // now second marble focused; set to 3
    for (let guard = 0; guard < 20; guard++) {
      if (sel.step === 'splitAllocation' && sel.draftSteps === 3) break
      sel = reduce(sel, { kind: 'right' }, ctx).selection
    }
    const done = reduce(sel, { kind: 'confirm' }, ctx)
    expect(done.commit?.type).toBe('split7')
    if (done.commit?.type === 'split7') {
      const total = done.commit.partList.reduce((sum, part) => sum + part.steps, 0)
      expect(total).toBe(7)
      expect(getLegalMoves(state, 0)).toContainEqual(done.commit)
    }
  })

  test('allowedSteps never offers a value with no legal completion', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = setHand(state, 0, [card('7')])
    const ctx = contextFor(state)
    const values = allowedSteps(card('7'), [], 'p0m0', ctx)
    // Every offered value must appear as this marble's step count in some legal partition.
    const partitions = getLegalMoves(state, 0)
      .filter(move => move.type === 'split7')
      .map(move => (move.type === 'split7' ? move.partList : []))
    for (const value of values) {
      const ok = partitions.some(partList => {
        const part = partList.find(entry => entry.marbleId === 'p0m0')
        return (part?.steps ?? 0) === value
      })
      expect(ok).toBe(true)
    }
  })

  test('back unwinds a locked assignment; back from the first allocation returns to pickCard', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = place(state, 'p0m1', { zone: 'track', index: 20 })
    state = setHand(state, 0, [card('7')])
    const ctx = contextFor(state)

    // back from the very first allocation state (nothing locked yet) goes to pickCard.
    const firstAlloc = reduce(initialSelection(), { kind: 'confirm' }, ctx).selection
    const backFromFirst = reduce(firstAlloc, { kind: 'back' }, ctx)
    expect(backFromFirst.selection.step).toBe('pickCard')

    // Lock the first candidate marble at 4 steps.
    let sel = firstAlloc
    for (let guard = 0; guard < 20; guard++) {
      const draft = sel.step === 'splitAllocation' ? sel.draftSteps : -1
      if (draft === 4) break
      sel = reduce(sel, { kind: 'right' }, ctx).selection
    }
    const locked = reduce(sel, { kind: 'confirm' }, ctx)
    expect(locked.selection.step).toBe('splitAllocation')
    if (locked.selection.step === 'splitAllocation') {
      expect(locked.selection.assigned).toEqual([{ marbleId: 'p0m0', steps: 4, enterLane: false }])
      expect(locked.selection.focusIndex).toBe(1)
    }

    // `back` unwinds that lock: the assignment is removed and focus returns to the first marble.
    const unwound = reduce(locked.selection, { kind: 'back' }, ctx)
    expect(unwound.commit).toBeUndefined()
    expect(unwound.selection.step).toBe('splitAllocation')
    if (unwound.selection.step === 'splitAllocation') {
      expect(unwound.selection.assigned).toEqual([])
      expect(unwound.selection.focusIndex).toBe(0)
    }
  })

  test('a lane-mouth crossing offers both stay-on-ring and enter-lane for the same steps', () => {
    let state = createGame(['human', 'bot'])
    // p0m0 sits 3 steps from its own lane mouth: a 4-step part can either stay on
    // the ring or cross into the finish lane -- both are legal split7 outcomes.
    state = place(state, 'p0m0', { zone: 'track', index: 44 })
    state = place(state, 'p0m1', { zone: 'track', index: 20 })
    state = setHand(state, 0, [card('7')])
    const ctx = contextFor(state)

    const lanes = laneOptions(card('7'), [], 'p0m0', 4, ctx)
    expect(lanes).toEqual([false, true])

    let sel = reduce(initialSelection(), { kind: 'confirm' }, ctx).selection
    for (let guard = 0; guard < 20; guard++) {
      const draft = sel.step === 'splitAllocation' ? sel.draftSteps : -1
      if (draft === 4) break
      sel = reduce(sel, { kind: 'right' }, ctx).selection
    }
    const afterLock = reduce(sel, { kind: 'confirm' }, ctx)
    expect(afterLock.selection.step).toBe('splitAllocation')
    if (afterLock.selection.step === 'splitAllocation') {
      expect(afterLock.selection.phase).toBe('lane')
    }

    // toggle the draft lane choice, then confirm to enter the lane.
    const toggled = reduce(afterLock.selection, { kind: 'left' }, ctx)
    if (toggled.selection.step === 'splitAllocation') {
      expect(toggled.selection.draftLane).toBe(true)
    }
    const laneConfirmed = reduce(toggled.selection, { kind: 'confirm' }, ctx)
    if (laneConfirmed.selection.step === 'splitAllocation') {
      expect(laneConfirmed.selection.assigned).toContainEqual({ marbleId: 'p0m0', steps: 4, enterLane: true })
    }

    // lock the remaining marble to complete the split.
    const done = reduce(laneConfirmed.selection, { kind: 'confirm' }, ctx)
    expect(done.commit?.type).toBe('split7')
    if (done.commit?.type === 'split7') {
      expect(getLegalMoves(state, 0)).toContainEqual(done.commit)
      const part = done.commit.partList.find(entry => entry.marbleId === 'p0m0')
      expect(part?.enterLane).toBe(true)
    }
  })

  test('a steps:0 skip advances past a marble with no assignment and still completes a valid split7', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p0m1', { zone: 'track', index: 20 })
    state = place(state, 'p0m2', { zone: 'track', index: 30 })
    state = setHand(state, 0, [card('7')])
    const ctx = contextFor(state)

    const values = allowedSteps(card('7'), [], 'p0m0', ctx)
    expect(values).toContain(0)

    // cycle the first candidate's draft to 0 (skip) and confirm.
    let sel = reduce(initialSelection(), { kind: 'confirm' }, ctx).selection
    for (let guard = 0; guard < 20; guard++) {
      const draft = sel.step === 'splitAllocation' ? sel.draftSteps : -1
      if (draft === 0) break
      sel = reduce(sel, { kind: 'left' }, ctx).selection
    }
    const draftBeforeSkip = sel.step === 'splitAllocation' ? sel.draftSteps : -1
    expect(draftBeforeSkip).toBe(0)

    const afterSkip = reduce(sel, { kind: 'confirm' }, ctx)
    expect(afterSkip.commit).toBeUndefined()
    expect(afterSkip.selection.step).toBe('splitAllocation')
    if (afterSkip.selection.step === 'splitAllocation') {
      expect(afterSkip.selection.assigned).toContainEqual({ marbleId: 'p0m0', steps: 0 })
      expect(afterSkip.selection.focusIndex).toBe(1)
    }

    // lock the second marble at 4, letting the third complete the remaining 3.
    let sel2 = afterSkip.selection
    for (let guard = 0; guard < 20; guard++) {
      const draft = sel2.step === 'splitAllocation' ? sel2.draftSteps : -1
      if (draft === 4) break
      sel2 = reduce(sel2, { kind: 'right' }, ctx).selection
    }
    const afterSecond = reduce(sel2, { kind: 'confirm' }, ctx)
    const done = reduce(afterSecond.selection, { kind: 'confirm' }, ctx)
    expect(done.commit?.type).toBe('split7')
    if (done.commit?.type === 'split7') {
      const total = done.commit.partList.reduce((sum, part) => sum + part.steps, 0)
      expect(total).toBe(7)
      expect(getLegalMoves(state, 0)).toContainEqual(done.commit)
      expect(done.commit.partList.some(part => part.marbleId === 'p0m0')).toBe(false)
    }
  })

  test('projectedSplitMove yields a legal split7 carrying the focused draft', () => {
    let state = createGame(['human', 'bot'])
    state = place(state, 'p0m0', { zone: 'track', index: 0 })
    state = place(state, 'p0m1', { zone: 'track', index: 20 })
    state = setHand(state, 0, [card('7')])
    const ctx = contextFor(state)
    const selection = reduce(initialSelection(), { kind: 'confirm' }, ctx).selection
    if (selection.step !== 'splitAllocation') throw new Error('expected splitAllocation')

    const move = projectedSplitMove(selection, ctx)
    expect(move?.type).toBe('split7')
    expect(getLegalMoves(state, 0)).toContainEqual(move)
    if (move?.type !== 'split7') throw new Error('expected split7')
    const focusId = splitCandidates(selection.card, ctx)[selection.focusIndex]
    expect(move.partList.find(part => part.marbleId === focusId)?.steps).toBe(selection.draftSteps)
  })
})

import { describe, expect, it } from 'vitest'
import type { Move } from '@tock/core'
import { createGame, getLegalMoves } from '@tock/core'
import {
  allocate,
  completedSplitMove,
  splitGhostsForMarble,
  splitRemaining,
  startSplit,
  undoLast
} from '../src/splitAllocation'
import { card, place, setHand } from './support'

const sevenOfHearts = { rank: '7', suit: 'hearts' } as const

// A minimal legal-move set standing in for getLegalMoves on a split turn:
// one marble can go 3 or 7, another can go 4 (3+4 and 7+0 are the partitions).
const legalMoves: Move[] = [
  { type: 'split7', card: sevenOfHearts, partList: [{ marbleId: 'p0m0', steps: 7 }] },
  { type: 'split7', card: sevenOfHearts, partList: [{ marbleId: 'p0m0', steps: 3 }, { marbleId: 'p0m1', steps: 4 }] }
]

describe('splitAllocation', () => {
  it('starts with the full budget of 7', () => {
    expect(splitRemaining(startSplit(sevenOfHearts))).toBe(7)
  })

  it('decrements the budget as parts are allocated', () => {
    const draft = allocate(startSplit(sevenOfHearts), { marbleId: 'p0m0', steps: 3 })
    expect(splitRemaining(draft)).toBe(4)
  })

  it('undo restores the previous budget', () => {
    const draft = allocate(startSplit(sevenOfHearts), { marbleId: 'p0m0', steps: 3 })
    expect(splitRemaining(undoLast(draft))).toBe(7)
  })

  it('yields no completed move until the budget hits 0', () => {
    const draft = allocate(startSplit(sevenOfHearts), { marbleId: 'p0m0', steps: 3 })
    expect(completedSplitMove(draft, legalMoves)).toBeUndefined()
  })

  it('resolves to the matching split7 move at 0 remaining', () => {
    const draft = allocate(
      allocate(startSplit(sevenOfHearts), { marbleId: 'p0m0', steps: 3 }),
      { marbleId: 'p0m1', steps: 4 }
    )
    expect(splitRemaining(draft)).toBe(0)
    const move = completedSplitMove(draft, legalMoves)
    expect(move?.type).toBe('split7')
    expect(move?.type === 'split7' && move.partList).toHaveLength(2)
  })

  it('resolves a single-marble full 7', () => {
    const draft = allocate(startSplit(sevenOfHearts), { marbleId: 'p0m0', steps: 7 })
    expect(completedSplitMove(draft, legalMoves)?.type).toBe('split7')
  })

  it('previews a marble whose landing is only freed by another marble moving first, without throwing', () => {
    // p0m0 at 10, p0m1 at 13. The split [p0m0:3, p0m1:4] is legal only when
    // p0m1 (13->17) moves before p0m0 (10->13) — the engine orders it so. A
    // preview of p0m0:3 in ISOLATION lands on the still-present p0m1 and the
    // engine rejects it, which used to crash the UI ("illegal split part").
    const state = setHand(
      place(
        place(createGame(['human', 'bot'], 48), 'p0m0', { zone: 'track', index: 10 }),
        'p0m1',
        { zone: 'track', index: 13 }
      ),
      0,
      [card('7', 'clubs')]
    )
    const legal = getLegalMoves(state, 0)
    expect(() =>
      splitGhostsForMarble(startSplit(card('7', 'clubs')), 'p0m0', state, legal)
    ).not.toThrow()
    const ghostList = splitGhostsForMarble(startSplit(card('7', 'clubs')), 'p0m0', state, legal)
    // p0m0 can take 1,2,3,4,6 (paired with p0m1 taking the rest) or the full 7.
    // 5 is impossible: p0m0:5 (->15) would pair only with p0m1:2 (->15) — a
    // collision on cell 15 — so no legal partition gives p0m0 exactly 5.
    expect(ghostList.map(ghost => ghost.move.type === 'split7' && ghost.move.partList[0]?.steps).sort((a, b) => Number(a) - Number(b)))
      .toEqual([1, 2, 3, 4, 6, 7])
  })

  it('splitGhostsForMarble reports the one reachable ring landing for a marble mid-ring on a real state', () => {
    const state = setHand(
      place(createGame(['human', 'bot'], 48), 'p0m0', { zone: 'track', index: 10 }),
      0,
      [card('7', 'clubs')]
    )
    const legal = getLegalMoves(state, 0)
    const ghostList = splitGhostsForMarble(startSplit(card('7', 'clubs')), 'p0m0', state, legal)

    // Only p0m0 is out of home, so enumerateSplits can only assign the full 7
    // to it (a single marble cannot be split across two parts), and from index
    // 10 a 7-step advance (to index 17) does not cross the lane mouth (47) —
    // so exactly one ring landing is reachable.
    expect(ghostList).toHaveLength(1)
    const [ghost] = ghostList
    expect(typeof ghost?.cx).toBe('number')
    expect(typeof ghost?.cy).toBe('number')
    expect(ghost?.move.type).toBe('split7')
    expect(ghost?.move.type === 'split7' && ghost.move.partList).toEqual([{ marbleId: 'p0m0', steps: 7, enterLane: false }])
  })
})

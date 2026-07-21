import { describe, it, expect } from 'vitest'
import { scoreMove, WEIGHTS, cardKeepValue } from '../../src/ai/score'
import { createGame } from '../../src/engine'
import { place, setHand, card } from '../../tests/support'
import type { GameState, Move, Rank } from '../../src/engine'

const game = (): GameState => createGame(['bot', 'bot', 'bot', 'bot'], 48, () => 0)
// game().currentPlayer is 0 (first active seat), so scoreMove evaluates for player 0.

describe('scoreMove', () => {
  it('scores a capturing move above the same move without a capture', () => {
    const base = setHand(place(game(), 'p0m0', { zone: 'track', index: 0 }), 0, [card('6')])
    const move: Move = { type: 'move', card: card('6'), marbleId: 'p0m0', steps: 6 }
    const withCapture = place(base, 'p1m0', { zone: 'track', index: 6 })
    const noCapture = place(base, 'p1m0', { zone: 'track', index: 20 })
    expect(scoreMove(withCapture, move)).toBeGreaterThan(scoreMove(noCapture, move))
  })

  it('scores entering the finish above looping past the mouth on the ring', () => {
    // player 0 mouth is index 47; from index 45 a 3 either enters finish[0]
    // (enterLane) or lands back on the ring at index 0 (a pointless second lap)
    const state = setHand(place(game(), 'p0m0', { zone: 'track', index: 45 }), 0, [card('3')])
    const enter: Move = { type: 'move', card: card('3'), marbleId: 'p0m0', steps: 3, enterLane: true }
    const stay: Move = { type: 'move', card: card('3'), marbleId: 'p0m0', steps: 3 }
    expect(scoreMove(state, enter)).toBeGreaterThan(scoreMove(state, stay))
  })

  it('adds exactly the finish bonus when a marble enters the lane, isolated from advancement', () => {
    // Both moves advance the marble by exactly 4 in the advancement scalar and
    // change nothing else (no capture, no exit, no exposure), so the score gap
    // is purely the finish bonus. From index 44 a 4 enters finish[0]; from
    // index 5 a 4 lands on the ring at index 9 without entering a lane.
    const enterState = setHand(place(game(), 'p0m0', { zone: 'track', index: 44 }), 0, [card('4')])
    const enterMove: Move = { type: 'move', card: card('4'), marbleId: 'p0m0', steps: 4, enterLane: true }
    const ringState = setHand(place(game(), 'p0m0', { zone: 'track', index: 5 }), 0, [card('4')])
    const ringMove: Move = { type: 'move', card: card('4'), marbleId: 'p0m0', steps: 4 }
    expect(scoreMove(enterState, enterMove) - scoreMove(ringState, ringMove)).toBe(WEIGHTS.finish)
  })

  it('penalises a landing that ends exposed in front of an opponent', () => {
    const base = setHand(place(game(), 'p0m0', { zone: 'track', index: 10 }), 0, [card('2')])
    const move: Move = { type: 'move', card: card('2'), marbleId: 'p0m0', steps: 2 } // -> index 12
    const exposed = place(base, 'p1m1', { zone: 'track', index: 11 }) // one cell behind the landing
    const safe = place(base, 'p1m1', { zone: 'track', index: 30 })
    expect(scoreMove(safe, move)).toBeGreaterThan(scoreMove(exposed, move))
  })

  it('rewards exiting more when more marbles are still in the nest', () => {
    const exitMove: Move = { type: 'exit', card: card('A'), marbleId: 'p0m0' }
    const allHome = setHand(game(), 0, [card('A')])
    const fewHome = setHand(
      ['p0m1', 'p0m2', 'p0m3'].reduce(
        (state, id, offset) => place(state, id, { zone: 'track', index: 20 + offset * 2 }),
        game()
      ),
      0,
      [card('A')]
    )
    expect(scoreMove(allHome, exitMove)).toBeGreaterThan(scoreMove(fewHome, exitMove))
  })

  it('gives a plain forward move a positive score', () => {
    const state = setHand(place(game(), 'p0m0', { zone: 'track', index: 5 }), 0, [card('3')])
    const move: Move = { type: 'move', card: card('3'), marbleId: 'p0m0', steps: 3 }
    expect(scoreMove(state, move)).toBeGreaterThan(0)
  })

  it('scores a discard at zero on a safe board', () => {
    const state = setHand(game(), 0, [card('4')]) // all marbles still home -> no exposure
    const move: Move = { type: 'discard', card: card('4') }
    expect(scoreMove(state, move)).toBe(0)
  })

  it('sums advancement across both marbles moved by a split7', () => {
    // 7 split as 3 (p0m0: 5->8) + 4 (p0m1: 20->24); both plain forward, no
    // capture/finish/exposure, so the score is the summed advancement (+7).
    const state = setHand(
      place(place(game(), 'p0m0', { zone: 'track', index: 5 }), 'p0m1', { zone: 'track', index: 20 }),
      0,
      [card('7')]
    )
    const move: Move = {
      type: 'split7',
      card: card('7'),
      partList: [{ marbleId: 'p0m0', steps: 3 }, { marbleId: 'p0m1', steps: 4 }]
    }
    expect(scoreMove(state, move)).toBe(WEIGHTS.progress * 7)
  })

  it('adds the capture bonus when a split7 part lands on an opponent', () => {
    // p0m0 +3 (5->8) captures p1m0 at 8; p0m1 +4 (20->24). delta +7, one capture.
    const state = setHand(
      place(
        place(place(game(), 'p0m0', { zone: 'track', index: 5 }), 'p0m1', { zone: 'track', index: 20 }),
        'p1m0',
        { zone: 'track', index: 8 }
      ),
      0,
      [card('7')]
    )
    const move: Move = {
      type: 'split7',
      card: card('7'),
      partList: [{ marbleId: 'p0m0', steps: 3 }, { marbleId: 'p0m1', steps: 4 }]
    }
    expect(scoreMove(state, move)).toBe(WEIGHTS.progress * 7 + WEIGHTS.capture)
  })

  it('scores a swap that moves an own marble forward as positive advancement', () => {
    // swap p0m0 (index 5) with enemy p1m0 (index 30): p0m0 -> 30 (+25), no capture.
    const state = setHand(
      place(place(game(), 'p0m0', { zone: 'track', index: 5 }), 'p1m0', { zone: 'track', index: 30 }),
      0,
      [card('J')]
    )
    const move: Move = { type: 'swap', card: card('J'), marbleId: 'p0m0', targetMarbleId: 'p1m0' }
    expect(scoreMove(state, move)).toBe(WEIGHTS.progress * 25)
  })

  it('scores a swap that moves an own marble backward as negative advancement, with no capture', () => {
    // swap p0m0 (index 30) with enemy p1m0 (index 5): p0m0 -> 5 (-25); swap never
    // sends a marble home, so captured stays 0 (no capture bonus polluting the score).
    const state = setHand(
      place(place(game(), 'p0m0', { zone: 'track', index: 30 }), 'p1m0', { zone: 'track', index: 5 }),
      0,
      [card('J')]
    )
    const move: Move = { type: 'swap', card: card('J'), marbleId: 'p0m0', targetMarbleId: 'p1m0' }
    expect(scoreMove(state, move)).toBe(WEIGHTS.progress * -25)
  })

  it('capturing a threatening opponent beats an equivalent move that leaves it on the board', () => {
    // p0m1 sits at 20; an opponent behind it threatens it. p0m0 (at 10, card 6)
    // lands on 16. Capturing the opponent (at 16) removes the threat AND earns the
    // capture bonus; the no-capture arm (opponent at 17) keeps p0m1 exposed.
    const captureState = setHand(
      place(
        place(place(game(), 'p0m0', { zone: 'track', index: 10 }), 'p0m1', { zone: 'track', index: 20 }),
        'p1m0',
        { zone: 'track', index: 16 }
      ),
      0,
      [card('6')]
    )
    const noCaptureState = setHand(
      place(
        place(place(game(), 'p0m0', { zone: 'track', index: 10 }), 'p0m1', { zone: 'track', index: 20 }),
        'p1m0',
        { zone: 'track', index: 17 }
      ),
      0,
      [card('6')]
    )
    const move: Move = { type: 'move', card: card('6'), marbleId: 'p0m0', steps: 6 }
    expect(scoreMove(captureState, move)).toBeGreaterThan(scoreMove(noCaptureState, move))
  })

  it('counts a capture made by exiting onto an occupied start square', () => {
    // p1m0 sits on player 0's start (index 0); exiting p0m0 lands there and captures
    // it. All four p0 marbles are home before the move -> exit urgency 4.
    const state = setHand(place(game(), 'p1m0', { zone: 'track', index: 0 }), 0, [card('A')])
    const move: Move = { type: 'exit', card: card('A'), marbleId: 'p0m0' }
    expect(scoreMove(state, move)).toBe(WEIGHTS.progress * 1 + WEIGHTS.capture + WEIGHTS.exit * 4)
  })

  it('scores a push that merely advances an opponent below a discard', () => {
    // bot 0 has no marbles on the ring (no exposure); pushing p1m0 forward 5
    // only helps the opponent -> negative score, below a do-nothing discard.
    const state = setHand(place(game(), 'p1m0', { zone: 'track', index: 20 }), 0, [card('5')])
    const push: Move = { type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 }
    const discard: Move = { type: 'discard', card: card('5') }
    expect(scoreMove(state, push)).toBeLessThan(scoreMove(state, discard))
  })

  it('scores a push that captures a third player above a discard', () => {
    // pushing p1m0 (20 -> 25) lands on p2m0 (25): capture bonus dominates.
    const state = setHand(
      place(place(game(), 'p1m0', { zone: 'track', index: 20 }), 'p2m0', { zone: 'track', index: 25 }),
      0,
      [card('5')]
    )
    const push: Move = { type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 }
    const discard: Move = { type: 'discard', card: card('5') }
    expect(scoreMove(state, push)).toBeGreaterThan(scoreMove(state, discard))
  })

  it('scores a push that forces an opponent past its own mouth above a discard', () => {
    // p1m0 at 8 is near its mouth (11) / start (12): advancement ~45. Pushing it
    // to 13 drops advancement to ~2 (a wrap-past-start overshoot) -> big bonus.
    const state = setHand(place(game(), 'p1m0', { zone: 'track', index: 8 }), 0, [card('5')])
    const push: Move = { type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 }
    const discard: Move = { type: 'discard', card: card('5') }
    expect(scoreMove(state, push)).toBeGreaterThan(scoreMove(state, discard))
  })

  it('never touches Math.random, even when the simulated move triggers a reshuffle', () => {
    let state = place(game(), 'p0m0', { zone: 'track', index: 3 })
    state = setHand(state, 0, [card('6')])
    state = { ...state, drawPile: [], discardPile: [card('2'), card('3')] }
    const move: Move = { type: 'move', card: card('6'), marbleId: 'p0m0', steps: 6 }
    const realRandom = Math.random
    Math.random = () => { throw new Error('Math.random must not be called') }
    try {
      expect(typeof scoreMove(state, move)).toBe('number')
    } finally {
      Math.random = realRandom
    }
  })
})

describe('cardKeepValue', () => {
  it('ranks the cards from most to least worth keeping, all distinct', () => {
    const orderedFromKeep: Rank[] = ['4', '7', 'J', 'A', 'K', '5', 'Q', '10', '9', '8', '6', '3', '2']
    const valueList = orderedFromKeep.map(cardKeepValue)
    const descending = [...valueList].sort((left, right) => right - left)
    expect(valueList).toEqual(descending)
    expect(new Set(valueList).size).toBe(valueList.length)
  })

  it('makes the 4 the most valuable and the 2 the least', () => {
    const allRank: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
    const valueList = allRank.map(cardKeepValue)
    expect(cardKeepValue('4')).toBe(Math.max(...valueList))
    expect(cardKeepValue('2')).toBe(Math.min(...valueList))
  })
})

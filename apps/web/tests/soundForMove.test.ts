import { describe, expect, it } from 'vitest'
import type { GameState, Move } from '@tock/core'
import { soundForMove, soundsForCommit } from '../src/audio/soundForMove'

const empty = { marbleList: [], winner: null } as unknown as GameState

describe('soundForMove', () => {
  it('maps a move type to its SoundId', () => {
    expect(soundForMove(empty, empty, { type: 'exit' } as Move)).toEqual(['exit'])
    expect(soundForMove(empty, empty, { type: 'push' } as Move)).toEqual(['push'])
  })

  it('appends capture when a marble returned home', () => {
    const before = { marbleList: [{ id: 'p1-0', owner: 1, position: { zone: 'ring' } }], winner: null } as unknown as GameState
    const after = { marbleList: [{ id: 'p1-0', owner: 1, position: { zone: 'home' } }], winner: null } as unknown as GameState
    expect(soundForMove(before, after, { type: 'move' } as Move)).toEqual(['move', 'capture'])
  })

  it('appends win when the game is won', () => {
    const after = { marbleList: [], winner: 0 } as unknown as GameState
    expect(soundForMove(empty, after, { type: 'move' } as Move)).toEqual(['move', 'win'])
  })

  it('plays laneEntry instead of move when a marble crosses into the finish lane', () => {
    const before = { marbleList: [{ id: 'p0-0', owner: 0, position: { zone: 'ring' } }], winner: null } as unknown as GameState
    const after = { marbleList: [{ id: 'p0-0', owner: 0, position: { zone: 'finish', index: 0 } }], winner: null } as unknown as GameState
    expect(soundForMove(before, after, { type: 'move' } as Move)).toEqual(['laneEntry'])
  })

  it('layers laneEntry over split7 when a 7-split part enters the lane', () => {
    const before = { marbleList: [{ id: 'p0-0', owner: 0, position: { zone: 'ring' } }], winner: null } as unknown as GameState
    const after = { marbleList: [{ id: 'p0-0', owner: 0, position: { zone: 'finish', index: 0 } }], winner: null } as unknown as GameState
    expect(soundForMove(before, after, { type: 'split7' } as Move)).toEqual(['split7', 'laneEntry'])
  })

  it('keeps move for an advance within the lane (no re-trigger)', () => {
    const before = { marbleList: [{ id: 'p0-0', owner: 0, position: { zone: 'finish', index: 0 } }], winner: null } as unknown as GameState
    const after = { marbleList: [{ id: 'p0-0', owner: 0, position: { zone: 'finish', index: 1 } }], winner: null } as unknown as GameState
    expect(soundForMove(before, after, { type: 'move' } as Move)).toEqual(['move'])
  })
})

describe('soundsForCommit', () => {
  it('adds draw when the mover is human', () => {
    expect(soundsForCommit(empty, empty, { type: 'move' } as Move, true)).toEqual(['move', 'draw'])
  })

  it('omits draw when the mover is a bot', () => {
    expect(soundsForCommit(empty, empty, { type: 'move' } as Move, false)).toEqual(['move'])
  })
})

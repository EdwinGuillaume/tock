import { describe, expect, it } from 'vitest'
import type { GameState } from '@tock/core'
import { colorOf } from '@tock/core'
import { capturedColorList } from '../src/audio/gameEvents'

describe('capturedColorList', () => {
  it('lists the colour of a marble that went from off-home to home', () => {
    const before = { marbleList: [{ id: 'p1-0', owner: 1, position: { zone: 'ring' } }] } as unknown as GameState
    const after = { marbleList: [{ id: 'p1-0', owner: 1, position: { zone: 'home' } }] } as unknown as GameState
    expect(capturedColorList(before, after)).toEqual([colorOf(1)])
  })

  it('is empty when nothing returned home', () => {
    const before = { marbleList: [{ id: 'p1-0', owner: 1, position: { zone: 'ring' } }] } as unknown as GameState
    const after = { marbleList: [{ id: 'p1-0', owner: 1, position: { zone: 'ring' } }] } as unknown as GameState
    expect(capturedColorList(before, after)).toEqual([])
  })

  it('ignores marbles already home before the move', () => {
    const before = { marbleList: [{ id: 'p2-0', owner: 2, position: { zone: 'home' } }] } as unknown as GameState
    const after = { marbleList: [{ id: 'p2-0', owner: 2, position: { zone: 'home' } }] } as unknown as GameState
    expect(capturedColorList(before, after)).toEqual([])
  })
})

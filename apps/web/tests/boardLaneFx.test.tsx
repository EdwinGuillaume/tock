import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameState } from '@tock/core'
import { createGame } from '@tock/core'
import { Board } from '../src/components/Board'
import { place } from './support'

const setMatch = (matches: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {} }))

afterEach(() => vi.unstubAllGlobals())

const base = createGame(['human', 'bot'], 48)
const onTrack: GameState = place(base, 'p0m0', { zone: 'track', index: 10 })
const inFinish: GameState = place(onTrack, 'p0m0', { zone: 'finish', index: 0 })
const noop = () => {}

describe('Board finish-lane effect', () => {
  it('mounts a lane-fx overlay when a marble enters its finish lane', () => {
    const view = render(<Board state={onTrack} ghostList={[]} onGhost={noop} />)
    expect(view.queryByTestId('lane-fx-0-0')).toBeNull()
    act(() => { view.rerender(<Board state={inFinish} ghostList={[]} onGhost={noop} />) })
    expect(view.queryByTestId('lane-fx-0-0')).not.toBeNull()
  })

  it('mounts nothing under prefers-reduced-motion', () => {
    setMatch(true)
    const view = render(<Board state={onTrack} ghostList={[]} onGhost={noop} />)
    act(() => { view.rerender(<Board state={inFinish} ghostList={[]} onGhost={noop} />) })
    expect(view.queryByTestId('lane-fx-0-0')).toBeNull()
  })
})

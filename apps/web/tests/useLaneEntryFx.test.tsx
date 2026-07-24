import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameState } from '@tock/core'
import { createGame } from '@tock/core'
import { useLaneEntryFx } from '../src/hooks/useLaneEntryFx'
import { place } from './support'

const setMatch = (matches: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {} }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const base = createGame(['human', 'bot'], 48)
const onTrack: GameState = place(base, 'p0m0', { zone: 'track', index: 10 })
const inFinish: GameState = place(onTrack, 'p0m0', { zone: 'finish', index: 0 })

describe('useLaneEntryFx', () => {
  it('surfaces an active entry on lane crossing, then clears it after the lifetime', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ state }: { state: GameState }) => useLaneEntryFx(state),
      { initialProps: { state: onTrack } }
    )
    expect(result.current).toHaveLength(0)
    act(() => rerender({ state: inFinish }))
    expect(result.current).toHaveLength(1)
    expect(result.current[0]!).toMatchObject({ owner: 0, finishIndex: 0 })
    act(() => { vi.advanceTimersByTime(1600) })
    expect(result.current).toHaveLength(0)
  })

  it('yields nothing under prefers-reduced-motion', () => {
    setMatch(true)
    const { result, rerender } = renderHook(
      ({ state }: { state: GameState }) => useLaneEntryFx(state),
      { initialProps: { state: onTrack } }
    )
    act(() => rerender({ state: inFinish }))
    expect(result.current).toHaveLength(0)
  })
})

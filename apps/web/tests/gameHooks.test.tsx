import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GameState } from '@tock/core'
import { createGame, getLegalMoves } from '@tock/core'
import { useTockGame } from '../src/hooks/useTockGame'
import { isHumanSeat, useBotAutoplay } from '../src/hooks/useBotAutoplay'

describe('useTockGame', () => {
  it('starts a game and exposes state', () => {
    const { result } = renderHook(() => useTockGame())
    expect(result.current.state).toBeNull()
    act(() => result.current.start(['human', 'bot'], 48))
    expect(result.current.state?.playerList).toHaveLength(4)
    expect(result.current.state?.currentPlayer).toBe(0)
  })

  it('commitMove applies a move, advances the turn, and appends a log line', () => {
    const { result } = renderHook(() => useTockGame())
    act(() => result.current.start(['human', 'bot'], 48))
    const before = result.current.state!
    const move = getLegalMoves(before, 0)[0]!
    act(() => result.current.commitMove(move))
    expect(result.current.state).not.toBe(before)
    expect(result.current.logList.length).toBe(1)
  })

  it('restart clears the game', () => {
    const { result } = renderHook(() => useTockGame())
    act(() => result.current.start(['human', 'bot'], 48))
    act(() => result.current.restart())
    expect(result.current.state).toBeNull()
    expect(result.current.logList).toEqual([])
  })

  it('appends exactly one log line per move under StrictMode', () => {
    const { result } = renderHook(() => useTockGame(), { wrapper: StrictMode })
    act(() => result.current.start(['human', 'bot'], 48))
    const move = getLegalMoves(result.current.state!, 0)[0]!
    act(() => result.current.commitMove(move))
    expect(result.current.logList).toHaveLength(1)
  })
})

describe('isHumanSeat', () => {
  it('is true when the current player is a human seat', () => {
    expect(isHumanSeat(createGame(['human', 'bot'], 48), [0])).toBe(true)
  })

  it('is false when the current player is not a human seat', () => {
    const state = { ...createGame(['human', 'bot'], 48), currentPlayer: 1 as const }
    expect(isHumanSeat(state, [0])).toBe(false)
  })
})

describe('useBotAutoplay', () => {
  it('schedules and commits a bot move after the delay for a bot seat', () => {
    vi.useFakeTimers()
    const commitMove = vi.fn()
    const state = { ...createGame(['human', 'bot'], 48), currentPlayer: 1 as const }
    renderHook(() => useBotAutoplay({ state, humanSeatIds: [0], delayMs: 900, commitMove, random: () => 0 }))
    expect(commitMove).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(commitMove).toHaveBeenCalledTimes(1)
    expect(commitMove.mock.calls[0]?.[0]).toHaveProperty('type')
    vi.useRealTimers()
  })

  it('does not schedule a move for a human seat', () => {
    vi.useFakeTimers()
    const commitMove = vi.fn()
    const state = { ...createGame(['human', 'bot'], 48), currentPlayer: 0 as const }
    renderHook(() => useBotAutoplay({ state, humanSeatIds: [0], delayMs: 900, commitMove, random: () => 0 }))
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(commitMove).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not schedule a move when state is null', () => {
    vi.useFakeTimers()
    const commitMove = vi.fn()
    const state = null
    renderHook(() => useBotAutoplay({ state, humanSeatIds: [0], delayMs: 900, commitMove, random: () => 0 }))
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(commitMove).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not schedule a move when the game is over', () => {
    vi.useFakeTimers()
    const commitMove = vi.fn()
    const state = { ...createGame(['human', 'bot'], 48), currentPlayer: 1 as const, winner: 0 as const }
    renderHook(() => useBotAutoplay({ state, humanSeatIds: [0], delayMs: 900, commitMove, random: () => 0 }))
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(commitMove).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('clears the timer on unmount, so it never fires', () => {
    vi.useFakeTimers()
    const commitMove = vi.fn()
    const state = { ...createGame(['human', 'bot'], 48), currentPlayer: 1 as const }
    const { unmount } = renderHook(() => useBotAutoplay({ state, humanSeatIds: [0], delayMs: 900, commitMove, random: () => 0 }))
    unmount()
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(commitMove).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('clears the previous timer when state changes before it fires', () => {
    vi.useFakeTimers()
    const commitMove = vi.fn()
    const botState: GameState = { ...createGame(['human', 'bot'], 48), currentPlayer: 1 as const }
    const humanState: GameState = { ...createGame(['human', 'bot'], 48), currentPlayer: 0 as const }
    const { rerender } = renderHook(
      ({ state }: { state: GameState }) => useBotAutoplay({ state, humanSeatIds: [0], delayMs: 900, commitMove, random: () => 0 }),
      { initialProps: { state: botState } }
    )
    rerender({ state: humanState })
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(commitMove).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

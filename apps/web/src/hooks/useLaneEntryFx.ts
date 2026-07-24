import { useEffect, useRef, useState } from 'react'
import type { GameState, PlayerId } from '@tock/core'
import { laneEntries } from '../laneFx'
import { laneEntryFxMs, prefersReducedMotion } from '../motion'

export type ActiveLaneEntry = { key: string, owner: PlayerId, finishIndex: number }

// Watches committed game states and surfaces a short-lived list of finish-lane
// entries to animate. Detection is a pure before/after diff (see laneEntries),
// so it fires for any seat (human or bot) and any move type. Yields nothing
// under prefers-reduced-motion. Keys come from a monotonic counter (no
// Math.random / Date.now, which are banned for determinism). Each entry is
// removed after laneEntryFxMs so the transient SVG unmounts once it has played.
export const useLaneEntryFx = (state: GameState): ActiveLaneEntry[] => {
  const [activeList, setActiveList] = useState<ActiveLaneEntry[]>([])
  const prevRef = useRef<GameState | null>(null)
  const counterRef = useRef(0)
  const timerListRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = state
    if (!prev || prefersReducedMotion()) return
    const entryList = laneEntries(prev, state)
    if (entryList.length === 0) return
    const addedList = entryList.map(entry => {
      counterRef.current += 1
      return { key: `${entry.marbleId}-${counterRef.current}`, owner: entry.owner, finishIndex: entry.finishIndex }
    })
    setActiveList(current => [...current, ...addedList])
    const timer = setTimeout(() => {
      setActiveList(current => current.filter(item => !addedList.some(added => added.key === item.key)))
    }, laneEntryFxMs)
    timerListRef.current.push(timer)
  }, [state])

  useEffect(() => () => { timerListRef.current.forEach(clearTimeout) }, [])

  return activeList
}

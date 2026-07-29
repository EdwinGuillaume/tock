import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { isStandalone } from '../pwa/platform'
import { createAudioEngine, type AudioEngine } from './AudioEngine'
import { audioForced, computeAudioEnabled } from './enabled'
import type { SoundId } from './sounds'

export type AudioContextValue = {
  audioEnabled: boolean
  muted: boolean
  toggleMuted: () => void
  play: (id: SoundId) => void
}

export const AudioCtx = createContext<AudioContextValue | null>(null)

const MUTE_KEY = 'tock.muted'
const readMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true'
  } catch {
    return false
  }
}

type Props = { children: ReactNode; engine?: AudioEngine; enabled?: boolean }

export const AudioProvider = ({ children, engine, enabled }: Props) => {
  const audioEnabled = enabled ?? computeAudioEnabled({
    standalone: isStandalone(),
    dev: import.meta.env.DEV,
    forced: audioForced()
  })
  const engineRef = useRef<AudioEngine | null>(null)
  if (audioEnabled && !engineRef.current) engineRef.current = engine ?? createAudioEngine()

  const [muted, setMuted] = useState(readMuted)

  useEffect(() => {
    if (audioEnabled) engineRef.current?.preload()
  }, [audioEnabled])

  const startedRef = useRef(false)
  useEffect(() => {
    if (!audioEnabled) return
    engineRef.current?.setMuted(muted)
    // Only a post-mount unmute (a user gesture) starts the bed; the mount pass
    // must not, since that runs before the first-gesture unlock.
    if (!muted && startedRef.current) engineRef.current?.startMusic()
    startedRef.current = true
  }, [audioEnabled, muted])

  useEffect(() => {
    if (!audioEnabled) return
    const onFirst = () => {
      engineRef.current?.unlock()
      if (!readMuted()) engineRef.current?.startMusic()
    }
    window.addEventListener('pointerdown', onFirst, { once: true })
    return () => window.removeEventListener('pointerdown', onFirst)
  }, [audioEnabled])

  useEffect(() => {
    if (!audioEnabled) return
    const onVisibility = () => {
      if (document.hidden) engineRef.current?.pauseMusic()
      else if (!muted) engineRef.current?.resumeMusic()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [audioEnabled, muted])

  // Stable across renders (reads the ref) so App.commitAndPass keeps its
  // state-keyed identity and useBotAutoplay does not re-arm every render.
  const play = useCallback((id: SoundId) => { engineRef.current?.play(id) }, [])

  const toggleMuted = useCallback(() => {
    setMuted(previous => {
      const next = !previous
      try { localStorage.setItem(MUTE_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ audioEnabled, muted, toggleMuted, play }),
    [audioEnabled, muted, toggleMuted, play]
  )
  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>
}

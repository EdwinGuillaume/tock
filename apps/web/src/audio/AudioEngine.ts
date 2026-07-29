import type { Howl as HowlInstance } from 'howler'
import { AUDIO_BASE, AUDIO_FORMATS, musicTrack, pickSample, soundManifest, type SoundId } from './sounds'

export type AudioEngine = {
  preload: () => void
  unlock: () => void
  play: (id: SoundId) => void
  startMusic: () => void
  stopMusic: () => void
  pauseMusic: () => void
  resumeMusic: () => void
  setMuted: (muted: boolean) => void
}

type HowlerModule = typeof import('howler')

// Codec fallbacks for one clip; Howler picks the first the browser can play.
export const sourcesFor = (name: string, root: string): string[] =>
  AUDIO_FORMATS.map(format => `${root}/${name}.${format}`)

export const createAudioEngine = (random: () => number = Math.random): AudioEngine => {
  const root = `${import.meta.env.BASE_URL}${AUDIO_BASE}`
  let lib: HowlerModule | null = null
  let muted = false
  let wantMusic = false
  const howlCache = new Map<string, HowlInstance>()
  let music: HowlInstance | null = null
  // Track the bed's lifecycle ourselves rather than trusting Howl.playing():
  // while the AudioContext is suspended a queued play still reports as not
  // playing, so a `!playing()` guard let every start trigger spawn another
  // overlapping loop (stacked gain → "max volume"). `musicLive` = we have
  // issued the bed's single play and not stopped it; `musicPaused` = it is
  // currently paused by a tab-hide.
  let musicLive = false
  let musicPaused = false

  const howlFor = (name: string, volume: number): HowlInstance | null => {
    if (!lib) return null
    const cached = howlCache.get(name)
    if (cached) return cached
    const howl = new lib.Howl({ src: sourcesFor(name, root), volume })
    howlCache.set(name, howl)
    return howl
  }
  const ensureMusic = (): HowlInstance | null => {
    if (!lib) return null
    if (!music) music = new lib.Howl({ src: sourcesFor(musicTrack.name, root), volume: musicTrack.volume, loop: true })
    return music
  }
  // Start the bed at most once; further calls are no-ops until stopMusic.
  const startBed = () => {
    const track = ensureMusic()
    if (!track || musicLive) return
    musicLive = true
    musicPaused = false
    track.play()
  }

  let wantResume = false

  // Apply everything queued before Howler resolved. Resume the audio context
  // only after a real user gesture (wantResume), never on a bare preload.
  const applyLoaded = () => {
    if (!lib) return
    lib.Howler.mute(muted)
    if (wantResume) lib.Howler.ctx?.resume?.()
    if (wantMusic) startBed()
  }
  // Kick off the lazy Howler import once; a gated-off browser tab never mounts
  // an enabled provider, so it still downloads nothing.
  const ensureLib = () => {
    if (lib) {
      applyLoaded()
      return
    }
    void import('howler').then(mod => {
      lib = mod
      applyLoaded()
    })
  }

  return {
    preload: () => { ensureLib() },
    unlock: () => {
      wantResume = true
      ensureLib()
    },
    play: id => {
      const entry = soundManifest[id]
      howlFor(pickSample(entry.pool, random), entry.volume)?.play()
    },
    startMusic: () => {
      wantMusic = true
      if (lib) startBed()
    },
    stopMusic: () => {
      wantMusic = false
      musicLive = false
      musicPaused = false
      music?.stop()
    },
    pauseMusic: () => {
      if (!musicLive || musicPaused) return
      musicPaused = true
      music?.pause()
    },
    resumeMusic: () => {
      wantMusic = true
      if (!lib) return
      if (!musicLive) { startBed(); return }
      if (!musicPaused) return
      musicPaused = false
      music?.play()
    },
    setMuted: value => {
      muted = value
      lib?.Howler.mute(value)
    }
  }
}

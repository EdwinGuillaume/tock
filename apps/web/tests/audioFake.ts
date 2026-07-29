import type { AudioEngine } from '../src/audio/AudioEngine'
import type { SoundId } from '../src/audio/sounds'

export type FakeEngine = AudioEngine & {
  played: SoundId[]
  unlockCount: number
  preloadCount: number
  musicStarted: number
  pauseCount: number
  resumeCount: number
  muted: boolean | null
}

export const createFakeEngine = (): FakeEngine => {
  const fake: FakeEngine = {
    played: [],
    unlockCount: 0,
    preloadCount: 0,
    musicStarted: 0,
    pauseCount: 0,
    resumeCount: 0,
    muted: null,
    preload: () => { fake.preloadCount++ },
    unlock: () => { fake.unlockCount++ },
    play: (id: SoundId) => { fake.played.push(id) },
    startMusic: () => { fake.musicStarted++ },
    stopMusic: () => {},
    pauseMusic: () => { fake.pauseCount++ },
    resumeMusic: () => { fake.resumeCount++ },
    setMuted: (value: boolean) => { fake.muted = value }
  }
  return fake
}

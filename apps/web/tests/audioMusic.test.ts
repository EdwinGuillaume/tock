import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAudioEngine } from '../src/audio/AudioEngine'

// Fake Howl whose `playing()` stays false — this models Web Audio's real
// behaviour while the AudioContext is still suspended (the play is queued on
// `resume`, so Howler reports the sound as not playing yet). That is exactly
// the window in which repeated start triggers used to each spawn a new,
// overlapping bed instance.
type FakeHowl = { opts: { src: string[]; volume?: number; loop?: boolean }; playCount: number }
const instances: FakeHowl[] = []

vi.mock('howler', () => {
  class Howl {
    opts: FakeHowl['opts']
    playCount = 0
    constructor(opts: FakeHowl['opts']) {
      this.opts = opts
      instances.push(this as unknown as FakeHowl)
    }
    play() { this.playCount += 1; return this.playCount }
    playing() { return false }
    stop() {}
    pause() {}
  }
  const Howler = { mute: () => {}, ctx: { resume: () => {} } }
  return { Howl, Howler }
})

const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)) }
const musicInstance = () => instances.find(entry => entry.opts.src.some(src => src.includes('music-loop')))

afterEach(() => { instances.length = 0 })

describe('AudioEngine music bed', () => {
  it('starts the bed only once across repeated start triggers', async () => {
    const engine = createAudioEngine()
    engine.preload()
    await flush() // let the lazy howler import resolve so lib is set

    // Several triggers fire around the first gesture (StrictMode double-effect,
    // applyLoaded, unlock + startMusic, visibility) before the context resumes.
    engine.startMusic()
    engine.startMusic()
    engine.startMusic()

    expect(musicInstance()?.playCount).toBe(1)
  })

  it('resumes the paused bed without spawning a second instance', async () => {
    const engine = createAudioEngine()
    engine.preload()
    await flush()

    engine.startMusic()
    engine.pauseMusic()
    engine.resumeMusic()
    engine.resumeMusic() // a redundant resume must not stack

    // One start play + one resume play — never a third overlapping loop.
    expect(musicInstance()?.playCount).toBe(2)
  })
})

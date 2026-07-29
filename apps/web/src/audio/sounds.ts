export type SoundId =
  | 'exit' | 'move' | 'push' | 'swap' | 'split7' | 'discard'
  | 'capture' | 'win'
  | 'draw'
  | 'tap'
  | 'laneEntry'

// `pool` = distinct clip variants for one SoundId (variety, picked at random).
// AUDIO_FORMATS = the codec(s) each clip ships in (appended to the pool name).
export const soundManifest: Record<SoundId, { pool: string[]; volume: number }> = {
  exit: { pool: ['exit-1', 'exit-2'], volume: 0.7 },
  move: { pool: ['move-1', 'move-2'], volume: 0.8 },
  push: { pool: ['push-1', 'push-2'], volume: 0.8 },
  swap: { pool: ['swap-1'], volume: 0.4 },
  split7: { pool: ['split7-1'], volume: 0.6 },
  discard: { pool: ['discard-1'], volume: 0.4 },
  capture: { pool: ['capture-1', 'capture-2'], volume: 0.7 },
  win: { pool: ['win-1'], volume: 0.9 },
  draw: { pool: ['draw-1', 'draw-2'], volume: 0.5 },
  tap: { pool: ['tap-1', 'tap-2'], volume: 0.8 },
  laneEntry: { pool: ['lane-entry-1'], volume: 0.7 }
}

// mp3 only: it plays in every target browser (Chrome/Firefox/Safari/iOS), and
// Howler picks a source by codec support — not by file existence — and does NOT
// fall back on a 404. Listing webm first made Chrome request a (missing) .webm
// and stay silent, so a single universally-supported format is the safe choice.
export const AUDIO_FORMATS = ['mp3'] as const
export const musicTrack = { name: 'music-loop', volume: 0.35 }
export const AUDIO_BASE = 'audio'

// Pick one clip base name from the pool. Injected RNG (mirrors pickMove in
// @tock/core) keeps selection testable. Clamps in case random() === 1.
export const pickSample = (pool: string[], random: () => number): string => {
  const first = pool[0]
  if (first === undefined) throw new Error('empty sound pool')
  const index = Math.min(Math.floor(random() * pool.length), pool.length - 1)
  return pool[index] ?? first
}

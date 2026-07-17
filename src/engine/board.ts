import type { PlayerId, Position } from './types'

export const playerCount = 4
export const finishSize = 4

// Selectable ring sizes; the default keeps the classic 48-cell board.
export const DEFAULT_RING_SIZE = 48
export const RING_SIZE_OPTIONS = [48, 72] as const

// Cells per quadrant (per side of the square board). 48 -> 12, 72 -> 18.
export const quadrantSize = (ringSize: number): number => ringSize / playerCount

export const startCell = (player: PlayerId, ringSize: number): number =>
  player * quadrantSize(ringSize)

export const laneMouth = (player: PlayerId, ringSize: number): number =>
  (startCell(player, ringSize) - 1 + ringSize) % ringSize

export const stepsToMouth = (
  player: PlayerId,
  fromIndex: number,
  steps: number,
  ringSize: number
): number => {
  const direction = steps >= 0 ? 1 : -1
  const mouth = laneMouth(player, ringSize)
  return direction === 1
    ? (mouth - fromIndex + ringSize) % ringSize
    : (fromIndex - mouth + ringSize) % ringSize
}

export type RingMove = {
  ring: Extract<Position, { zone: 'track' }>
  lane: Extract<Position, { zone: 'finish' }> | null
}

// Geometric landings for a marble of `player` currently on the ring at
// `fromIndex`, moving `steps` (>0 forward, <0 backward). Occupancy is ignored
// here — legality (captures, own-marble, protection) is applied in moves.ts.
export const ringDestinations = (
  player: PlayerId,
  fromIndex: number,
  steps: number,
  ringSize: number
): RingMove => {
  const direction = steps >= 0 ? 1 : -1
  const distance = Math.abs(steps)

  const ringIndex = (((fromIndex + direction * distance) % ringSize) + ringSize) % ringSize
  const ring = { zone: 'track', index: ringIndex } as const

  // A marble only enters its home stretch moving forward: crossing the mouth
  // backward (the "4 trick") is not allowed — a backward move stays on the ring.
  const laneIndex = distance - stepsToMouth(player, fromIndex, steps, ringSize) - 1
  const lane = direction === 1 && laneIndex >= 0 && laneIndex < finishSize
    ? ({ zone: 'finish', index: laneIndex } as const)
    : null

  return { ring, lane }
}

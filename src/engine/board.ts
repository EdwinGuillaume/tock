import type { PlayerId, Position } from './types'

export const ringSize = 48
export const playerCount = 4
export const quadrantSize = ringSize / playerCount // 12
export const finishSize = 4

export const startCell = (player: PlayerId): number => player * quadrantSize

export const laneMouth = (player: PlayerId): number =>
  (startCell(player) - 1 + ringSize) % ringSize

export const stepsToMouth = (player: PlayerId, fromIndex: number, steps: number): number => {
  const direction = steps >= 0 ? 1 : -1
  const mouth = laneMouth(player)
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
export const ringDestinations = (player: PlayerId, fromIndex: number, steps: number): RingMove => {
  const direction = steps >= 0 ? 1 : -1
  const distance = Math.abs(steps)

  const ringIndex = (((fromIndex + direction * distance) % ringSize) + ringSize) % ringSize
  const ring = { zone: 'track', index: ringIndex } as const

  const laneIndex = distance - stepsToMouth(player, fromIndex, steps) - 1
  const lane = laneIndex >= 0 && laneIndex < finishSize
    ? ({ zone: 'finish', index: laneIndex } as const)
    : null

  return { ring, lane }
}

import type { GameState, PlayerId } from '@tock/core'
import { colorOf, finishCoord, finishSize, ringCoord, startCell } from '@tock/core'
import { CELL, HOLE_R, cellCenter, homeSlotCenter, marbleCenter, viewBox } from '../svgGeometry'
import { seatColor, theme } from '../theme'
import { Marble } from './Marble'
import { Ghost } from './Ghost'

type GhostEntry = { key: string, cx: number, cy: number, label?: string }
type BoardProps = { state: GameState, ghostList: GhostEntry[], onGhost: (key: string) => void }
type Point = { x: number, y: number }

// The four physical seats (playerCount === 4). Typed as PlayerId so the geometry
// helpers accept it — the board always shows all four arms regardless of how many
// seats are actually in play.
const SEAT_LIST: PlayerId[] = [0, 1, 2, 3]

// Per-marble home-slot index: the Nth marble a player owns takes home slot N.
const slotIndexOf = (marbleList: GameState['marbleList'], marble: GameState['marbleList'][number]): number => {
  const owned = marbleList.filter(candidate => candidate.owner === marble.owner)
  return owned.findIndex(candidate => candidate.id === marble.id)
}

// A wood tile: a seamless CELL-sized square (adjacent tiles merge into the
// solid cross arms) with a drilled hole in the middle.
const Tile = ({ point, holeStroke }: { point: Point, holeStroke?: string }) => (
  <>
    <rect x={point.x - CELL / 2} y={point.y - CELL / 2} width={CELL} height={CELL} fill={theme.board} />
    <circle cx={point.x} cy={point.y} r={HOLE_R} fill={theme.hole} stroke={holeStroke ?? theme.boardEdge} strokeWidth={0.5} />
  </>
)

// The static wood board behind the marbles: the ring, the four finish lanes,
// the four home nests, and a seat-colored ring marking each start square. Drawn
// for all four seats regardless of player count — the physical board always has
// four arms.
const boardBackdrop = (ringSize: number) => (
    <>
      {Array.from({ length: ringSize }, (_unused, index) => (
        <Tile key={`ring-${index}`} point={cellCenter(ringCoord(index, ringSize))} />
      ))}
      {SEAT_LIST.map(seat => {
        const dark = seatColor[colorOf(seat)].dark
        const homeList = Array.from({ length: finishSize }, (_unused, slot) => homeSlotCenter(seat, slot, ringSize))
        const xList = homeList.map(spot => spot.x)
        const yList = homeList.map(spot => spot.y)
        const pad = HOLE_R + 2
        const minX = Math.min(...xList) - pad
        const minY = Math.min(...yList) - pad
        return (
          <g key={`seat-${seat}`}>
            {Array.from({ length: finishSize }, (_unused, slot) => (
              <Tile key={`finish-${seat}-${slot}`} point={cellCenter(finishCoord(seat, slot, ringSize))} holeStroke={dark} />
            ))}
            <rect
              x={minX}
              y={minY}
              width={Math.max(...xList) - minX + pad}
              height={Math.max(...yList) - minY + pad}
              rx={pad}
              fill={theme.board}
            />
            {homeList.map((spot, slot) => (
              <circle key={`home-${seat}-${slot}`} cx={spot.x} cy={spot.y} r={HOLE_R} fill={theme.hole} stroke={dark} strokeWidth={0.6} />
            ))}
            <circle
              cx={cellCenter(ringCoord(startCell(seat, ringSize), ringSize)).x}
              cy={cellCenter(ringCoord(startCell(seat, ringSize), ringSize)).y}
              r={HOLE_R + 1.3}
              fill="none"
              stroke={seatColor[colorOf(seat)].light}
              strokeWidth={0.9}
            />
          </g>
        )
      })}
    </>
  )

export const Board = ({ state, ghostList, onGhost }: BoardProps) => {
  const placedList = state.marbleList.map(marble => ({
    marble,
    point: marbleCenter(marble.owner, marble.position, slotIndexOf(state.marbleList, marble), state.ringSize)
  }))

  return (
    <svg viewBox={viewBox(state.ringSize)} role="img" aria-label="board" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        {(['red', 'green', 'yellow', 'blue'] as const).map(color => (
          <radialGradient key={color} id={`marble-${color}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={seatColor[color].light} />
            <stop offset="100%" stopColor={seatColor[color].dark} />
          </radialGradient>
        ))}
      </defs>
      {boardBackdrop(state.ringSize)}
      {placedList.map(({ marble, point }) => (
        <Marble key={marble.id} testId={`marble-${marble.id}`} color={colorOf(marble.owner)} cx={point.x} cy={point.y} />
      ))}
      {ghostList.map(ghost => (
        <Ghost key={ghost.key} cx={ghost.cx} cy={ghost.cy} label={ghost.label} onSelect={() => onGhost(ghost.key)} />
      ))}
    </svg>
  )
}

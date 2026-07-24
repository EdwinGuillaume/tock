import type { GameState, MarbleId, PlayerId } from '@tock/core'
import { colorOf, finishCoord, finishSize, ringCoord, startCell } from '@tock/core'
import {
  CHANNEL_W, EMBLEM_R, SOCKET_R,
  boardCenter, cellCenter, finishThread, homeSlotCenter, marbleCenter, ringChannelPath, viewBox
} from '../svgGeometry'
import { seatColor, theme } from '../theme'
import { Marble } from './Marble'
import { Ghost } from './Ghost'

type GhostEntry = { key: string, cx: number, cy: number, label?: string }
type BoardProps = {
  state: GameState
  ghostList: GhostEntry[]
  onGhost: (key: string) => void
  selectedMarbleId?: MarbleId | null
  selectableMarbleIds?: MarbleId[]
  onSelectMarble?: (id: MarbleId) => void
}

const SEAT_LIST: PlayerId[] = [0, 1, 2, 3]

const slotIndexOf = (marbleList: GameState['marbleList'], marble: GameState['marbleList'][number]): number => {
  const owned = marbleList.filter(candidate => candidate.owner === marble.owner)
  return owned.findIndex(candidate => candidate.id === marble.id)
}

// A carved, recessed socket at a grid cell. `rim` (an "r,g,b" triple) tints its edge
// for finish/home ownership; otherwise a faint dark rim.
const Socket = ({ x, y, rim }: { x: number, y: number, rim?: string }) => (
  <>
    <circle cx={x} cy={y} r={SOCKET_R} fill="url(#socket)" />
    <circle cx={x} cy={y} r={SOCKET_R} fill="none" stroke={rim ? `rgba(${rim},.75)` : 'rgba(0,0,0,.5)'} strokeWidth={rim ? 0.7 : 0.5} />
    <path d={`M ${x - SOCKET_R + 0.7} ${y + 0.7} A ${SOCKET_R - 0.5} ${SOCKET_R - 0.5} 0 0 0 ${x + SOCKET_R - 0.7} ${y + 0.7}`} fill="none" stroke="rgba(255,255,255,.13)" strokeWidth={0.5} />
  </>
)

const boardBackdrop = (ringSize: number) => {
  const center = boardCenter(ringSize)
  const path = ringChannelPath(ringSize)
  return (
    <>
      {/* main ring = continuous felt channel */}
      <path data-role="ring-channel" d={path} fill="none" stroke={theme.feltPanel} strokeWidth={CHANNEL_W} strokeLinejoin="round" strokeLinecap="round" />
      <path d={path} fill="none" stroke="rgba(255,216,115,.08)" strokeWidth={CHANNEL_W} strokeLinejoin="round" />

      {/* finish lanes = gold thread + seat-rimmed sockets */}
      {SEAT_LIST.map(seat => {
        const thread = finishThread(seat, ringSize)
        const rim = seatColor[colorOf(seat)].soft
        return (
          <g key={`finish-${seat}`}>
            <line x1={thread.mouth.x} y1={thread.mouth.y} x2={thread.stop.x} y2={thread.stop.y} stroke="rgba(255,216,115,.38)" strokeWidth={1} strokeLinecap="round" />
            {Array.from({ length: finishSize }, (_unused, slot) => {
              const point = cellCenter(finishCoord(seat, slot, ringSize))
              return <Socket key={slot} x={point.x} y={point.y} rim={rim} />
            })}
          </g>
        )
      })}

      {/* ring sockets */}
      {Array.from({ length: ringSize }, (_unused, index) => {
        const point = cellCenter(ringCoord(index, ringSize))
        return <Socket key={`ring-${index}`} x={point.x} y={point.y} />
      })}

      {/* home pods + sockets + start rings */}
      {SEAT_LIST.map(seat => {
        const color = colorOf(seat)
        const rim = seatColor[color].soft
        const homeList = Array.from({ length: finishSize }, (_unused, slot) => homeSlotCenter(seat, slot, ringSize))
        const xList = homeList.map(spot => spot.x)
        const yList = homeList.map(spot => spot.y)
        const pad = SOCKET_R + 2.5
        const minX = Math.min(...xList) - pad
        const minY = Math.min(...yList) - pad
        const start = cellCenter(ringCoord(startCell(seat, ringSize), ringSize))
        return (
          <g key={`home-${seat}`}>
            <rect x={minX} y={minY} width={Math.max(...xList) - minX + pad} height={Math.max(...yList) - minY + pad} rx={pad} fill={`rgba(${rim},.15)`} stroke={`rgba(${rim},.5)`} strokeWidth={0.7} />
            {homeList.map((spot, slot) => <Socket key={slot} x={spot.x} y={spot.y} rim={rim} />)}
            <circle cx={start.x} cy={start.y} r={SOCKET_R + 1.4} fill="none" stroke={seatColor[color].light} strokeWidth={0.9} opacity={0.9} />
          </g>
        )
      })}

      {/* centre emblem */}
      <circle cx={center.x} cy={center.y} r={EMBLEM_R} fill="rgba(255,216,115,.10)" stroke="rgba(255,216,115,.4)" strokeWidth={0.7} />
      <text x={center.x} y={center.y + 2.2} textAnchor="middle" fontFamily={theme.fontDisplay} fontSize={6} fontWeight={700} fill={theme.gold}>T</text>
    </>
  )
}

export const Board = ({ state, ghostList, onGhost, selectedMarbleId, selectableMarbleIds, onSelectMarble }: BoardProps) => {
  const placedList = state.marbleList.map(marble => ({
    marble,
    point: marbleCenter(marble.owner, marble.position, slotIndexOf(state.marbleList, marble), state.ringSize)
  }))

  return (
    <svg viewBox={viewBox(state.ringSize)} role="img" aria-label="board" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        {(['red', 'green', 'purple', 'blue'] as const).map(color => (
          <radialGradient key={color} id={`marble-${color}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={seatColor[color].light} />
            <stop offset="100%" stopColor={seatColor[color].dark} />
          </radialGradient>
        ))}
        <radialGradient id="socket" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor={theme.socketDark} />
          <stop offset="55%" stopColor={theme.socketMid} />
          <stop offset="100%" stopColor={theme.socketRim} />
        </radialGradient>
      </defs>
      {boardBackdrop(state.ringSize)}
      {placedList.map(({ marble, point }) => {
        const marbleNode = (
          <Marble
            key={marble.id}
            testId={`marble-${marble.id}`}
            color={colorOf(marble.owner)}
            cx={point.x}
            cy={point.y}
            selected={marble.id === selectedMarbleId}
          />
        )
        if (selectableMarbleIds?.includes(marble.id) && onSelectMarble) {
          return (
            <g key={marble.id} role="button" aria-label={`select-marble-${marble.id}`} onClick={() => onSelectMarble(marble.id)} style={{ cursor: 'pointer' }}>
              {marbleNode}
            </g>
          )
        }
        return marbleNode
      })}
      {ghostList.map(ghost => (
        <Ghost key={ghost.key} cx={ghost.cx} cy={ghost.cy} label={ghost.label} onSelect={() => onGhost(ghost.key)} />
      ))}
    </svg>
  )
}

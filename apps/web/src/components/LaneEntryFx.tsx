import type { CSSProperties } from 'react'
import type { PlayerId } from '@tock/core'
import { finishCoord } from '@tock/core'
import { cellCenter, finishThread } from '../svgGeometry'
import { theme } from '../theme'

type LaneEntryFxProps = { owner: PlayerId, finishIndex: number, ringSize: number }

// Transient finish-lane entry effect, embedded inside the board <svg> (it relies
// on the shared <filter id="lane-soft"> defined by Board). A golden thread flare
// over the seat's finish thread, a white comet gliding from the mouth toward the
// nest, and two gold echo rings on the landing cell. All motion is CSS (see
// index.css); this component only positions the elements. The comet's outer group
// is statically positioned at the mouth so its inner group is free to animate its
// own transform (translate by the mouth->stop vector, passed as --lx/--ly).
export const LaneEntryFx = ({ owner, finishIndex, ringSize }: LaneEntryFxProps) => {
  const { mouth, stop } = finishThread(owner, ringSize)
  const landing = cellCenter(finishCoord(owner, finishIndex, ringSize))
  const cometStyle = { '--lx': `${stop.x - mouth.x}px`, '--ly': `${stop.y - mouth.y}px` } as CSSProperties
  return (
    <g data-testid={`lane-fx-${owner}-${finishIndex}`} style={{ pointerEvents: 'none' }}>
      <line
        data-testid="lane-fx-glow"
        className="tock-lane-glow"
        x1={mouth.x} y1={mouth.y} x2={stop.x} y2={stop.y}
        stroke={theme.gold} strokeWidth={1.8} strokeLinecap="round" filter="url(#lane-soft)"
      />
      <g style={{ transform: `translate(${mouth.x}px, ${mouth.y}px)` }}>
        <g data-testid="lane-fx-comet" className="tock-lane-comet" style={cometStyle}>
          <circle cx={0} cy={0} r={2.4} fill="#fffaf0" filter="url(#lane-soft)" />
          <circle cx={0} cy={0} r={1.1} fill="#ffffff" />
        </g>
      </g>
      <g data-testid="lane-fx-echo" style={{ transform: `translate(${landing.x}px, ${landing.y}px)` }}>
        <circle className="tock-lane-echo" cx={0} cy={0} r={3.6} fill="none" stroke={theme.gold} strokeWidth={0.9} />
        <circle className="tock-lane-echo tock-lane-echo--b" cx={0} cy={0} r={3.6} fill="none" stroke="#ffe6a0" strokeWidth={0.6} />
      </g>
    </g>
  )
}

import { MARBLE_R } from '../svgGeometry'
import { theme } from '../theme'

type GhostProps = { cx: number, cy: number, label?: string, onSelect: () => void }

export const Ghost = ({ cx, cy, label, onSelect }: GhostProps) => (
  <g role="button" aria-label={`ghost-${label ?? ''}`} onClick={onSelect} style={{ cursor: 'pointer' }}>
    <circle cx={cx} cy={cy} r={MARBLE_R + 1.6} fill="transparent" />
    <circle cx={cx} cy={cy} r={MARBLE_R} fill="rgba(255,216,115,.16)" stroke={theme.gold} strokeWidth={0.8} />
    <circle className="tock-echo" cx={cx} cy={cy} r={MARBLE_R} fill="none" stroke={theme.gold} strokeWidth={0.8} />
    <circle className="tock-echo tock-echo--b" cx={cx} cy={cy} r={MARBLE_R} fill="none" stroke={theme.gold} strokeWidth={0.8} />
    {label && (
      <text x={cx} y={cy + 1} textAnchor="middle" fontSize={3.2} fontFamily={theme.fontDisplay} fontWeight={700} fill="#ffe6a6">{label}</text>
    )}
  </g>
)

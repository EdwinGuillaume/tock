import { MARBLE_R } from '../svgGeometry'
import { theme } from '../theme'

type GhostProps = { cx: number, cy: number, label?: string, onSelect: () => void }

export const Ghost = ({ cx, cy, label, onSelect }: GhostProps) => (
  <g role="button" aria-label={`ghost-${label ?? ''}`} onClick={onSelect} style={{ cursor: 'pointer' }}>
    <circle cx={cx} cy={cy} r={MARBLE_R + 1.2} fill="transparent" />
    <circle cx={cx} cy={cy} r={MARBLE_R} fill="none" stroke={theme.ghost} strokeWidth={1} strokeDasharray="2 1.5" />
    {label && (
      <text x={cx} y={cy + 1} textAnchor="middle" fontSize={4} fill={theme.ghost}>{label}</text>
    )}
  </g>
)

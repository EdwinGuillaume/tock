import type { Color } from '@tock/core'
import { MARBLE_R } from '../svgGeometry'
import { marbleGradientId, theme } from '../theme'

type MarbleProps = {
  color: Color
  cx: number
  cy: number
  testId?: string
  selected?: boolean
  selectable?: boolean
  ariaLabel?: string
  onSelect?: () => void
}

// Selection (role/onClick/cursor) lives on the marble's own root <g> rather than
// an outer wrapper, so the keyed element in Board's marble list is always a
// <Marble> regardless of whether it is currently selectable. That keeps the DOM
// node mounted across a selectable → non-selectable change (e.g. committing a
// 7-split), so its transform transition animates the glide instead of the marble
// being unmounted and remounted at the destination (which snaps with no motion).
export const Marble = ({ color, cx, cy, testId, selected, selectable, ariaLabel, onSelect }: MarbleProps) => (
  <g
    style={{ transform: `translate(${cx}px, ${cy}px)`, transition: `transform 0.25s ${theme.ease.spring}`, cursor: selectable ? 'pointer' : undefined }}
    role={selectable ? 'button' : undefined}
    aria-label={ariaLabel}
    onClick={selectable ? onSelect : undefined}
  >
    <ellipse cx={0} cy={MARBLE_R - 0.4} rx={MARBLE_R * 0.8} ry={1} fill="rgba(0,0,0,.4)" />
    <circle cx={0} cy={0} r={MARBLE_R} fill={`url(#${marbleGradientId(color)})`} data-testid={testId} />
    <circle cx={-MARBLE_R * 0.3} cy={-MARBLE_R * 0.35} r={MARBLE_R * 0.28} fill="rgba(255,255,255,.72)" />
    {selected && (
      <circle data-selected="true" cx={0} cy={0} r={MARBLE_R + 1.4} fill="none" stroke={theme.gold} strokeWidth={0.9} opacity={0.9} />
    )}
  </g>
)

import type { Color } from '@tock/core'
import { MARBLE_R } from '../svgGeometry'
import { marbleGradientId } from '../theme'

type MarbleProps = { color: Color, cx: number, cy: number, testId?: string }

export const Marble = ({ color, cx, cy, testId }: MarbleProps) => (
  <circle
    cx={cx}
    cy={cy}
    r={MARBLE_R}
    fill={`url(#${marbleGradientId(color)})`}
    data-testid={testId}
    style={{ transition: 'cx 0.25s ease, cy 0.25s ease' }}
  />
)

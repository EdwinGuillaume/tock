import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'

type StatusBarProps = { turnColor: Color, drawCount: number, discardCount: number, prompt: string }

export const StatusBar = ({ turnColor, drawCount, discardCount, prompt }: StatusBarProps) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', color: theme.text, fontSize: 13 }}>
    <span><span style={{ color: seatColor[turnColor].light }}>●</span> {prompt}</span>
    <span style={{ color: theme.textDim }}>🂠 {drawCount} · 🗑 {discardCount}</span>
  </div>
)

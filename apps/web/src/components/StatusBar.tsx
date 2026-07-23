import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'

type StatusBarProps = { turnColor: Color, drawCount: number, discardCount: number, prompt: string }

const pill = { fontSize: 11, color: theme.goldDim, background: 'rgba(0,0,0,.25)', border: `1px solid rgba(255,216,115,.18)`, borderRadius: theme.radius.pill, padding: '4px 10px' } as const

export const StatusBar = ({ turnColor, drawCount, discardCount, prompt }: StatusBarProps) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 8px', color: theme.ink }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: theme.fontDisplay, fontWeight: 600, fontSize: 15, color: '#ffe6a6' }}>
      <span className="tock-bob" style={{ width: 12, height: 12, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${seatColor[turnColor].light}, ${seatColor[turnColor].dark})`, boxShadow: `0 0 10px rgba(${seatColor[turnColor].soft},.8)` }} />
      {prompt}
    </span>
    <span style={{ display: 'flex', gap: 7 }}>
      <span style={pill}>Pioche <b style={{ color: '#ffe6a6' }}>{drawCount}</b></span>
      <span style={pill}>Défausse <b style={{ color: '#ffe6a6' }}>{discardCount}</b></span>
    </span>
  </div>
)

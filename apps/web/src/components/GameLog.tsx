import { useState } from 'react'
import { theme } from '../theme'

type GameLogProps = { logList: string[] }

export const GameLog = ({ logList }: GameLogProps) => {
  const [open, setOpen] = useState(false)
  const last = logList[logList.length - 1] ?? ''

  return (
    <div data-testid="game-log" style={{ position: 'relative', zIndex: 5, margin: '2px 16px 4px', fontSize: 12.5, color: '#b7c0cf' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'rgba(0,0,0,.2)', borderRadius: theme.radius.md }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last}</span>
        <button
          aria-label="afficher l'historique"
          onClick={() => setOpen(value => !value)}
          style={{ background: 'none', border: 'none', color: theme.goldDim, fontSize: 14, cursor: 'pointer', transform: open ? 'rotate(180deg)' : 'none' }}
        >▾</button>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'rgba(12,33,29,.97)', border: '1px solid rgba(255,216,115,.14)', borderRadius: theme.radius.md, marginTop: 4, padding: '6px 12px', maxHeight: 160, overflowY: 'auto', boxShadow: theme.shadowFloat, WebkitOverflowScrolling: 'touch' }}>
          {logList.map((line, index) => <div key={index} style={{ color: index === logList.length - 1 ? theme.ink : undefined }}>{line}</div>)}
        </div>
      )}
    </div>
  )
}

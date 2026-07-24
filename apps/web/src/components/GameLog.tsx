import { useState } from 'react'
import { seatColor, theme } from '../theme'
import { colorLabel } from '../format'
import type { LogEntry } from '../format'
import { duration, prefersReducedMotion } from '../motion'

type GameLogProps = { logList: LogEntry[] }

// A log line: bare text renders in the ambient ink, a coloured token renders the
// player's French name in its seat colour (the bright `light` shade reads on the
// dark felt).
const renderEntry = (entry: LogEntry) =>
  entry.map((segment, index) =>
    typeof segment === 'string'
      ? <span key={index}>{segment}</span>
      : <span key={index} style={{ color: seatColor[segment.color].light, fontWeight: 600 }}>{colorLabel[segment.color]}</span>
  )

// Wide, round-capped gold chevron in the "Feutrine & or" key. Points down when
// collapsed (the history drops down below the bar) and flips up when open.
const Chevron = ({ open }: { open: boolean }) => (
  <svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
    style={{
      flexShrink: 0,
      color: theme.goldDim,
      transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: prefersReducedMotion() ? undefined : `transform ${duration.fast}s ${theme.ease.spring}`
    }}
  >
    <path d="M5 9.5 L12 15 L19 9.5" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const GameLog = ({ logList }: GameLogProps) => {
  const [open, setOpen] = useState(false)
  const last = logList[logList.length - 1]

  return (
    <div data-testid="game-log" style={{ position: 'relative', zIndex: 5, margin: '2px 16px 4px', fontSize: 12.5, color: '#b7c0cf' }}>
      <button
        type="button"
        aria-label={open ? "masquer l'historique" : "afficher l'historique"}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '7px 12px', background: 'rgba(0,0,0,.2)', borderRadius: theme.radius.md,
          border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', textAlign: 'left'
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {last ? renderEntry(last) : null}
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'rgba(12,33,29,.97)', border: `1px solid ${theme.hairline}`, borderRadius: theme.radius.md, marginTop: 4, padding: '6px 12px', maxHeight: 160, overflowY: 'auto', boxShadow: theme.shadowFloat, WebkitOverflowScrolling: 'touch' }}>
          {logList.map((entry, index) => (
            <div key={index} style={{ padding: '2px 0', color: index === logList.length - 1 ? theme.ink : undefined }}>
              {renderEntry(entry)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { theme } from '../theme'

type SplitControlsProps = { remaining: number, canPlay: boolean, onUndo: () => void, onPlay: () => void }

export const SplitControls = ({ remaining, canPlay, onUndo, onPlay }: SplitControlsProps) => {
  const spent = 7 - remaining
  const mini = { fontFamily: theme.fontUi, fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 9, padding: '7px 12px', cursor: 'pointer' } as const
  return (
    <div style={{ margin: '0 16px', background: 'rgba(12,10,20,.72)', border: '1px solid rgba(255,255,255,.13)', boxShadow: '0 8px 22px rgba(0,0,0,.45)', borderRadius: theme.radius.md, padding: '9px 11px' }}>
      <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 8 }}>
        {Array.from({ length: 7 }, (_unused, index) => {
          const on = index < spent
          return <span key={index} data-pip={on ? 'on' : 'off'} style={{ width: 13, height: 13, borderRadius: '50%', border: on ? 'none' : '1.5px solid rgba(255,216,115,.55)', background: on ? `linear-gradient(${theme.goldButtonTop},${theme.goldButtonBottom})` : 'transparent' }} />
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        <span style={{ fontFamily: theme.fontDisplay, fontWeight: 600, fontSize: 13, color: remaining === 0 ? '#86e6a0' : '#ffe6a6' }}>{remaining === 0 ? '0 ✓' : `Reste ${remaining}`}</span>
        <button onClick={onUndo} style={{ ...mini, background: 'rgba(255,255,255,.08)', color: '#cdd3df' }}>Annuler</button>
        <button onClick={onPlay} disabled={!canPlay} style={{ ...mini, background: `linear-gradient(${theme.goldButtonTop},${theme.goldButtonBottom})`, color: '#3f280a', opacity: canPlay ? 1 : 0.4 }}>Jouer le 7</button>
      </div>
    </div>
  )
}

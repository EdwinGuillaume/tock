import { useState } from 'react'
import type { Color, PlayerKind } from '@tock/core'
import { DEFAULT_RING_SIZE, RING_SIZE_OPTIONS, colorOf } from '@tock/core'
import { seatColor, theme } from '../theme'
import { colorLabel } from '../format'

type SetupProps = { onStart: (kindList: PlayerKind[], ringSize: number) => void }

const opponentSeatList = [1, 2, 3] as const
const defaultOpponentKindList: PlayerKind[] = ['bot', 'inactive', 'inactive']

const Dot = ({ color }: { color: Color }) => (
  <span style={{ width: 22, height: 22, borderRadius: '50%', flex: 'none', background: `radial-gradient(circle at 35% 30%, ${seatColor[color].light}, ${seatColor[color].dark})`, boxShadow: '0 0 10px rgba(0,0,0,.4)' }} />
)

export const Setup = ({ onStart }: SetupProps) => {
  const [opponentKindList, setOpponentKindList] = useState<PlayerKind[]>(defaultOpponentKindList)
  const [ringSize, setRingSize] = useState<number>(DEFAULT_RING_SIZE)

  const setKind = (seatIndex: number, kind: PlayerKind) =>
    setOpponentKindList(previous => previous.map((entry, index) => (index === seatIndex ? kind : entry)))

  const handleStart = () => onStart(['human', ...opponentKindList], ringSize)

  const label = { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: theme.goldDim, opacity: 0.85, margin: '0 2px 10px' } as const
  const rowBase = { display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', marginBottom: 9, minHeight: 44, borderRadius: 14 } as const
  const seg = { display: 'flex', background: 'rgba(0,0,0,.28)', borderRadius: 10, padding: 3, gap: 2 } as const
  const opt = (on: boolean) => ({ fontFamily: theme.fontUi, fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', background: on ? `linear-gradient(${theme.goldButtonTop},${theme.goldButtonBottom})` : 'transparent', color: on ? '#3f280a' : '#b9c0cf' }) as const

  return (
    <div style={{ maxWidth: 360, margin: '0 auto', padding: '26px 20px 22px', display: 'flex', flexDirection: 'column', minHeight: '100dvh', color: theme.ink }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 46, letterSpacing: 3, color: theme.gold, textShadow: '0 2px 0 #7a4e12, 0 6px 14px rgba(0,0,0,.5)', lineHeight: 1 }}>TOCK</div>
        <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#cdb277', marginTop: 6, opacity: 0.8 }}>course de billes</div>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,216,115,.35), transparent)', margin: '20px 0 16px' }} />

      <div style={label}>Joueurs</div>

      <div style={{ ...rowBase, background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.07)' }}>
        <Dot color={colorOf(0)} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Vous · {colorLabel[colorOf(0)]}</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: '#4a2f0c', background: `linear-gradient(${theme.goldButtonTop},${theme.goldButtonBottom})`, padding: '5px 12px', borderRadius: theme.radius.pill }}>JOUEUR</span>
      </div>

      {opponentSeatList.map((seat, index) => {
        const kind = opponentKindList[index] ?? 'inactive'
        const color = colorOf(seat)
        if (kind === 'inactive') {
          return (
            <button key={seat} aria-label={`ajouter le joueur ${seat}`} onClick={() => setKind(index, 'bot')}
              style={{ ...rowBase, width: '100%', background: 'transparent', border: '1px dashed rgba(255,255,255,.16)', cursor: 'pointer', color: theme.inkDim }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px dashed ${seatColor[color].light}`, opacity: 0.55, flex: 'none' }} />
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>Ajouter {colorLabel[color]}</span>
              <span style={{ marginLeft: 'auto', fontSize: 20, color: theme.gold, fontWeight: 700 }}>+</span>
            </button>
          )
        }
        return (
          <div key={seat} data-testid={`seat-${seat}`} style={{ ...rowBase, background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.07)' }}>
            <Dot color={color} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{colorLabel[color]}</span>
            <div style={seg}>
              <button aria-label="humain" onClick={() => setKind(index, 'human')} style={opt(kind === 'human')}>Humain</button>
              <button aria-label="bot" onClick={() => setKind(index, 'bot')} style={opt(kind === 'bot')}>Bot</button>
            </div>
            <button aria-label={`retirer le joueur ${seat}`} onClick={() => setKind(index, 'inactive')}
              style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer', flex: 'none', background: 'rgba(255,255,255,.08)', color: '#cbb', fontSize: 15 }}>×</button>
          </div>
        )
      })}

      <div style={{ ...label, marginTop: 18 }}>Plateau</div>
      <div style={{ display: 'flex', gap: 10 }}>
        {RING_SIZE_OPTIONS.map(size => {
          const on = ringSize === size
          return (
            <button key={size} aria-pressed={on} onClick={() => setRingSize(size)}
              style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRadius: 13, cursor: 'pointer', background: on ? 'rgba(255,216,115,.12)' : 'rgba(255,255,255,.045)', border: on ? '1px solid rgba(255,216,115,.55)' : '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ fontFamily: theme.fontDisplay, fontWeight: 600, fontSize: 15, color: on ? theme.gold : theme.ink }}>{size === RING_SIZE_OPTIONS[0] ? 'Standard' : 'Grand'}</div>
              <div style={{ fontSize: 11, color: theme.inkDim, marginTop: 2 }}>{size} cases · {size === RING_SIZE_OPTIONS[0] ? 'vif' : 'long'}</div>
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1 }} />
      <button onClick={handleStart}
        style={{ marginTop: 24, fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 19, color: '#4a2f0c', background: `linear-gradient(${theme.goldButtonTop}, ${theme.goldButtonBottom})`, border: 'none', borderRadius: theme.radius.lg, padding: 16, boxShadow: `0 6px 0 ${theme.goldButtonLip}, 0 12px 20px rgba(0,0,0,.45)`, cursor: 'pointer' }}>
        Lancer la partie
      </button>
    </div>
  )
}

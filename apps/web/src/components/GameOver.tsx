import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'
import { colorLabel } from '../format'
import { Confetti } from './Confetti'

type GameOverProps = { winnerColor: Color, onRestart: () => void }

export const GameOver = ({ winnerColor, onRestart }: GameOverProps) => (
  <div style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: theme.ink, textAlign: 'center', padding: 20 }}>
    <Confetti />
    <div style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 18, letterSpacing: 2, color: theme.gold, opacity: 0.85 }}>TOCK</div>
    <div className="tock-bob" style={{ width: 84, height: 84, borderRadius: '50%', margin: '8px 0 12px', background: `radial-gradient(circle at 35% 30%, ${seatColor[winnerColor].light}, ${seatColor[winnerColor].dark})`, boxShadow: `0 0 40px rgba(${seatColor[winnerColor].soft},.65), 0 10px 20px rgba(0,0,0,.5)` }} />
    <div style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 30, color: seatColor[winnerColor].light }}>{colorLabel[winnerColor]} gagne&nbsp;!</div>
    <div style={{ fontSize: 13.5, color: '#c9cfdb', marginBottom: 26 }}>Toutes ses billes sont rentrées.</div>
    <button onClick={onRestart} style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 17, color: '#4a2f0c', background: `linear-gradient(${theme.goldButtonTop},${theme.goldButtonBottom})`, border: 'none', borderRadius: theme.radius.lg, padding: '14px 34px', boxShadow: `0 6px 0 ${theme.goldButtonLip}, 0 12px 20px rgba(0,0,0,.45)`, cursor: 'pointer' }}>Rejouer</button>
  </div>
)

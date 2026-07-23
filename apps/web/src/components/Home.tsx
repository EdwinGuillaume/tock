import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'

type HomeProps = { onPlay: () => void }

const marbleColorList: Color[] = ['red', 'green', 'yellow', 'blue']

const Marble = ({ color }: { color: Color }) => (
  <span style={{ position: 'relative', width: 30, height: 30, borderRadius: '50%', flex: 'none', background: `radial-gradient(circle at 35% 30%, ${seatColor[color].light}, ${seatColor[color].dark})`, boxShadow: `0 0 14px rgba(${seatColor[color].soft},.6), 0 4px 8px rgba(0,0,0,.4)` }}>
    <span style={{ position: 'absolute', top: 5, left: 7, width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,.8)', filter: 'blur(.5px)' }} />
  </span>
)

export const Home = ({ onPlay }: HomeProps) => (
  <div style={{ maxWidth: 360, margin: '0 auto', padding: '26px 20px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: theme.ink, textAlign: 'center' }}>
    <div style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 54, letterSpacing: 3, color: theme.gold, textShadow: '0 2px 0 #7a4e12, 0 6px 14px rgba(0,0,0,.5)', lineHeight: 1 }}>TOCK</div>
    <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#cdb277', marginTop: 6, opacity: 0.8 }}>course de billes</div>

    <div className="tock-float" style={{ width: 118, height: 166, borderRadius: theme.radius.card, background: theme.cardFace, boxShadow: theme.shadowFloat, transform: 'rotate(-5deg)', margin: '38px 0 34px', position: 'relative', color: theme.cardInkRed, fontFamily: theme.fontUi }}>
      <div style={{ position: 'absolute', top: 8, left: 10, fontSize: 17, fontWeight: 700, lineHeight: 1, textAlign: 'center' }}>
        <div>A</div>
        <div style={{ fontSize: 15 }}>♥</div>
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 17, fontWeight: 700, lineHeight: 1, textAlign: 'center', transform: 'rotate(180deg)' }}>
        <div>A</div>
        <div style={{ fontSize: 15 }}>♥</div>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>♥</div>
    </div>

    <div style={{ display: 'flex', gap: 14, marginBottom: 40 }}>
      {marbleColorList.map(color => <Marble key={color} color={color} />)}
    </div>

    <button onClick={onPlay}
      style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 19, color: '#4a2f0c', background: `linear-gradient(${theme.goldButtonTop}, ${theme.goldButtonBottom})`, border: 'none', borderRadius: theme.radius.lg, padding: '16px 34px', boxShadow: `0 6px 0 ${theme.goldButtonLip}, 0 12px 20px rgba(0,0,0,.45)`, cursor: 'pointer' }}>
      Nouvelle partie
    </button>
  </div>
)

import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'
import { colorLabel } from '../format'

type PassInterstitialProps = { color: Color, onReveal: () => void }

export const PassInterstitial = ({ color, onReveal }: PassInterstitialProps) => (
  <div style={{ position: 'fixed', inset: 0, background: theme.feltGradient, color: theme.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#cdb277', opacity: 0.8, marginBottom: 14 }}>passe le téléphone</div>
    <div className="tock-bob" style={{ width: 70, height: 70, borderRadius: '50%', marginBottom: 18, background: `radial-gradient(circle at 35% 30%, ${seatColor[color].light}, ${seatColor[color].dark})`, boxShadow: `0 0 34px rgba(${seatColor[color].soft},.6), 0 8px 18px rgba(0,0,0,.5)` }} />
    <div style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 24 }}>À <span style={{ color: seatColor[color].light }}>{colorLabel[color]}</span> de jouer</div>
    <div style={{ fontSize: 13, color: theme.inkDim, marginBottom: 26 }}>Passe l'appareil, puis révèle ta main.</div>
    <button onClick={onReveal} style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 17, color: '#4a2f0c', background: `linear-gradient(${theme.goldButtonTop},${theme.goldButtonBottom})`, border: 'none', borderRadius: theme.radius.lg, padding: '14px 34px', boxShadow: `0 6px 0 ${theme.goldButtonLip}, 0 12px 20px rgba(0,0,0,.45)`, cursor: 'pointer' }}>Révéler ma main</button>
    <div style={{ display: 'flex', marginTop: 26 }} aria-hidden>
      {Array.from({ length: 5 }, (_unused, index) => (
        <span key={index} style={{ width: 34, height: 48, borderRadius: 6, margin: '0 -4px', background: theme.cardBack, border: '1px solid rgba(255,216,115,.25)', boxShadow: '0 4px 8px rgba(0,0,0,.4)' }} />
      ))}
    </div>
  </div>
)

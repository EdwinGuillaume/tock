import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'

type PassInterstitialProps = { color: Color, onReveal: () => void }

export const PassInterstitial = ({ color, onReveal }: PassInterstitialProps) => (
  <div
    style={{
      position: 'fixed', inset: 0, background: theme.boardEdge, color: theme.text,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20
    }}
  >
    <h2>Pass to <span style={{ color: seatColor[color].light }}>{color}</span></h2>
    <button onClick={onReveal}>Tap to reveal your hand</button>
  </div>
)

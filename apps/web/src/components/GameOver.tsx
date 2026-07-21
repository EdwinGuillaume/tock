import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'

type GameOverProps = { winnerColor: Color, onRestart: () => void }

export const GameOver = ({ winnerColor, onRestart }: GameOverProps) => (
  <div style={{ color: theme.text, padding: 20, textAlign: 'center' }}>
    <h2 style={{ color: seatColor[winnerColor].light }}>{winnerColor} wins!</h2>
    <button onClick={onRestart}>Play again</button>
  </div>
)

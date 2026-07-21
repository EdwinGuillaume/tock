import { theme } from '../theme'

type SplitControlsProps = { remaining: number, canPlay: boolean, onUndo: () => void, onPlay: () => void }

export const SplitControls = ({ remaining, canPlay, onUndo, onPlay }: SplitControlsProps) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 6, color: theme.text }}>
    <span style={{ fontWeight: 700, color: remaining === 0 ? '#46a758' : '#e5b53a' }}>
      {remaining === 0 ? '0 left ✓' : `${remaining} steps left`}
    </span>
    <button onClick={onUndo}>Undo</button>
    <button onClick={onPlay} disabled={!canPlay}>▶ Play the 7</button>
  </div>
)

import { theme } from '../theme'
import { useAudio } from '../audio/useAudio'

// Socket style shared with RulesButton so the pair reads as one control cluster.
const iconStyle = {
  width: 22, height: 22, borderRadius: '50%', flex: 'none',
  border: '1px solid rgba(255,216,115,.35)', background: 'rgba(0,0,0,.25)',
  color: theme.gold, cursor: 'pointer', padding: 4,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
} as const

const SpeakerIcon = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
    <path d="M4 9H7.6L12 5V19L7.6 15H4Z" fill="currentColor" />
    {!muted && (
      <>
        <path d="M15 9.4Q17.3 12 15 14.6" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
        <path d="M17.2 7.3Q20.7 12 17.2 16.7" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      </>
    )}
    {muted && (
      <>
        <line x1="4.5" y1="4" x2="19.5" y2="20" stroke={theme.socketDark} strokeWidth={4} strokeLinecap="round" />
        <line x1="4.5" y1="4" x2="19.5" y2="20" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" />
      </>
    )}
  </svg>
)

export const MuteButton = () => {
  const { audioEnabled, muted, toggleMuted } = useAudio()
  if (!audioEnabled) return null
  return (
    <button
      type="button"
      aria-label={muted ? 'Activer le son' : 'Couper le son'}
      aria-pressed={muted}
      onClick={toggleMuted}
      style={iconStyle}
    >
      <SpeakerIcon muted={muted} />
    </button>
  )
}

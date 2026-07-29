import { useContext } from 'react'
import { AudioCtx, type AudioContextValue } from './AudioProvider'

// Inert fallback so components (and tests) render without a provider: audio off,
// play is a no-op. Production wraps App in AudioProvider (see main.tsx).
const INERT: AudioContextValue = {
  audioEnabled: false,
  muted: false,
  toggleMuted: () => {},
  play: () => {}
}

export const useAudio = (): AudioContextValue => useContext(AudioCtx) ?? INERT

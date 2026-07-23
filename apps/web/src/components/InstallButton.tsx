import { useState } from 'react'
import { theme } from '../theme'
import { useInstallPrompt } from '../pwa/useInstallPrompt'
import { isIosSafari, isStandalone } from '../pwa/platform'

const linkStyle = {
  fontFamily: theme.fontUi,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0.3,
  color: theme.goldDim,
  background: 'transparent',
  border: `1px solid ${theme.hairline}`,
  borderRadius: theme.radius.pill,
  padding: '9px 18px',
  marginTop: 18,
  cursor: 'pointer'
} as const

export const InstallButton = () => {
  const { canInstall, promptInstall } = useInstallPrompt()
  const [showHint, setShowHint] = useState(false)
  const iosEligible = isIosSafari() && !isStandalone()

  if (canInstall) {
    return (
      <button onClick={promptInstall} aria-label="Installer l'app" style={linkStyle}>
        Installer l'app
      </button>
    )
  }

  if (iosEligible) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button onClick={() => setShowHint(value => !value)} aria-label="Installer l'app" style={linkStyle}>
          Installer l'app
        </button>
        {showHint && (
          <p role="note" style={{ fontFamily: theme.fontUi, fontSize: 12, color: theme.inkDim, marginTop: 10, maxWidth: 240 }}>
            Appuie sur Partager, puis « Sur l'écran d'accueil ».
          </p>
        )}
      </div>
    )
  }

  return null
}

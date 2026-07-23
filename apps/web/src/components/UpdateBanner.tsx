import { theme } from '../theme'
import { useServiceWorkerUpdate } from '../pwa/useServiceWorkerUpdate'

export const UpdateBanner = () => {
  const { needRefresh, offlineReady, update, dismiss } = useServiceWorkerUpdate()
  if (!needRefresh && !offlineReady) return null

  return (
    <div role="status" style={{
      position: 'fixed',
      left: '50%',
      bottom: 16,
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      maxWidth: 'calc(100vw - 24px)',
      fontFamily: theme.fontUi,
      fontSize: 13,
      color: theme.ink,
      background: theme.feltPanel,
      border: `1px solid ${theme.hairline}`,
      borderRadius: theme.radius.pill,
      padding: '10px 12px 10px 18px',
      boxShadow: theme.shadowFloat,
      zIndex: 50
    }}>
      {needRefresh ? (
        <>
          <span>Nouvelle version disponible</span>
          <button onClick={update} style={ctaStyle}>Recharger</button>
        </>
      ) : (
        <>
          <span>Prête à jouer hors-ligne</span>
          <button onClick={dismiss} aria-label="Fermer" style={ctaStyle}>OK</button>
        </>
      )}
    </div>
  )
}

const ctaStyle = {
  fontFamily: theme.fontDisplay,
  fontWeight: 700,
  fontSize: 13,
  color: '#4a2f0c',
  background: `linear-gradient(${theme.goldButtonTop}, ${theme.goldButtonBottom})`,
  border: 'none',
  borderRadius: theme.radius.md,
  padding: '7px 14px',
  cursor: 'pointer',
  flex: 'none'
} as const

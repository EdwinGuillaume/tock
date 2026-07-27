import { useEffect, useRef, useState } from 'react'
import { isStandalone } from './platform'

export type InstallPrompt = {
  canInstall: boolean
  installed: boolean
  promptInstall: () => void
}

// Captures Chromium's beforeinstallprompt so the UI can offer an install button
// on demand. The deferred event is held until the user answers the native
// dialog, so the page does not change behind the open dialog. `installed`
// latches on an accepted choice or on appinstalled (which also covers
// installing from the browser's own menu) and is intentionally not persisted:
// an uninstall is undetectable, so a reload starts from a clean slate. iOS has
// no such event — the button handles that case via the platform check.
export const useInstallPrompt = (): InstallPrompt => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  // A consumed event cannot be prompted twice — Chromium throws on the second
  // call — so a double tap must be a no-op while the choice is pending.
  const pendingChoice = useRef(false)

  useEffect(() => {
    const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault()
      setDeferred(event)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const canInstall = deferred !== null && !installed && !isStandalone()

  const promptInstall = () => {
    if (!deferred || pendingChoice.current) return
    pendingChoice.current = true
    void deferred.prompt()
      .then(() => deferred.userChoice)
      .then(
        ({ outcome }) => {
          pendingChoice.current = false
          if (outcome === 'accepted') setInstalled(true)
          // Only clear the event this call started with — a newer
          // beforeinstallprompt may have arrived while this choice was
          // pending, and its event must survive.
          setDeferred(current => (current === deferred ? null : current))
        },
        () => {
          // A rejection from either prompt() or userChoice is treated as a
          // dismissal: it clears the offer and releases the pending guard so
          // the user can try again on a later beforeinstallprompt event. Some
          // rejections (e.g. a NotAllowedError from missing transient user
          // activation) don't actually consume the event, so in principle a
          // retry on the same event could work — we drop the offer anyway
          // rather than special-case that outcome.
          pendingChoice.current = false
          setDeferred(current => (current === deferred ? null : current))
        }
      )
  }

  return { canInstall, installed, promptInstall }
}

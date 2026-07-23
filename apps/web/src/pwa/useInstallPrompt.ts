import { useEffect, useState } from 'react'
import { isStandalone } from './platform'

export type InstallPrompt = {
  canInstall: boolean
  promptInstall: () => void
}

// Captures Chromium's beforeinstallprompt so the UI can offer an install button
// on demand. Hidden once installed or when already running standalone. iOS has
// no such event — the button handles that case via the platform check.
export const useInstallPrompt = (): InstallPrompt => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

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
    if (!deferred) return
    void deferred.prompt()
    setDeferred(null)
  }

  return { canInstall, promptInstall }
}

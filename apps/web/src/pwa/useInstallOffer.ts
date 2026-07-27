import { useInstallPrompt } from './useInstallPrompt'
import { isInAppBrowser, isIosSafari, isStandalone } from './platform'

export type InstallOffer = {
  canOfferInstall: boolean
  canInstall: boolean
  installed: boolean
  iosEligible: boolean
  inAppBrowser: boolean
  promptInstall: () => void
}

// Single source of truth for "can we offer an install right now": the Chromium
// prompt (canInstall) or the iOS Safari add-to-home-screen path (iosEligible).
// Also relays `installed` and `inAppBrowser` (embedded web views, e.g.
// Messenger, where installing is impossible) unchanged from their sources.
// See Home.tsx for how it prioritizes installed / canOfferInstall / inAppBrowser.
export const useInstallOffer = (): InstallOffer => {
  const { canInstall, installed, promptInstall } = useInstallPrompt()
  const iosEligible = isIosSafari() && !isStandalone()
  const inAppBrowser = isInAppBrowser()
  return { canOfferInstall: canInstall || iosEligible, canInstall, installed, iosEligible, inAppBrowser, promptInstall }
}

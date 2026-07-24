import { useInstallPrompt } from './useInstallPrompt'
import { isInAppBrowser, isIosSafari, isStandalone } from './platform'

export type InstallOffer = {
  canOfferInstall: boolean
  canInstall: boolean
  iosEligible: boolean
  inAppBrowser: boolean
  promptInstall: () => void
}

// Single source of truth for "can we offer an install right now": the Chromium
// prompt (canInstall) or the iOS Safari add-to-home-screen path (iosEligible).
// Home keys the play/install buttons off canOfferInstall so exactly one shows.
// inAppBrowser marks embedded web views (Messenger, etc.) where installing is
// impossible — Home nudges the user to reopen the link in the system browser.
export const useInstallOffer = (): InstallOffer => {
  const { canInstall, promptInstall } = useInstallPrompt()
  const iosEligible = isIosSafari() && !isStandalone()
  const inAppBrowser = isInAppBrowser()
  return { canOfferInstall: canInstall || iosEligible, canInstall, iosEligible, inAppBrowser, promptInstall }
}

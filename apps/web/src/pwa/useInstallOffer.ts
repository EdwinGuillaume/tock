import { useInstallPrompt } from './useInstallPrompt'
import { isIosSafari, isStandalone } from './platform'

export type InstallOffer = {
  canOfferInstall: boolean
  canInstall: boolean
  iosEligible: boolean
  promptInstall: () => void
}

// Single source of truth for "can we offer an install right now": the Chromium
// prompt (canInstall) or the iOS Safari add-to-home-screen path (iosEligible).
// Home keys the play/install buttons off canOfferInstall so exactly one shows.
export const useInstallOffer = (): InstallOffer => {
  const { canInstall, promptInstall } = useInstallPrompt()
  const iosEligible = isIosSafari() && !isStandalone()
  return { canOfferInstall: canInstall || iosEligible, canInstall, iosEligible, promptInstall }
}

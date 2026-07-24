import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InstallButton } from '../src/components/InstallButton'
import type { InstallOffer } from '../src/pwa/useInstallOffer'

const makeOffer = (over: Partial<InstallOffer>): InstallOffer => ({
  canOfferInstall: false,
  canInstall: false,
  iosEligible: false,
  promptInstall: vi.fn(),
  ...over
})

describe('InstallButton', () => {
  it('shows an install button when the prompt is available and installs on click', async () => {
    const promptInstall = vi.fn()
    render(<InstallButton offer={makeOffer({ canOfferInstall: true, canInstall: true, promptInstall })} />)
    await userEvent.click(screen.getByRole('button', { name: /installer l'app/i }))
    expect(promptInstall).toHaveBeenCalledOnce()
  })

  it('shows the iOS share hint when only iOS-eligible', async () => {
    render(<InstallButton offer={makeOffer({ canOfferInstall: true, iosEligible: true })} />)
    await userEvent.click(screen.getByRole('button', { name: /installer l'app/i }))
    expect(screen.getByText(/sur l'écran d'accueil/i)).toBeInTheDocument()
  })

  it('renders nothing when neither the prompt nor iOS is available', () => {
    const { container } = render(<InstallButton offer={makeOffer({})} />)
    expect(container).toBeEmptyDOMElement()
  })
})

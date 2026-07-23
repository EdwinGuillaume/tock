import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstallButton } from '../src/components/InstallButton'
import * as installHook from '../src/pwa/useInstallPrompt'

const setUserAgent = (value: string) =>
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true })

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

afterEach(() => {
  vi.restoreAllMocks()
  setUserAgent('node')
})

describe('InstallButton', () => {
  it('shows an install button when the prompt is available and installs on click', async () => {
    const promptInstall = vi.fn()
    vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: true, promptInstall })
    render(<InstallButton />)
    const button = screen.getByRole('button', { name: /installer l'app/i })
    await userEvent.click(button)
    expect(promptInstall).toHaveBeenCalledOnce()
  })

  it('shows the iOS share hint when no prompt but on iOS Safari', async () => {
    vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: false, promptInstall: vi.fn() })
    setUserAgent(IPHONE_UA)
    render(<InstallButton />)
    await userEvent.click(screen.getByRole('button', { name: /installer l'app/i }))
    expect(screen.getByText(/sur l'écran d'accueil/i)).toBeInTheDocument()
  })

  it('renders nothing when not installable and not iOS', () => {
    vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: false, promptInstall: vi.fn() })
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36')
    const { container } = render(<InstallButton />)
    expect(container).toBeEmptyDOMElement()
  })
})

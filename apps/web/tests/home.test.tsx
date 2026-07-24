import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Home } from '../src/components/Home'
import * as installHook from '../src/pwa/useInstallPrompt'

const setUserAgent = (value: string) =>
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true })

afterEach(() => {
  vi.restoreAllMocks()
  setUserAgent('node')
})

describe('Home', () => {
  it('shows the play button when no install can be offered', () => {
    vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: false, promptInstall: vi.fn() })
    render(<Home onPlay={vi.fn()} />)
    expect(screen.getByRole('button', { name: /nouvelle partie/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /installer l'app/i })).not.toBeInTheDocument()
  })

  it('shows only the install button, hiding play, when an install can be offered', () => {
    vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: true, promptInstall: vi.fn() })
    render(<Home onPlay={vi.fn()} />)
    expect(screen.getByRole('button', { name: /installer l'app/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /nouvelle partie/i })).not.toBeInTheDocument()
  })

  it('nudges to open in the system browser, keeping play, inside an in-app browser', () => {
    vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: false, promptInstall: vi.fn() })
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/430.0.0.0.0;]')
    render(<Home onPlay={vi.fn()} />)
    expect(screen.getByText(/dans ton navigateur/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nouvelle partie/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /installer l'app/i })).not.toBeInTheDocument()
  })
})

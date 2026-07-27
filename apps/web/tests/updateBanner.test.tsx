import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UpdateBanner } from '../src/components/UpdateBanner'
import { safeBottom } from '../src/layout'

const mockUpdate = vi.fn()
const state = { needRefresh: false, offlineReady: false, update: mockUpdate, dismiss: vi.fn() }

vi.mock('../src/pwa/useServiceWorkerUpdate', () => ({
  useServiceWorkerUpdate: () => state
}))

describe('UpdateBanner', () => {
  it('renders nothing when there is no update and no offline notice', () => {
    Object.assign(state, { needRefresh: false, offlineReady: false })
    const { container } = render(<UpdateBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the new-version banner and reloads on click', async () => {
    Object.assign(state, { needRefresh: true, offlineReady: false })
    render(<UpdateBanner />)
    expect(screen.getByText(/nouvelle version/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /recharger/i }))
    expect(mockUpdate).toHaveBeenCalledOnce()
  })

  it('shows the offline-ready notice', () => {
    Object.assign(state, { needRefresh: false, offlineReady: true })
    render(<UpdateBanner />)
    expect(screen.getByText(/hors-ligne/i)).toBeInTheDocument()
  })

  it('lifts the toast above the home indicator', () => {
    Object.assign(state, { needRefresh: true, offlineReady: false })
    render(<UpdateBanner />)
    // position: fixed resolves against the viewport, so no parent inset reaches
    // this banner -- it has to carry the inset itself.
    expect(screen.getByRole('status').style.bottom).toBe(safeBottom(16))
  })
})

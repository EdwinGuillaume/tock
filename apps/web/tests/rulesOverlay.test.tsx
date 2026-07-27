import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RulesOverlay } from '../src/components/RulesOverlay'
import { rulesGoal } from '../src/rulesContent'

describe('RulesOverlay', () => {
  it('renders the goal, a card rule and a special move when open', () => {
    render(<RulesOverlay open onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(rulesGoal)).toBeInTheDocument()
    expect(screen.getByText('avancer de 12')).toBeInTheDocument()
    expect(screen.getByText('Capture')).toBeInTheDocument()
  })

  it('renders the face-card mini-cards with their French letters', () => {
    render(<RulesOverlay open onClose={() => {}} />)
    expect(screen.getByText('R')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
    expect(screen.getByText('V')).toBeInTheDocument()
    expect(screen.queryByText('K')).toBeNull()
    expect(screen.queryByText('Q')).toBeNull()
    expect(screen.queryByText('J')).toBeNull()
  })

  it('renders nothing when closed', () => {
    render(<RulesOverlay open={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes via the ✕ button', async () => {
    const onClose = vi.fn()
    render(<RulesOverlay open onClose={onClose} />)
    await userEvent.click(screen.getByLabelText('Fermer les règles'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a backdrop tap but not on a panel tap', async () => {
    const onClose = vi.fn()
    render(<RulesOverlay open onClose={onClose} />)
    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('rules-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<RulesOverlay open onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

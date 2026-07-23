import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_RING_SIZE } from '@tock/core'
import { Setup } from '../src/components/Setup'

describe('Setup', () => {
  it('defaults to one bot opponent (seats 2 and 3 absent) and starts with that kindList', async () => {
    const onStart = vi.fn()
    render(<Setup onStart={onStart} />)
    // Seat 1 present as a bot; seats 2 and 3 are empty chairs to add.
    expect(screen.getByRole('button', { name: 'bot' })).toBeInTheDocument()
    expect(screen.getByLabelText('ajouter le joueur 2')).toBeInTheDocument()
    expect(screen.getByLabelText('ajouter le joueur 3')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Lancer la partie' }))
    expect(onStart).toHaveBeenCalledWith(['human', 'bot', 'inactive', 'inactive'], DEFAULT_RING_SIZE)
  })

  it('adds seat 2 as a bot and includes it', async () => {
    const onStart = vi.fn()
    render(<Setup onStart={onStart} />)
    await userEvent.click(screen.getByLabelText('ajouter le joueur 2'))
    await userEvent.click(screen.getByRole('button', { name: 'Lancer la partie' }))
    expect(onStart).toHaveBeenCalledWith(['human', 'bot', 'bot', 'inactive'], DEFAULT_RING_SIZE)
  })

  it('switches an added seat to human via the segmented control', async () => {
    const onStart = vi.fn()
    render(<Setup onStart={onStart} />)
    // Seat 1 is present; set its role to human. Scope the query to seat 1's row.
    const seatOne = screen.getByTestId('seat-1')
    await userEvent.click(within(seatOne).getByRole('button', { name: 'humain' }))
    await userEvent.click(screen.getByRole('button', { name: 'Lancer la partie' }))
    expect(onStart).toHaveBeenCalledWith(['human', 'human', 'inactive', 'inactive'], DEFAULT_RING_SIZE)
  })

  it('removes a seat back to absent', async () => {
    const onStart = vi.fn()
    render(<Setup onStart={onStart} />)
    await userEvent.click(screen.getByLabelText('retirer le joueur 1'))
    await userEvent.click(screen.getByRole('button', { name: 'Lancer la partie' }))
    expect(onStart).toHaveBeenCalledWith(['human', 'inactive', 'inactive', 'inactive'], DEFAULT_RING_SIZE)
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_RING_SIZE } from '@tock/core'
import { Setup } from '../src/components/Setup'

// Label scheme (see apps/web/src/components/Setup.tsx): each opponent seat (1, 2, 3)
// renders one button whose visible text is `seat ${seat}: ${kind}`, cycling
// human -> bot -> inactive -> human on each click. Seat 0 is always human and has
// no toggle. The default opponent kind list is ['bot', 'inactive', 'inactive'],
// matching the old single-bot-opponent default.
describe('Setup', () => {
  it('defaults to one bot opponent and starts with that kindList', async () => {
    const onStart = vi.fn()
    render(<Setup onStart={onStart} />)

    expect(screen.getByRole('button', { name: 'seat 1: bot' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'seat 2: inactive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'seat 3: inactive' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /start/i }))

    expect(onStart).toHaveBeenCalledWith(['human', 'bot', 'inactive', 'inactive'], DEFAULT_RING_SIZE)
  })

  it('cycles seat 1 to human (bot -> inactive -> human) and includes it in the kindList', async () => {
    const onStart = vi.fn()
    render(<Setup onStart={onStart} />)

    const seatOneButton = () => screen.getByRole('button', { name: /^seat 1:/ })

    await userEvent.click(seatOneButton())
    expect(seatOneButton()).toHaveTextContent('seat 1: inactive')

    await userEvent.click(seatOneButton())
    expect(seatOneButton()).toHaveTextContent('seat 1: human')

    await userEvent.click(screen.getByRole('button', { name: /start/i }))

    expect(onStart).toHaveBeenCalledWith(['human', 'human', 'inactive', 'inactive'], DEFAULT_RING_SIZE)
  })
})

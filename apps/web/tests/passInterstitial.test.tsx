import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PassInterstitial } from '../src/components/PassInterstitial'

describe('PassInterstitial', () => {
  it('names the next player and reveals on tap', async () => {
    const onReveal = vi.fn()
    render(<PassInterstitial color="green" onReveal={onReveal} />)

    expect(screen.getByText(/green/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /reveal/i }))
    expect(onReveal).toHaveBeenCalledTimes(1)
  })
})

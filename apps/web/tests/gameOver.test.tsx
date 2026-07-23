import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameOver } from '../src/components/GameOver'

describe('GameOver', () => {
  it('announces the winner and replays', async () => {
    const onRestart = vi.fn()
    render(<GameOver winnerColor="red" onRestart={onRestart} />)
    expect(screen.getByText(/gagne/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Rejouer' }))
    expect(onRestart).toHaveBeenCalledOnce()
  })
})

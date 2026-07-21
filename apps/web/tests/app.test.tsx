import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../src/components/App'

describe('App', () => {
  it('starts a game from Setup and shows the board and a 5-card hand', async () => {
    render(<App />)

    expect(screen.getByText('TOCK')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /start/i }))

    expect(screen.getByLabelText('board')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/^card-/)).toHaveLength(5)
  })
})

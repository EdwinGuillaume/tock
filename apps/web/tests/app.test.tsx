import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../src/components/App'

describe('App', () => {
  it('renders the home screen at start (wrapped in a transition)', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /nouvelle partie/i })).toBeInTheDocument()
  })

  it('starts a game from Home -> Setup and shows the board and a 5-card hand', async () => {
    render(<App />)

    expect(screen.getByText('TOCK')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /nouvelle partie/i }))
    await userEvent.click(await screen.findByRole('button', { name: /lancer la partie/i }))

    expect(await screen.findByLabelText('board')).toBeInTheDocument()
    expect(await screen.findAllByLabelText(/^card-/)).toHaveLength(5)
  })
})

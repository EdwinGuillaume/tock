import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GameLog } from '../src/components/GameLog'

describe('GameLog', () => {
  it('shows only the last line collapsed', () => {
    render(<GameLog logList={['un', 'deux', 'trois']} />)
    expect(screen.getByTestId('game-log')).toHaveTextContent('trois')
    expect(screen.queryByText('un')).toBeNull()
  })

  it('reveals the full history when expanded', async () => {
    render(<GameLog logList={['un', 'deux', 'trois']} />)
    await userEvent.click(screen.getByLabelText("afficher l'historique"))
    expect(screen.getByText('un')).toBeInTheDocument()
    expect(screen.getByText('deux')).toBeInTheDocument()
  })
})

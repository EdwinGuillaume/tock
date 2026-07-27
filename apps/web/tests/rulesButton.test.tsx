import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RulesButton } from '../src/components/RulesButton'

describe('RulesButton', () => {
  it('fires onClick and exposes an accessible label', async () => {
    const onClick = vi.fn()
    render(<RulesButton onClick={onClick} />)
    const button = screen.getByLabelText('Ouvrir les règles')
    expect(button).toHaveTextContent('?')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders the word "Règles" in the text variant', () => {
    render(<RulesButton onClick={() => {}} variant="text" />)
    expect(screen.getByLabelText('Ouvrir les règles')).toHaveTextContent('Règles')
  })
})

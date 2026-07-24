import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Hint } from '../src/components/Hint'

describe('Hint', () => {
  it('renders the text', () => {
    render(<Hint text="choisis une carte" />)
    expect(screen.getByText('choisis une carte')).toBeInTheDocument()
  })

  it('renders nothing when the text is empty', () => {
    const { container } = render(<Hint text="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('wraps long lines instead of clipping (no nowrap)', () => {
    render(<Hint text="le Roi sort une bille ou l'avance de 13" />)
    const chip = screen.getByText("le Roi sort une bille ou l'avance de 13")
    expect(chip.style.whiteSpace).not.toBe('nowrap')
    expect(chip.style.textAlign).toBe('center')
  })
})

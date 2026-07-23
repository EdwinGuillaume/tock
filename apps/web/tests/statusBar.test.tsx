import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBar } from '../src/components/StatusBar'

describe('StatusBar', () => {
  it('renders prompt text, draw count, and discard count', () => {
    render(<StatusBar turnColor="red" drawCount={18} discardCount={6} prompt="À toi de jouer" />)
    expect(screen.getByText('À toi de jouer')).toBeInTheDocument()
    expect(screen.getByText('Pioche')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('Défausse')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })
})

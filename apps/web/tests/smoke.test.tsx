import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../src/components/App'

describe('App shell', () => {
  it('renders the game title', () => {
    render(<App />)
    expect(screen.getByText('TOCK')).toBeInTheDocument()
  })
})

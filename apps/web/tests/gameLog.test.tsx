import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameLog } from '../src/components/GameLog'

describe('GameLog', () => {
  it('renders every log line and marks the scroll region', () => {
    render(<GameLog logList={['a', 'b', 'c', 'd', 'e']} />)
    expect(screen.getByText('e')).toBeInTheDocument()
    expect(screen.getByTestId('game-log')).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Color } from '@tock/core'
import { GameLog } from '../src/components/GameLog'
import type { LogEntry } from '../src/format'

const line = (color: Color, text: string): LogEntry => [{ color }, ` ${text}`]

describe('GameLog', () => {
  it('shows only the last line collapsed', () => {
    render(<GameLog logList={[line('red', 'un'), line('green', 'deux'), line('purple', 'trois')]} />)
    expect(screen.getByTestId('game-log')).toHaveTextContent('trois')
    expect(screen.queryByText('un')).toBeNull()
  })

  it('reveals the full history when expanded', async () => {
    render(<GameLog logList={[line('red', 'un'), line('green', 'deux'), line('purple', 'trois')]} />)
    await userEvent.click(screen.getByLabelText("afficher l'historique"))
    expect(screen.getByText('un')).toBeInTheDocument()
    expect(screen.getByText('deux')).toBeInTheDocument()
  })

  it("renders each player's name in its own seat colour", () => {
    render(<GameLog logList={[line('red', 'joue')]} />)
    expect(screen.getByText('Rouge').style.color).toBeTruthy()
  })

  it('scrolls the history to its bottom when opened', async () => {
    // jsdom performs no layout, so give the scroll container a measurable height.
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 500 })
    render(<GameLog logList={[line('red', 'un'), line('green', 'deux'), line('purple', 'trois')]} />)
    await userEvent.click(screen.getByLabelText("afficher l'historique"))
    expect(screen.getByTestId('log-history').scrollTop).toBe(500)
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createGame, marbleId } from '@tock/core'
import { Board } from '../src/components/Board'

describe('Board', () => {
  it('renders one marble node per marble in play', () => {
    const state = createGame(['human', 'bot'], 48)
    render(<Board state={state} ghostList={[]} onGhost={() => {}} />)
    // 2 active seats * 4 marbles = 8 marbles
    expect(screen.getAllByTestId(/^marble-/)).toHaveLength(8)
    expect(screen.getByTestId(`marble-${marbleId(0, 0)}`)).toBeInTheDocument()
  })

  it('draws the wood board backdrop: a tile rect for every ring cell', () => {
    const state = createGame(['human', 'bot'], 48)
    const { container } = render(<Board state={state} ghostList={[]} onGhost={() => {}} />)
    // The ring alone is 48 tiles; finish lanes and home pads add more. Before the
    // backdrop existed the board had zero <rect> nodes (only marble circles).
    expect(container.querySelectorAll('rect').length).toBeGreaterThanOrEqual(48)
  })

  it('renders a ghost per entry and fires onGhost with its key when tapped', async () => {
    const state = createGame(['human', 'bot'], 48)
    const onGhost = vi.fn()
    render(
      <Board
        state={state}
        ghostList={[{ key: 'g1', cx: 50, cy: 50, label: '7' }]}
        onGhost={onGhost}
      />
    )
    await userEvent.click(screen.getByLabelText('ghost-7'))
    expect(onGhost).toHaveBeenCalledWith('g1')
  })
})

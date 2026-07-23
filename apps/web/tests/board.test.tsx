import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createGame, marbleId } from '@tock/core'
import type { MarbleId } from '@tock/core'
import { Board } from '../src/components/Board'

describe('Board', () => {
  it('renders one marble node per marble in play', () => {
    const state = createGame(['human', 'bot'], 48)
    render(<Board state={state} ghostList={[]} onGhost={() => {}} />)
    // 2 active seats * 4 marbles = 8 marbles
    expect(screen.getAllByTestId(/^marble-/)).toHaveLength(8)
    expect(screen.getByTestId(`marble-${marbleId(0, 0)}`)).toBeInTheDocument()
  })

  it('renders a continuous ring channel', () => {
    const state = createGame(['human', 'bot'], 48)
    const { container } = render(<Board state={state} ghostList={[]} onGhost={() => {}} />)
    // The felt board draws the ring as one continuous channel path rather than
    // per-cell tiles; marble rendering must still be unaffected.
    const channel = container.querySelector('path[data-role="ring-channel"]')
    expect(channel).not.toBeNull()
    expect(screen.getAllByTestId(/^marble-/)).toHaveLength(8)
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

  it('highlights the selected marble with a selection ring when selectedMarbleId is set', () => {
    const state = createGame(['human', 'bot'], 48)
    const selected: MarbleId = marbleId(0, 0)
    const { container } = render(<Board state={state} ghostList={[]} onGhost={() => {}} selectedMarbleId={selected} />)
    expect(container.querySelector('[data-selected="true"]')).not.toBeNull()
  })

  it('shows no selection ring when selectedMarbleId is absent', () => {
    const state = createGame(['human', 'bot'], 48)
    const { container } = render(<Board state={state} ghostList={[]} onGhost={() => {}} />)
    expect(container.querySelector('[data-selected="true"]')).toBeNull()
  })
})

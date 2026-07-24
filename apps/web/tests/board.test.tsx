import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createGame, marbleId } from '@tock/core'
import type { MarbleId } from '@tock/core'
import { Board } from '../src/components/Board'
import { place } from './support'

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

  it('keeps a marble node mounted when it stops being selectable, so a 7-split move can glide', () => {
    // During a 7-split the participating marbles are selectable (wrapped for tap);
    // once the move commits and the turn returns to card-picking they are no longer
    // selectable and move to their destination. The marble's DOM node must PERSIST
    // across that change so its CSS transform transition animates the glide instead
    // of the marble snapping into place.
    const id: MarbleId = marbleId(0, 0)
    const start = place(createGame(['human', 'bot'], 48), id, { zone: 'track', index: 10 })
    const { rerender } = render(
      <Board state={start} ghostList={[]} onGhost={() => {}} selectableMarbleIds={[id]} onSelectMarble={() => {}} />
    )
    const before = screen.getByTestId(`marble-${id}`)

    const moved = place(start, id, { zone: 'track', index: 17 })
    rerender(<Board state={moved} ghostList={[]} onGhost={() => {}} />)
    const after = screen.getByTestId(`marble-${id}`)

    expect(after).toBe(before)
  })
})

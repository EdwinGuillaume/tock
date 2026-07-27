import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Card } from '@tock/core'
import { Hand } from '../src/components/Hand'
import { CARD_HEIGHT, CARD_SELECTED_LIFT, CARD_SELECTED_SCALE, HAND_BOTTOM_GAP, HAND_HEIGHT, safeBottom } from '../src/layout'

const hand: Card[] = [
  { rank: 'A', suit: 'clubs' },
  { rank: '7', suit: 'hearts' }
]

describe('Hand', () => {
  it('renders a button per card and fires onSelect with its index', async () => {
    const onSelect = vi.fn()
    render(<Hand hand={hand} playableList={[true, true]} selectedIndex={-1} onSelect={onSelect} />)
    await userEvent.click(screen.getByLabelText('card-7-hearts'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('marks unplayable cards as disabled', () => {
    render(<Hand hand={hand} playableList={[true, false]} selectedIndex={-1} onSelect={() => {}} />)
    expect(screen.getByLabelText('card-7-hearts')).toBeDisabled()
  })

  it('shows the suit glyph and keeps the card aria-label', () => {
    render(<Hand hand={[{ rank: 'A', suit: 'hearts' }]} playableList={[true]} selectedIndex={-1} onSelect={() => {}} />)
    const card = screen.getByLabelText('card-A-hearts')
    expect(card).toHaveTextContent('A')
    expect(card).toHaveTextContent('♥')
  })

  it('dims a playable card but keeps it enabled when discardMode is on', () => {
    render(
      <Hand
        hand={[{ rank: '5', suit: 'clubs' }]}
        playableList={[true]}
        selectedIndex={-1}
        discardMode
        onSelect={() => {}}
      />
    )
    const button = screen.getByLabelText('card-5-clubs')
    expect(button).toBeEnabled()
    expect(button.style.opacity).toBe('0.42')
  })

  it('grows its reserved box with the bottom inset so the cards stay inside it', () => {
    const { container } = render(<Hand hand={hand} playableList={[true, true]} selectedIndex={-1} onSelect={() => {}} />)
    const root = container.firstElementChild as HTMLElement
    // Height AND padding must both carry the inset so it cancels: the content box
    // left for the cards stays a device-independent HAND_HEIGHT - HAND_BOTTOM_GAP.
    // Asserting only the height would still pass if the padding's inset were
    // dropped -- which is the exact shape of the bug being fixed.
    expect(root.style.height).toBe(safeBottom(HAND_HEIGHT))
    expect(root.style.paddingBottom).toBe(safeBottom(HAND_BOTTOM_GAP))
  })

  it('sizes cards from the shared CARD_HEIGHT token', () => {
    render(<Hand hand={hand} playableList={[true, true]} selectedIndex={-1} onSelect={() => {}} />)
    expect(screen.getByLabelText('card-A-clubs').style.height).toBe(`${CARD_HEIGHT}px`)
  })

  it('lifts the selected card by the CARD_SELECTED_LIFT token', () => {
    render(<Hand hand={hand} playableList={[true, true]} selectedIndex={0} onSelect={() => {}} />)
    expect(screen.getByLabelText('card-A-clubs').style.transform).toContain(`translateY(${-CARD_SELECTED_LIFT}px)`)
  })

  it('scales the selected card by the CARD_SELECTED_SCALE token', () => {
    render(<Hand hand={hand} playableList={[true, true]} selectedIndex={0} onSelect={() => {}} />)
    expect(screen.getByLabelText('card-A-clubs').style.transform).toContain(`scale(${CARD_SELECTED_SCALE})`)
  })
})

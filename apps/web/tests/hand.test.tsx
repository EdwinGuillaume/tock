import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Card } from '@tock/core'
import { Hand } from '../src/components/Hand'

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
})

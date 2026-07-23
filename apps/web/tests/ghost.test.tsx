import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Ghost } from '../src/components/Ghost'

describe('Ghost', () => {
  it('keeps the ghost-<label> aria-label and fires onSelect', async () => {
    const onSelect = vi.fn()
    render(<svg><Ghost cx={5} cy={5} label="3" onSelect={onSelect} /></svg>)
    const node = screen.getByLabelText('ghost-3')
    await userEvent.click(node)
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('renders echo rings', () => {
    const { container } = render(<svg><Ghost cx={5} cy={5} onSelect={() => {}} /></svg>)
    expect(container.querySelectorAll('.tock-echo').length).toBe(2)
  })
})

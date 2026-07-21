import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SplitControls } from '../src/components/SplitControls'

describe('SplitControls', () => {
  it('shows the remaining budget and disables Play until 0', () => {
    render(<SplitControls remaining={4} canPlay={false} onUndo={() => {}} onPlay={() => {}} />)
    expect(screen.getByText(/4/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play/i })).toBeDisabled()
  })

  it('fires onPlay when enabled and clicked', async () => {
    const onPlay = vi.fn()
    render(<SplitControls remaining={0} canPlay onUndo={() => {}} onPlay={onPlay} />)
    await userEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(onPlay).toHaveBeenCalled()
  })
})

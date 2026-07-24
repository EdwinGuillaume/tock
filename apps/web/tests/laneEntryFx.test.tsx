import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LaneEntryFx } from '../src/components/LaneEntryFx'

describe('LaneEntryFx', () => {
  it('renders the glow, comet and echo for the given seat and finish cell', () => {
    const { getByTestId } = render(<svg><LaneEntryFx owner={0} finishIndex={0} ringSize={48} /></svg>)
    expect(getByTestId('lane-fx-0-0')).toBeInTheDocument()
    expect(getByTestId('lane-fx-glow')).toBeInTheDocument()
    expect(getByTestId('lane-fx-comet')).toBeInTheDocument()
    expect(getByTestId('lane-fx-echo')).toBeInTheDocument()
  })

  it('sets the comet travel vector as CSS custom properties', () => {
    const { getByTestId } = render(<svg><LaneEntryFx owner={0} finishIndex={0} ringSize={48} /></svg>)
    const comet = getByTestId('lane-fx-comet')
    expect(comet.style.getPropertyValue('--lx')).not.toBe('')
    expect(comet.style.getPropertyValue('--ly')).not.toBe('')
  })
})

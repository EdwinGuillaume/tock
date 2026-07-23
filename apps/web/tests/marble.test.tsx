import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Marble } from '../src/components/Marble'

const wrap = (node: React.ReactNode) => render(<svg>{node}</svg>)

describe('Marble', () => {
  it('renders the marble circle with its test id and a highlight', () => {
    const { container } = wrap(<Marble color="red" cx={10} cy={10} testId="marble-p0m0" />)
    expect(container.querySelector('[data-testid="marble-p0m0"]')).not.toBeNull()
    expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2)
  })

  it('adds a selection ring when selected', () => {
    const { container } = wrap(<Marble color="red" cx={10} cy={10} selected />)
    expect(container.querySelector('[data-selected="true"]')).not.toBeNull()
  })
})

import { render } from 'ink-testing-library'
import { expect, test } from 'vitest'
import { Hand } from '../../src/ui/Hand'
import { card } from '../support'

const strip = (frame: string | undefined): string => (frame ?? '').replace(/\[[0-9;]*m/g, '')

test('renders every card rank in the hand', () => {
  const hand = [card('A'), card('7'), card('K')]
  const { lastFrame } = render(<Hand hand={hand} cursor={0} active={true} />)
  const text = strip(lastFrame())
  expect(text).toContain('A')
  expect(text).toContain('7')
  expect(text).toContain('K')
})

test('dims unplayable cards but not playable ones', () => {
  const hand = [card('A'), card('7')]
  const { lastFrame } = render(<Hand hand={hand} cursor={0} active={true} playable={[true, false]} />)
  const rawFrame = lastFrame() ?? ''
  expect(rawFrame).toContain('\x1b[2m')
})

test('does not dim any card when all are playable or playable is omitted', () => {
  const hand = [card('A'), card('7')]
  const { lastFrame: allPlayableFrame } = render(<Hand hand={hand} cursor={0} active={true} playable={[true, true]} />)
  expect(allPlayableFrame() ?? '').not.toContain('\x1b[2m')

  const { lastFrame: noPlayableProp } = render(<Hand hand={hand} cursor={0} active={true} />)
  expect(noPlayableProp() ?? '').not.toContain('\x1b[2m')
})

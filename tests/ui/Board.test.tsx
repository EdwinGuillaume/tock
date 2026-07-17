import { render } from 'ink-testing-library'
import { expect, test } from 'vitest'
import { createGame } from '../../src/engine'
import { Board } from '../../src/ui/Board'
import { place } from '../support'

const strip = (frame: string | undefined): string => (frame ?? '').replace(/\[[0-9;]*m/g, '')

test('renders a marble on the ring at its start cell', () => {
  let state = createGame(['human', 'bot'])
  state = place(state, 'p0m0', { zone: 'track', index: 0 })
  const { lastFrame } = render(<Board state={state} />)
  const text = strip(lastFrame())
  // The board has the centre marker and at least one marble glyph.
  expect(text).toContain('✦')
  expect(text).toContain('●')
})

test('renders a white square at a landing-preview cell', () => {
  let state = createGame(['human', 'bot'])
  state = place(state, 'p0m0', { zone: 'track', index: 0 })
  const { lastFrame } = render(
    <Board state={state} highlight={[{ cell: { row: 12, col: 1 }, kind: 'landing' }]} />
  )
  expect(strip(lastFrame())).toContain('□')
})

test('renders 13 rows', () => {
  const state = createGame(['human', 'bot', 'bot', 'bot'])
  const { lastFrame } = render(<Board state={state} />)
  expect(strip(lastFrame()).split('\n').length).toBeGreaterThanOrEqual(13)
})

test('renders active-seat nests with home counts and omits inactive seats', () => {
  // human (seat 0/red) + one bot (seat 1/green); seats 2/3 inactive.
  let state = createGame(['human', 'bot'])
  state = place(state, 'p0m0', { zone: 'track', index: 0 }) // red: 3 home, 1 out
  const { lastFrame } = render(<Board state={state} />)
  const text = strip(lastFrame())
  expect(text).toContain('red')          // human nest labelled
  expect(text).toContain('green')        // active bot nest labelled
  expect(text).not.toContain('yellow')   // inactive seat: no nest
  expect(text).not.toContain('blue')     // inactive seat: no nest
  expect(text).toContain('○')            // red has one marble out -> an empty nest slot
})

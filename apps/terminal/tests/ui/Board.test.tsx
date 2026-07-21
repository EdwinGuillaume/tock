import { render } from 'ink-testing-library'
import { expect, test } from 'vitest'
import { createGame } from '@tock/core'
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

test('renders a 19x19 board with a centre marker for a 72-cell game', () => {
  let state = createGame(['human', 'bot', 'bot', 'bot'], 72)
  state = place(state, 'p0m0', { zone: 'track', index: 0 }) // red start at bottom-mid
  const { lastFrame } = render(<Board state={state} />)
  const text = strip(lastFrame())
  expect(text.split('\n').length).toBeGreaterThanOrEqual(19)
  expect(text).toContain('✦') // centre marker still drawn on the bigger grid
  expect(text).toContain('●') // the placed marble
})

const countChar = (text: string, char: string): number => text.split(char).length - 1

test('renders active-seat nests in the corners and omits inactive seats', () => {
  // human (seat 0/red) + one bot (seat 1/green); seats 2/3 inactive.
  let state = createGame(['human', 'bot'])
  state = place(state, 'p0m0', { zone: 'track', index: 0 }) // red: 3 home, 1 out
  const { lastFrame } = render(<Board state={state} />)
  const text = strip(lastFrame())
  // Red has one marble out -> exactly one empty nest slot.
  expect(countChar(text, '○')).toBe(1)
  // 3 red home + 4 green home + 1 red on track = 8 filled dots; inactive seats add none.
  expect(countChar(text, '●')).toBe(8)
  // No margin colour labels any more.
  expect(text).not.toContain('red')
  expect(text).not.toContain('green')
})

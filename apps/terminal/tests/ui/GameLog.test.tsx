import { render } from 'ink-testing-library'
import { expect, test } from 'vitest'
import { GameLog } from '../../src/ui/GameLog'

// Strip the full ANSI escape (ESC + CSI), not just the bracket body, so exact
// matches don't trip over the leftover ESC byte that dimColor emits.
const ansi = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')
const strip = (frame: string | undefined): string => (frame ?? '').replace(ansi, '')

// ink pads every line to the widest line's width, so trim the trailing padding.
const lines = (frame: string | undefined): string[] =>
  strip(frame).split('\n').map(line => line.trimEnd())

test('lists entries chronologically with the newest at the bottom', () => {
  const { lastFrame } = render(<GameLog logList={['first', 'second', 'third']} />)
  expect(lines(lastFrame())).toEqual(['first', 'second', 'third'])
})

test('keeps only the last `max` entries', () => {
  const logList = Array.from({ length: 20 }, (unused, index) => `move ${index}`)
  const { lastFrame } = render(<GameLog logList={logList} max={13} />)
  const lineList = lines(lastFrame())
  expect(lineList).toHaveLength(13)
  expect(lineList[0]).toBe('move 7') // 20 - 13 = 7 oldest dropped
  expect(lineList[12]).toBe('move 19') // newest at the bottom
})

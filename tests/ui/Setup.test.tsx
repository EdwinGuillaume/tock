import { render } from 'ink-testing-library'
import { expect, test, vi } from 'vitest'
import { Setup } from '../../src/ui/Setup'

const tick = () => new Promise(resolve => setTimeout(resolve, 100))
const strip = (frame: string | undefined): string => (frame ?? '').replace(/\[[0-9;]*m/g, '')
const RIGHT = '[C'
const DOWN = '[B'

test('renders the opponent choices and starts with the selected count on the default 48 board', async () => {
  const onStart = vi.fn()
  const { lastFrame, stdin } = render(<Setup onStart={onStart} />)
  expect(strip(lastFrame())).toContain('opponents')
  stdin.write(RIGHT) // -> 2 opponents (default was 1)
  await tick()
  await tick()
  stdin.write('\r') // enter
  await tick()
  expect(onStart).toHaveBeenCalledWith(2, 48)
})

test('offers a board-size choice and starts on the chosen 72-cell ring', async () => {
  const onStart = vi.fn()
  const { lastFrame, stdin } = render(<Setup onStart={onStart} />)
  expect(strip(lastFrame()).toLowerCase()).toContain('board')
  stdin.write(DOWN) // focus the board-size field
  await tick()
  stdin.write(RIGHT) // -> 72 (from the default 48)
  await tick()
  await tick()
  stdin.write('\r') // enter
  await tick()
  expect(onStart).toHaveBeenCalledWith(1, 72)
})

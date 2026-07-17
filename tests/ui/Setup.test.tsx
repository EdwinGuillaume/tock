import { render } from 'ink-testing-library'
import { expect, test, vi } from 'vitest'
import { Setup } from '../../src/ui/Setup'

const tick = () => new Promise(resolve => setTimeout(resolve, 100))

test('renders the opponent choices and starts with the selected count', async () => {
  const onStart = vi.fn()
  const { lastFrame, stdin } = render(<Setup onStart={onStart} />)
  expect((lastFrame() ?? '').replace(/\[[0-9;]*m/g, '')).toContain('opponents')
  stdin.write('[C') // right arrow -> 2 opponents (default was 1)
  await tick()
  await tick()
  stdin.write('\r') // enter
  await tick()
  expect(onStart).toHaveBeenCalledWith(2)
})

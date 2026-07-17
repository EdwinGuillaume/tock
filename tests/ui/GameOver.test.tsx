import { render } from 'ink-testing-library'
import { expect, test, vi } from 'vitest'
import { GameOver } from '../../src/ui/GameOver'

const tick = () => new Promise(resolve => setTimeout(resolve, 30))

test('announces the winner and restarts on r', async () => {
  const onRestart = vi.fn()
  const onQuit = vi.fn()
  const { lastFrame, stdin } = render(<GameOver winnerColor="blue" onRestart={onRestart} onQuit={onQuit} />)
  expect((lastFrame() ?? '').replace(/\[[0-9;]*m/g, '')).toContain('blue')
  stdin.write('r')
  await tick()
  expect(onRestart).toHaveBeenCalledTimes(1)
})

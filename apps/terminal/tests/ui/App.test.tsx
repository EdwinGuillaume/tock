import { render } from 'ink-testing-library'
import { expect, test } from 'vitest'
import { App } from '../../src/ui/App'

const strip = (frame: string | undefined): string => (frame ?? '').replace(/\[[0-9;]*m/g, '')
const tick = () => new Promise(resolve => setTimeout(resolve, 50))

test('starts on the setup screen', () => {
  const { lastFrame } = render(<App />)
  expect(strip(lastFrame())).toContain('opponents')
})

test('starting a game renders the board', async () => {
  const { lastFrame, stdin } = render(<App />)
  stdin.write('\r') // start with the default opponent count
  await tick()
  expect(strip(lastFrame())).toContain('✦') // board centre marker
})

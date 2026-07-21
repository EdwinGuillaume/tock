import { render } from 'ink-testing-library'
import { expect, test } from 'vitest'
import { Status } from '../../src/ui/Status'

const strip = (frame: string | undefined): string => (frame ?? '').replace(/\[[0-9;]*m/g, '')

test('shows the current turn and prompt', () => {
  const { lastFrame } = render(
    <Status turnColor="green" isHuman={false} prompt="green is thinking…" />
  )
  const text = strip(lastFrame())
  expect(text).toContain('green')
  expect(text).toContain('green is thinking…')
})

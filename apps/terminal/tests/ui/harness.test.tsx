import { render } from 'ink-testing-library'
import { Text } from 'ink'
import { expect, test } from 'vitest'

test('ink test harness renders text', () => {
  const { lastFrame } = render(<Text>harness ok</Text>)
  expect(lastFrame()).toContain('harness ok')
})

import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    // Force chalk/ink to emit ANSI codes even though the test runner is not a
    // TTY, so tests can assert on raw (unstripped) styled output (e.g. dimColor).
    env: { FORCE_COLOR: '1' }
  }
})

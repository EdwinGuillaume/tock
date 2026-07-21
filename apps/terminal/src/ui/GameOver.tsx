import { Box, Text, useInput } from 'ink'
import type { Color } from '@tock/core'
import { inkColor } from './theme'

type GameOverProps = { winnerColor: Color, onRestart: () => void, onQuit: () => void }

export const GameOver = ({ winnerColor, onRestart, onQuit }: GameOverProps) => {
  useInput(input => {
    if (input === 'r') onRestart()
    if (input === 'q') onQuit()
  })
  return (
    <Box flexDirection="column" borderStyle="double" paddingX={2} paddingY={1}>
      <Box>
        <Text>🏆 </Text>
        <Text color={inkColor[winnerColor]} bold>{winnerColor}</Text>
        <Text> wins!</Text>
      </Box>
      <Text dimColor>r play again · q quit</Text>
    </Box>
  )
}

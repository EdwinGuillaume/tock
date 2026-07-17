import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

type SetupProps = { onStart: (botCount: number) => void }

const choiceList = [1, 2, 3]

export const Setup = ({ onStart }: SetupProps) => {
  const [cursor, setCursor] = useState(0)
  useInput((input, inputKey) => {
    if (inputKey.leftArrow) setCursor(current => Math.max(0, current - 1))
    if (inputKey.rightArrow) setCursor(current => Math.min(choiceList.length - 1, current + 1))
    if (inputKey.return) onStart(choiceList[cursor] ?? 1)
  })
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      <Text bold>TOCK</Text>
      <Text> </Text>
      <Text>Number of opponents:</Text>
      <Box>
        {choiceList.map((count, index) => (
          <Text key={count} inverse={index === cursor}> {count} </Text>
        ))}
      </Box>
      <Text dimColor>← → choose · ⏎ start</Text>
    </Box>
  )
}

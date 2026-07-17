import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import { DEFAULT_RING_SIZE, RING_SIZE_OPTIONS } from '../engine'

type SetupProps = { onStart: (botCount: number, ringSize: number) => void }

const opponentChoiceList = [1, 2, 3]
const sizeChoiceList = RING_SIZE_OPTIONS

// Two stacked fields: opponent count and board size. Up/down move between
// fields, left/right change the focused field's value, Enter starts the game.
export const Setup = ({ onStart }: SetupProps) => {
  const [field, setField] = useState(0)
  const [opponentCursor, setOpponentCursor] = useState(0)
  const [sizeCursor, setSizeCursor] = useState(0)

  useInput((input, inputKey) => {
    if (inputKey.upArrow) setField(0)
    if (inputKey.downArrow) setField(1)
    if (inputKey.leftArrow) {
      if (field === 0) setOpponentCursor(current => Math.max(0, current - 1))
      else setSizeCursor(current => Math.max(0, current - 1))
    }
    if (inputKey.rightArrow) {
      if (field === 0) setOpponentCursor(current => Math.min(opponentChoiceList.length - 1, current + 1))
      else setSizeCursor(current => Math.min(sizeChoiceList.length - 1, current + 1))
    }
    if (inputKey.return) {
      onStart(opponentChoiceList[opponentCursor] ?? 1, sizeChoiceList[sizeCursor] ?? DEFAULT_RING_SIZE)
    }
  })

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      <Text bold>TOCK</Text>
      <Text> </Text>
      <Text>{field === 0 ? '▸ ' : '  '}Number of opponents:</Text>
      <Box>
        {opponentChoiceList.map((count, index) => (
          <Text key={count} inverse={field === 0 && index === opponentCursor}> {count} </Text>
        ))}
      </Box>
      <Text> </Text>
      <Text>{field === 1 ? '▸ ' : '  '}Board size (cells):</Text>
      <Box>
        {sizeChoiceList.map((size, index) => (
          <Text key={size} inverse={field === 1 && index === sizeCursor}> {size} </Text>
        ))}
      </Box>
      <Text dimColor>↑↓ field · ← → choose · ⏎ start</Text>
    </Box>
  )
}

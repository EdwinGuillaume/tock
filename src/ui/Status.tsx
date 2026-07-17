import { Box, Text } from 'ink'
import type { Color } from '../engine'
import { inkColor } from './theme'

type StatusProps = { turnColor: Color, isHuman: boolean, prompt: string }

export const Status = ({ turnColor, isHuman, prompt }: StatusProps) => (
  <Box>
    <Text color={inkColor[turnColor]} bold>{turnColor}</Text>
    <Text>{isHuman ? ' (you) — ' : ' — '}{prompt}</Text>
  </Box>
)

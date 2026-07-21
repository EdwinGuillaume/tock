import { Box, Text } from 'ink'

const DEFAULT_MAX = 13

type GameLogProps = { logList: string[], max?: number }

// Chat-style action log: entries are chronological with the newest at the bottom.
// Older lines climb as new actions arrive and the oldest scroll off once the list
// passes `max` (capped to the board's height so the log never outgrows the window).
export const GameLog = ({ logList, max = DEFAULT_MAX }: GameLogProps) => {
  const visibleList = logList.slice(-max)
  const offset = logList.length - visibleList.length
  return (
    <Box flexDirection="column">
      {visibleList.map((entry, index) => (
        <Text key={offset + index} dimColor>{entry}</Text>
      ))}
    </Box>
  )
}

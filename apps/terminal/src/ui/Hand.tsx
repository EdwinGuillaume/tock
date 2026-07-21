import { Box, Text } from 'ink'
import type { Card } from '@tock/core'

type HandProps = { hand: Card[], cursor: number, active: boolean, playable?: boolean[] }

export const Hand = ({ hand, cursor, active, playable }: HandProps) => (
  <Box>
    <Text>hand: </Text>
    {hand.map((entry, index) => (
      <Text
        key={`${entry.rank}${entry.suit}`}
        inverse={active && index === cursor}
        bold={active && index === cursor}
        dimColor={playable !== undefined && playable[index] === false}
      >
        {' '}{entry.rank}{' '}
      </Text>
    ))}
  </Box>
)

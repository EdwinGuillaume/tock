import { Box, Text } from 'ink'
import type { MarbleId } from '../engine'
import { colorOf } from '../engine'
import { positionLabel } from './format'
import type { SplitSelection, TurnContext } from './selection'
import { splitCandidates } from './selection'
import { inkColor } from './theme'

const SPLIT_TOTAL = 7

type SplitPanelProps = { selection: SplitSelection, ctx: TurnContext }

// Guided split-7 menu (spec §6.4): one line per candidate marble showing the
// steps locked so far, the value being drafted for the focused marble, and how
// many of the 7 remain. The board highlights the focused marble in step.
export const SplitPanel = ({ selection, ctx }: SplitPanelProps) => {
  const candidateList = splitCandidates(selection.card, ctx)
  const spent = selection.assigned.reduce((sum, part) => sum + part.steps, 0)
  const remaining = SPLIT_TOTAL - spent
  const color = inkColor[colorOf(ctx.human)]

  const labelFor = (id: MarbleId): string => {
    const marble = ctx.state.marbleList.find(candidate => candidate.id === id)
    return marble ? positionLabel(marble.position) : id
  }

  const detailFor = (id: MarbleId, index: number): string => {
    const locked = selection.assigned.find(part => part.marbleId === id)
    if (locked) return locked.steps === 0 ? 'skip' : `${locked.steps}${locked.enterLane ? ' →lane' : ''}`
    if (index !== selection.focusIndex) return '—'
    if (selection.phase === 'lane') return `${selection.draftSteps} · ${selection.draftLane ? 'enter lane' : 'stay on ring'}?`
    return `${selection.draftSteps}?`
  }

  return (
    <Box flexDirection="column">
      <Text bold>split 7 — {remaining} left  (← → adjust · Enter lock · Esc back)</Text>
      {candidateList.map((id, index) => {
        const locked = selection.assigned.some(part => part.marbleId === id)
        const focused = index === selection.focusIndex && !locked
        return (
          <Text key={id} color={color} inverse={focused} dimColor={!focused && !locked}>
            {focused ? '▸ ' : '  '}{labelFor(id)}: {detailFor(id, index)}
          </Text>
        )
      })}
    </Box>
  )
}

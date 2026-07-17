import { Box, Text } from 'ink'
import type { GameState, PlayerId } from '../engine'
import { colorOf, finishSize } from '../engine'
import type { Highlight } from './layout'
import { cellOf, finishCoord, gridSize, ringCoord } from './layout'
import { glyph, inkColor } from './theme'

type CellView = { char: string, color?: string, inverse?: boolean }

const key = (row: number, col: number): string => `${row},${col}`

// Marbles of `owner` still waiting in the nest.
const homeCount = (state: GameState, owner: PlayerId): number =>
  state.marbleList.filter(marble => marble.owner === owner && marble.position.zone === 'home').length

const isActive = (state: GameState, owner: PlayerId): boolean =>
  state.playerList.some(player => player.id === owner && player.kind !== 'inactive')

const buildGrid = (state: GameState, highlight: Highlight[]): Map<string, CellView> => {
  const grid = new Map<string, CellView>()

  // Empty ring border.
  for (let index = 0; index < 48; index++) {
    const cell = ringCoord(index)
    grid.set(key(cell.row, cell.col), { char: glyph.emptyRing })
  }

  // Empty finish lanes, tinted per owner.
  for (const owner of [0, 1, 2, 3] as PlayerId[]) {
    if (!state.playerList.some(player => player.id === owner && player.kind !== 'inactive')) continue
    for (let slot = 0; slot < finishSize; slot++) {
      const cell = finishCoord(owner, slot)
      grid.set(key(cell.row, cell.col), { char: glyph.emptyFinish, color: inkColor[colorOf(owner)] })
    }
  }

  // Centre marker.
  grid.set(key(6, 6), { char: glyph.center })

  // Marbles.
  for (const marble of state.marbleList) {
    const cell = cellOf(marble.owner, marble.position)
    if (!cell) continue
    const isFinish = marble.position.zone === 'finish'
    grid.set(key(cell.row, cell.col), {
      char: isFinish ? glyph.filledFinish : glyph.marble,
      color: inkColor[colorOf(marble.owner)]
    })
  }

  // Highlight overlay. `landing` draws a white square where a marble would go
  // (drawn on top, so it marks empty cells and capture targets alike);
  // `selected` emphasizes a real marble in place, keeping its glyph and colour.
  for (const { cell, kind } of highlight) {
    if (kind === 'landing') {
      grid.set(key(cell.row, cell.col), { char: glyph.landing, color: 'whiteBright' })
      continue
    }
    const existing = grid.get(key(cell.row, cell.col))
    grid.set(key(cell.row, cell.col), { char: existing?.char ?? glyph.emptyRing, color: existing?.color, inverse: true })
  }

  return grid
}

type NestProps = { state: GameState, owner: PlayerId }

// One seat's nest: a labelled line of 4 slots — filled (owner colour) for
// marbles still home, empty for those out. Inactive seats render a blank line so
// the surrounding board layout stays aligned.
const Nest = ({ state, owner }: NestProps) => {
  if (!isActive(state, owner)) return <Text> </Text>
  const home = homeCount(state, owner)
  const color = colorOf(owner)
  const slotList = Array.from({ length: 4 }, (unused, index) => (index < home ? glyph.filledNest : glyph.emptyNest))
  return (
    <Text color={inkColor[color]}>{color} {slotList.join(' ')}</Text>
  )
}

type BoardProps = { state: GameState, highlight?: Highlight[] }

export const Board = ({ state, highlight = [] }: BoardProps) => {
  const grid = buildGrid(state, highlight)
  const rowList = Array.from({ length: gridSize }, (unused, row) => row)
  const colList = Array.from({ length: gridSize }, (unused, col) => col)
  // Nests sit in the margins around the grid: seat 2 (yellow) top, seat 1
  // (green) left, seat 3 (blue) right, seat 0 (red, human) bottom — matching
  // layout.sideOf. Only active seats show marbles; inactive seats are blank.
  return (
    <Box flexDirection="column" alignItems="center">
      <Nest state={state} owner={2} />
      <Box alignItems="center">
        <Box marginRight={1}>
          <Nest state={state} owner={1} />
        </Box>
        <Box flexDirection="column">
          {rowList.map(row => (
            <Box key={row}>
              {colList.map(col => {
                const view = grid.get(key(row, col)) ?? { char: ' ' }
                return (
                  <Text key={col} color={view.color} inverse={view.inverse}>
                    {view.char}{' '}
                  </Text>
                )
              })}
            </Box>
          ))}
        </Box>
        <Nest state={state} owner={3} />
      </Box>
      <Nest state={state} owner={0} />
    </Box>
  )
}

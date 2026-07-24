import { Box, Text } from 'ink'
import type { GameState, PlayerId } from '@tock/core'
import { colorOf, finishSize } from '@tock/core'
import type { Cell, Highlight } from './layout'
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

  // Empty ring cells (the plus/cross perimeter).
  for (let index = 0; index < state.ringSize; index++) {
    const cell = ringCoord(index, state.ringSize)
    grid.set(key(cell.row, cell.col), { char: glyph.emptyRing })
  }

  // Empty finish lanes, tinted per owner.
  for (const owner of [0, 1, 2, 3] as PlayerId[]) {
    if (!state.playerList.some(player => player.id === owner && player.kind !== 'inactive')) continue
    for (let slot = 0; slot < finishSize; slot++) {
      const cell = finishCoord(owner, slot, state.ringSize)
      grid.set(key(cell.row, cell.col), { char: glyph.emptyFinish, color: inkColor[colorOf(owner)] })
    }
  }

  // Centre marker (the grid midpoint: ringSize/4 cells per side, halved).
  const center = state.ringSize / 8
  grid.set(key(center, center), { char: glyph.center })

  // Marbles.
  for (const marble of state.marbleList) {
    const cell = cellOf(marble.owner, marble.position, state.ringSize)
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

  // Nests: each active seat's 4 marbles as a 2x2 block in the corner by its arm.
  // Filled dot = marble still home, empty circle = marble out. Inactive seats
  // leave their corner blank.
  const side = gridSize(state.ringSize)
  const nestAnchor: Record<PlayerId, Cell> = {
    0: { row: side - 3, col: 1 },        // red   bottom-left
    1: { row: 0, col: 1 },               // green top-left
    2: { row: 0, col: side - 3 },        // purple top-right
    3: { row: side - 3, col: side - 3 }  // blue  bottom-right
  }
  for (const owner of [0, 1, 2, 3] as PlayerId[]) {
    if (!isActive(state, owner)) continue
    const home = homeCount(state, owner)
    const anchor = nestAnchor[owner]
    for (let slot = 0; slot < 4; slot++) {
      const cell = { row: anchor.row + Math.floor(slot / 2), col: anchor.col + (slot % 2) }
      grid.set(key(cell.row, cell.col), {
        char: slot < home ? glyph.filledNest : glyph.emptyNest,
        color: inkColor[colorOf(owner)]
      })
    }
  }

  return grid
}

type BoardProps = { state: GameState, highlight?: Highlight[] }

export const Board = ({ state, highlight = [] }: BoardProps) => {
  const grid = buildGrid(state, highlight)
  const side = gridSize(state.ringSize)
  const rowList = Array.from({ length: side }, (unused, row) => row)
  const colList = Array.from({ length: side }, (unused, col) => col)
  return (
    <Box flexDirection="column" alignItems="center">
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
  )
}

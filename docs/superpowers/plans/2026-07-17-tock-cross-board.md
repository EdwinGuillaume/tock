# Cross-Shaped Board Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the Tock board as a plus/cross silhouette (four arms around a centre, nests in the corners) instead of the current full-square border.

**Architecture:** Pure UI change. The engine models the ring as an abstract loop of `ringSize` cells; a cross is a different *embedding* of that loop. Only `ringCoord` in `src/ui/layout.ts` changes (it traces the plus perimeter), plus the nest rendering in `src/ui/Board.tsx` moves from margin text to corner clusters. `finishCoord`, `gridSize`, `sideOf`, `cellOf`, and every engine/AI module stay exactly as-is.

**Tech Stack:** TypeScript (strict), React + Ink, Vitest, pnpm.

## Global Constraints

- Code and comments in **English**.
- **No semicolons, no trailing commas.**
- **No `function` keyword** — use `const` arrow functions.
- **No non-null assertions (`!`) in production code** — use safe fallbacks on array access (`list[i] ?? fallback`). Non-null assertions are allowed only in tests.
- Variables: camelCase, no plural (`cellList`, not `cells`).
- ESLint max warnings: 0.
- The engine/AI are **isomorphic and untouched** — do not edit anything under `src/engine/` or `src/ai/`.
- Node: prefix `pnpm` commands with the nvm v24 PATH if the shell defaults to Node 18: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"`.

## Geometry reference (verified, both sizes)

- `gridSize(ringSize) = ringSize/4 + 1` → **13** (48-ring), **19** (72-ring). Unchanged.
- `arm = (gridSize - 3) / 2` → 5 (48), 8 (72). `mid = (gridSize - 1) / 2` → 6 (48), 9 (72).
- The ring is the plus perimeter (`|col-mid| <= 1 || |row-mid| <= 1`, boundary cells) plus the four rounded inner corners `(arm-1, arm-1)`, `(arm-1, S-arm)`, `(S-arm, arm-1)`, `(S-arm, S-arm)` where `S = gridSize`.
- Traversal starts at red's start `(S-1, mid-1)`, steps up the arm first (`(S-2, mid-1)`), runs bottom → left → top → right. Seat *k*'s start lands at index `k · ringSize/4`.

Pinned `ringCoord` values:

| ringSize | index | cell (row,col) | meaning |
|---------:|------:|----------------|---------|
| 48 | 0  | (12, 5) | red start (`startCell(0)`) |
| 48 | 1  | (11, 5) | one step up red's arm |
| 48 | 5  | (8, 4)  | bottom→left rounded corner |
| 48 | 6  | (7, 4)  | — |
| 48 | 12 | (5, 0)  | green start (`startCell(1)`) |
| 48 | 24 | (0, 7)  | yellow start (`startCell(2)`) |
| 48 | 36 | (7, 12) | blue start (`startCell(3)`) |
| 48 | 47 | (12, 6) | red lane mouth (`laneMouth(0)`) |
| 72 | 0  | (18, 8) | red start |
| 72 | 1  | (17, 8) | one step up red's arm |
| 72 | 18 | (8, 0)  | green start |
| 72 | 36 | (0, 10) | yellow start |
| 72 | 54 | (10, 18)| blue start |
| 72 | 71 | (18, 9) | red lane mouth |

`finishCoord` (unchanged, for reference): `finishCoord(0,0,48)=(11,6)`, `finishCoord(0,3,48)=(8,6)`.

Nest corner blocks (2×2, `S=gridSize`): red rows `S-3..S-2` cols `1..2`; green rows `0..1` cols `1..2`; yellow rows `0..1` cols `S-3..S-2`; blue rows `S-3..S-2` cols `S-3..S-2`.

---

### Task 1: Rewrite `ringCoord` to trace the cross

**Files:**
- Modify: `src/ui/layout.ts` (replace the `ringCoord` function, lines 26-39)
- Test: `tests/ui/layout.test.ts` (rewrite the `ringCoord` cases in both `describe` blocks)
- Test: `tests/ui/useTurnInput.test.tsx` (update two hardcoded ring cells at lines 58 and 60)

**Interfaces:**
- Consumes: `gridSize(ringSize: number): number` (unchanged, already in `layout.ts`); `startCell(seat, ringSize)` and `laneMouth(seat, ringSize)` from `../../src/engine`.
- Produces: `ringCoord(index: number, ringSize: number): Cell` — same signature as today, new cross coordinates. `Cell = { row: number, col: number }`.

- [ ] **Step 1: Rewrite the `ringCoord` cases in `tests/ui/layout.test.ts`**

The file's structure stays. Keep the `onBorder` helper but add an `onPlus` helper, and replace the ring-specific tests. `finishCoord`, `cellOf`, and `movePreviewCells` tests are unchanged. Replace lines 6-89 (the `onBorder` const through the end of the 72-cell `describe`) with:

```tsx
const onPlus = (cell: { row: number, col: number }, size: number): boolean => {
  const mid = (size - 1) / 2
  return Math.abs(cell.row - mid) <= 1 || Math.abs(cell.col - mid) <= 1
}

describe('layout — ring geometry (48-cell cross)', () => {
  test('lays out a 13x13 grid', () => {
    expect(gridSize(48)).toBe(13)
  })

  test('each seat start lands at its arm tip, human (red) at the bottom', () => {
    expect(sideOf[0]).toBe('bottom')
    expect(ringCoord(startCell(0, 48), 48)).toEqual({ row: 12, col: 5 }) // red bottom
    expect(ringCoord(startCell(1, 48), 48)).toEqual({ row: 5, col: 0 })  // green left
    expect(ringCoord(startCell(2, 48), 48)).toEqual({ row: 0, col: 7 })  // yellow top
    expect(ringCoord(startCell(3, 48), 48)).toEqual({ row: 7, col: 12 }) // blue right
  })

  test('the path steps up the arm from the start, then rounds the inner corner', () => {
    expect(ringCoord(1, 48)).toEqual({ row: 11, col: 5 })
    expect(ringCoord(5, 48)).toEqual({ row: 8, col: 4 }) // bottom->left rounded corner
  })

  test('all 48 ring cells are distinct and lie on the plus shape', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 48; i++) {
      const cell = ringCoord(i, 48)
      expect(onPlus(cell, 13)).toBe(true)
      seen.add(`${cell.row},${cell.col}`)
    }
    expect(seen.size).toBe(48)
  })

  test('ringCoord wraps and normalizes out-of-range indices', () => {
    expect(ringCoord(48, 48)).toEqual(ringCoord(0, 48))
    expect(ringCoord(47, 48)).toEqual({ row: 12, col: 6 })
  })

  test('each seat lane mouth cell is adjacent to its finish slot 0', () => {
    for (const seat of [0, 1, 2, 3] as const) {
      const mouth = ringCoord(laneMouth(seat, 48), 48)
      const slot0 = finishCoord(seat, 0, 48)
      expect(Math.abs(mouth.row - slot0.row) + Math.abs(mouth.col - slot0.col)).toBe(1)
    }
  })

  test('finish lanes thread inward from each arm, slot 0 nearest the ring', () => {
    expect(finishCoord(0, 0, 48)).toEqual({ row: 11, col: 6 })
    expect(finishCoord(0, 3, 48)).toEqual({ row: 8, col: 6 })
    expect(finishCoord(1, 0, 48)).toEqual({ row: 6, col: 1 })
    expect(finishCoord(2, 0, 48)).toEqual({ row: 1, col: 6 })
    expect(finishCoord(3, 0, 48)).toEqual({ row: 6, col: 11 })
  })
})

describe('layout — ring geometry (72-cell cross)', () => {
  test('lays out a 19x19 grid', () => {
    expect(gridSize(72)).toBe(19)
  })

  test('each seat start lands at its arm tip on the 19x19 grid', () => {
    expect(ringCoord(startCell(0, 72), 72)).toEqual({ row: 18, col: 8 })
    expect(ringCoord(startCell(1, 72), 72)).toEqual({ row: 8, col: 0 })
    expect(ringCoord(startCell(2, 72), 72)).toEqual({ row: 0, col: 10 })
    expect(ringCoord(startCell(3, 72), 72)).toEqual({ row: 10, col: 18 })
  })

  test('the path steps up the arm from the start', () => {
    expect(ringCoord(1, 72)).toEqual({ row: 17, col: 8 })
  })

  test('all 72 ring cells are distinct and lie on the plus shape', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 72; i++) {
      const cell = ringCoord(i, 72)
      expect(onPlus(cell, 19)).toBe(true)
      seen.add(`${cell.row},${cell.col}`)
    }
    expect(seen.size).toBe(72)
  })

  test('each seat lane mouth cell is adjacent to its finish slot 0', () => {
    for (const seat of [0, 1, 2, 3] as const) {
      const mouth = ringCoord(laneMouth(seat, 72), 72)
      const slot0 = finishCoord(seat, 0, 72)
      expect(Math.abs(mouth.row - slot0.row) + Math.abs(mouth.col - slot0.col)).toBe(1)
    }
  })

  test('finish lanes thread inward from the 19x19 arm centres', () => {
    expect(finishCoord(0, 0, 72)).toEqual({ row: 17, col: 9 })
    expect(finishCoord(0, 3, 72)).toEqual({ row: 14, col: 9 })
    expect(finishCoord(1, 0, 72)).toEqual({ row: 9, col: 1 })
    expect(finishCoord(2, 0, 72)).toEqual({ row: 1, col: 9 })
    expect(finishCoord(3, 0, 72)).toEqual({ row: 9, col: 17 })
  })
})
```

Update the import at the top of the file (line 3) to add `laneMouth` from the engine — change line 2 from `import { createGame, startCell } from '../../src/engine'` to:

```tsx
import { createGame, laneMouth, startCell } from '../../src/engine'
```

- [ ] **Step 2: Run the layout tests to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH" && pnpm test tests/ui/layout.test.ts`
Expected: FAIL — the seat-start and path cases fail with the old square coordinates (e.g. received `{ row: 12, col: 6 }`, expected `{ row: 12, col: 5 }`).

- [ ] **Step 3: Rewrite `ringCoord` in `src/ui/layout.ts`**

Replace the current `ringCoord` function (lines 26-39, from the `// Ring index -> grid cell` comment through the closing brace) with:

```tsx
// The ring traces the plus/cross perimeter: the two outer lanes of each arm, the
// arm tips, and one rounded cell at each inner corner. Built once per ring size
// and cached, then indexed. The walk starts at red's start square (bottom arm,
// left outer lane) and runs bottom -> left -> top -> right, so seat k lands at
// index k * ringSize / 4 — matching startCell.
const ringCache = new Map<number, Cell[]>()

const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

const isPlus = (row: number, col: number, mid: number): boolean =>
  Math.abs(col - mid) <= 1 || Math.abs(row - mid) <= 1

const buildRing = (ringSize: number): Cell[] => {
  const side = gridSize(ringSize)
  const mid = (side - 1) / 2
  const arm = (side - 3) / 2
  const inGrid = (row: number, col: number): boolean =>
    row >= 0 && row < side && col >= 0 && col < side
  const onRing = (row: number, col: number): boolean => {
    if (!isPlus(row, col, mid)) return false
    const isCorner =
      (row === arm - 1 || row === side - arm) && (col === arm - 1 || col === side - arm)
    if (isCorner) return true
    return STEP.some(([dr, dc]) => !inGrid(row + dr, col + dc) || !isPlus(row + dr, col + dc, mid))
  }
  const neighbours = (cell: Cell): Cell[] =>
    STEP.map(([dr, dc]) => ({ row: cell.row + dr, col: cell.col + dc })).filter(next =>
      onRing(next.row, next.col)
    )
  const same = (a: Cell, b: Cell): boolean => a.row === b.row && a.col === b.col
  const start: Cell = { row: side - 1, col: mid - 1 }
  const order: Cell[] = [start]
  let prev = start
  let cur: Cell = { row: side - 2, col: mid - 1 }
  while (!same(cur, start)) {
    order.push(cur)
    const next = neighbours(cur).find(candidate => !same(candidate, prev))
    if (!next) break
    prev = cur
    cur = next
  }
  return order
}

// Ring index -> grid cell on the plus perimeter. Index is normalised mod ringSize
// (wraps), matching the abstract loop.
export const ringCoord = (index: number, ringSize: number): Cell => {
  const ring = ringCache.get(ringSize) ?? buildRing(ringSize)
  ringCache.set(ringSize, ring)
  const i = ((index % ringSize) + ringSize) % ringSize
  return ring[i] ?? { row: 0, col: 0 }
}
```

- [ ] **Step 4: Run the layout tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH" && pnpm test tests/ui/layout.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Update the two hardcoded ring cells in `tests/ui/useTurnInput.test.tsx`**

Line 58 asserts track index 0 renders at `{ row: 12, col: 6 }` (old square value); the cross value is `{ row: 12, col: 5 }`. Line 60 asserts track index 6 renders at `{ row: 12, col: 0 }`; the cross value is `{ row: 7, col: 4 }`. Change:

```tsx
  // Source marble stays emphasized at its current ring cell (track index 0).
  expect(highlight).toContainEqual({ cell: { row: 12, col: 5 }, kind: 'selected' })
  // The '6' lands it six steps on (track index 6) — previewed as a landing square.
  expect(highlight).toContainEqual({ cell: { row: 7, col: 4 }, kind: 'landing' })
```

(Line 73's `ringCoord(25, 48)` is computed, not hardcoded — leave it.)

- [ ] **Step 6: Run the full suite and typecheck**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH" && pnpm test && pnpm typecheck`
Expected: PASS — all tests green (Board.test.tsx still passes: its nest test uses margin labels, unchanged until Task 2; its landing test at `{row:12,col:1}` still renders `□`). `tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add src/ui/layout.ts tests/ui/layout.test.ts tests/ui/useTurnInput.test.tsx
git commit -m "feat(ui): trace the ring as a cross perimeter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Render nests in the four corners

**Files:**
- Modify: `src/ui/Board.tsx` (replace the `Nest` component and its four placements in `Board`)
- Test: `tests/ui/Board.test.tsx` (rewrite the nest-rendering test)

**Interfaces:**
- Consumes: `ringCoord` (from Task 1, via `buildGrid`), `homeCount(state, owner)` and `isActive(state, owner)` (existing helpers in `Board.tsx`), `glyph.filledNest`/`glyph.emptyNest` (existing in `theme.ts`), `colorOf`/`inkColor` (existing).
- Produces: nests drawn into the grid's four corners; no exported API change.

The current `Board.tsx` draws nests as text lines in the margins around the grid (a `Nest` component returning `<Text>{color} {slots}</Text>`, placed above/left/right/below the grid `Box`). This task moves the nest marbles **into** the grid cells (corner blocks), so the margin lines and their surrounding `Box` layout are removed.

- [ ] **Step 1: Rewrite the nest test in `tests/ui/Board.test.tsx`**

Because seat colour is stripped from the frame, the test asserts glyph counts instead of colour words. In the scenario (seats 0/red + 1/green active, `p0m0` on track): red has 3 marbles home + 1 out, green has 4 home. Home marbles render as `●` (`filledNest`, same glyph as a track marble) and the one out slot as `○` (`emptyNest`). So the frame has exactly one `○` and eight `●` (3 red home + 4 green home + 1 red on track); the two inactive seats add no glyphs. Replace the test at lines 44-55 (`renders active-seat nests...`) with:

```tsx
const countChar = (text: string, char: string): number => text.split(char).length - 1

test('renders active-seat nests in the corners and omits inactive seats', () => {
  // human (seat 0/red) + one bot (seat 1/green); seats 2/3 inactive.
  let state = createGame(['human', 'bot'])
  state = place(state, 'p0m0', { zone: 'track', index: 0 }) // red: 3 home, 1 out
  const { lastFrame } = render(<Board state={state} />)
  const text = strip(lastFrame())
  // Red has one marble out -> exactly one empty nest slot.
  expect(countChar(text, '○')).toBe(1)
  // 3 red home + 4 green home + 1 red on track = 8 filled dots; inactive seats add none.
  expect(countChar(text, '●')).toBe(8)
  // No margin colour labels any more.
  expect(text).not.toContain('red')
  expect(text).not.toContain('green')
})
```

- [ ] **Step 2: Run the Board tests to verify the nest test fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH" && pnpm test tests/ui/Board.test.tsx`
Expected: FAIL — current board still prints `red`/`green` labels and margin nests, so `not.toContain('red')` fails and the `●` count is off.

- [ ] **Step 3: Draw nests into the grid corners in `src/ui/Board.tsx`**

Add a nest overlay inside `buildGrid`, and simplify the `Board` component to render only the grid (no margin nests). First, add this block to `buildGrid` immediately before its final `return grid` (after the highlight overlay loop):

```tsx
  // Nests: each active seat's 4 marbles as a 2x2 block in the corner by its arm.
  // Filled dot = marble still home, empty circle = marble out. Inactive seats
  // leave their corner blank.
  const side = gridSize(state.ringSize)
  const nestAnchor: Record<PlayerId, Cell> = {
    0: { row: side - 3, col: 1 },        // red   bottom-left
    1: { row: 0, col: 1 },               // green top-left
    2: { row: 0, col: side - 3 },        // yellow top-right
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
```

This needs `Cell` and `gridSize` imported. Update the import on line 5 from `import { cellOf, finishCoord, gridSize, ringCoord } from './layout'` to also bring in the `Cell` type:

```tsx
import type { Cell, Highlight } from './layout'
import { cellOf, finishCoord, gridSize, ringCoord } from './layout'
```

(Change line 4 `import type { Highlight } from './layout'` to the combined `import type { Cell, Highlight }` line above, and keep the value import on the next line.)

- [ ] **Step 4: Remove the margin `Nest` component and simplify `Board`**

Delete the `Nest` component (the `NestProps` type and the `const Nest = ...` block) and its JSX usages. Replace the entire `Board` component's `return` (the `<Box flexDirection="column" alignItems="center">...</Box>` block) so it renders only the grid:

```tsx
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
```

After deleting `Nest`, remove the now-unused `Nest`/`NestProps` code and confirm no leftover references. The helpers `homeCount` and `isActive` stay (now used by `buildGrid`).

- [ ] **Step 5: Run the Board tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH" && pnpm test tests/ui/Board.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH" && pnpm test && pnpm typecheck`
Expected: PASS — full suite green, `tsc --noEmit` clean, no unused-variable warnings (`Nest`/`NestProps` fully removed).

- [ ] **Step 7: Visually verify the running board**

Run the UI and confirm the cross renders with nests in the corners:

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH" && pnpm exec tsx src/index.tsx` (or the project's launch command if different).
Expected: a plus/cross board — four arms, `✦` centre, each seat's marbles clustered in its corner, marbles moving around the ring on play. Quit after confirming.

- [ ] **Step 8: Commit**

```bash
git add src/ui/Board.tsx tests/ui/Board.test.tsx
git commit -m "feat(ui): render nests in the four corners of the cross board

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review notes

- **Spec coverage:** §3 change table → Task 1 (`ringCoord` + its tests) and Task 2 (`Board.tsx` nests + test). §4 geometry → Task 1 impl + pinned tests. §4.4 `finishCoord` unchanged → asserted (not modified) in Task 1 tests. §5 corner nests → Task 2. §6 testing → both tasks' test steps + full-suite/typecheck gates. §7 out-of-scope respected (no engine/AI edits).
- **Type consistency:** `Cell = { row, col }` used throughout; `ringCoord(index, ringSize)` and `finishCoord(owner, slot, ringSize)` signatures unchanged; `PlayerId` used for seat records; `glyph.filledNest`/`glyph.emptyNest` match `theme.ts`.
- **No placeholders:** every code and command step is complete.

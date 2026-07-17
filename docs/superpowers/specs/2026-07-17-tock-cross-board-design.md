# Tock — cross-shaped board rendering

**Date:** 2026-07-17
**Status:** approved (design)
**Scope:** UI rendering only. The engine and AI are untouched.

## 1. Goal

Render the board as a **plus / cross** (four arms around a centre) instead of the
current full-square border, matching the classic Ludo silhouette:

```
   ...
   . .
   . .
.... ....
.       .
.... ....
   . .
   . .
   ...
```

Each arm is a rectangular corridor; the four corners between the arms become free
space and hold the players' nests. This is a **pure presentation change** — the
rules, the move contract, and the abstract ring are identical to today.

## 2. Why this is engine-safe

The engine models the ring as an abstract loop of `ringSize` cells
(`0..ringSize-1`) with no geometry attached. Where each cell is *drawn* lives
entirely in `src/ui/layout.ts`. A cross is simply a different embedding of the
same loop into grid coordinates, so:

- `getLegalMoves`, `applyMove`, `startCell`, `laneMouth`, `stepsToMouth`,
  `ringDestinations`, and every engine/AI test are **unchanged**.
- The grid size is **identical to today**: `gridSize(ringSize) = ringSize/4 + 1`
  → 13×13 for the 48-ring, 19×19 for the 72-ring. Nothing else in the UI resizes.

## 3. What changes

| File | Change |
|------|--------|
| `src/ui/layout.ts` | Rewrite **`ringCoord`** to trace the plus cycle. |
| `src/ui/Board.tsx` | Move the four seat **nests** from margin text lines into 2×2 corner clusters inside the grid. |
| `tests/ui/layout.test.ts` | Rewrite the `ringCoord` coordinate expectations to the cross values. |
| `tests/ui/Board.test.tsx` | Update nest-rendering assertions for the corner clusters. |

**Explicitly unchanged** (verified against the current implementation):

- **`finishCoord`** — the current implementation already threads up the centre
  column/row of each arm toward the middle, producing the *exact same*
  coordinates the cross needs. No change, and its layout tests stay green.
- `gridSize`, `sideOf`, `cellOf`, `movePreviewCells`, `marbleCellsAfter` — all
  read `ringCoord`/`finishCoord` and need no edits.
- The centre marker in `Board.tsx` (`ringSize/8, ringSize/8` = grid midpoint) and
  the empty-ring / empty-finish drawing loops — they already iterate over
  `ringCoord`/`finishCoord`, so they follow the new geometry automatically.

## 4. Geometry

Let `S = ringSize/4 + 1` be the grid side (13 or 19), `mid = (S-1)/2` the centre
index, and `arm = (S-3)/2 = ringSize/8 - 1` the arm length (5 for the 48-ring, 8
for the 72-ring). Every arm is **3 cells wide** (columns/rows `mid-1, mid,
mid+1`).

### 4.1 The ring is the plus perimeter with rounded inner corners

A grid cell `(r, c)` is part of the **plus** when `|c-mid| <= 1` OR `|r-mid| <= 1`.
The ring is:

- every plus cell that lies on the plus **boundary** (a plus cell with at least
  one 4-neighbour that is off-grid or outside the plus), **plus**
- the four **inner-corner** cells `(arm-1, arm-1)`, `(arm-1, S-arm)`,
  `(S-arm, arm-1)`, `(S-arm, S-arm)` — the single rounded cell that lets the path
  turn each inside corner. For the 48-ring (`arm=5, S=13`) these are `(4,4)`,
  `(4,8)`, `(8,4)`, `(8,8)`.

This set is exactly `ringSize` cells and forms a single closed loop where every
cell has exactly two ring neighbours (a clean 2-regular cycle). Verified for both
sizes: 48 cells on the 13×13 grid, 72 on the 19×19.

### 4.2 `ringCoord(index, ringSize)` — ordering the loop

Walk the cycle so that it matches the engine's seat convention:

- **Index 0** is red's start square: the cell `(S-1, mid-1)` — the bottom arm's
  tip, on the **left outer lane** (offset one cell left of the arm centre).
- From the start, the **first step goes up the arm** (to the ring neighbour
  sharing the start's column, `(S-2, mid-1)`), then follows the loop. This makes
  travel run **bottom → left → top → right**, so seat *k*'s start square lands at
  index `k · (ringSize/4)` — matching `startCell(k, ringSize)` (verified:
  `startCell` returns `0, 12, 24, 36` for the 48-ring, `0, 18, 36, 54` for the
  72-ring).

`index` is normalised mod `ringSize` (wrapping preserved, as today).

Implementation note: the recommended approach is to **build the ordered ring once
per size and index into it** (memoised) rather than a hand-derived piecewise
closed form — it is obviously correct, trivially testable, and size-agnostic. The
construction is: build the ring-cell set (§4.1), then trace neighbours from the
start cell in the direction above. The layout tests below pin the exact
coordinates, so any implementation that reproduces them is acceptable.

### 4.3 Verified reference coordinates (48-ring, 13×13, mid = 6)

Seat start squares (index `k·12`) and the four inner corners:

| index | cell (row, col) | meaning |
|------:|-----------------|---------|
| 0  | (12, 5) | red start (bottom, seat 0) |
| 5  | (8, 4)  | bottom→left inner corner |
| 12 | (5, 0)  | green start (left, seat 1) |
| 17 | (4, 4)  | left→top inner corner |
| 24 | (0, 7)  | yellow start (top, seat 2) |
| 29 | (4, 8)  | top→right inner corner |
| 36 | (7, 12) | blue start (right, seat 3) |
| 41 | (8, 8)  | right→bottom inner corner |
| 47 | (12, 6) | red's lane mouth (`startCell(0)-1`) |

Invariants the tests assert (both sizes):

- `gridSize(48) = 13`, `gridSize(72) = 19` (unchanged).
- All `ringSize` cells are distinct and lie on the plus shape (§4.1).
- `ringCoord(startCell(k, ringSize), ringSize)` equals the seat-`k` start above.
- `ringCoord(ringSize, ringSize) === ringCoord(0, ringSize)` (wrap).
- The cell at `ringCoord(laneMouth(k), ringSize)` is 4-adjacent to that seat's
  `finishCoord(k, 0, ringSize)` — i.e. the finish lane connects at the mouth.

### 4.4 `finishCoord` — unchanged

For reference, the existing formula (kept as-is) threads slot 0..3 inward from
each arm along its centre line, `sideOf` selecting the arm:

- bottom: `{ row: (S-1) - (slot+1), col: mid }`
- top:    `{ row: slot+1,           col: mid }`
- left:   `{ row: mid,              col: slot+1 }`
- right:  `{ row: mid,              col: (S-1) - (slot+1) }`

The centre column/row of each arm is interior to the plus (never a ring cell), so
finish cells never collide with ring cells. Verified: `finishCoord(0,0,48) =
(11,6)`, `finishCoord(0,3,48) = (8,6)` — identical to today.

## 5. Nests in the corners (`Board.tsx`)

Each seat's four waiting marbles render as a **2×2 cluster in the corner nearest
that seat's own start square**:

- red (seat 0, bottom) → **bottom-left** corner
- green (seat 1, left) → **top-left** corner
- yellow (seat 2, top) → **top-right** corner
- blue (seat 3, right) → **bottom-right** corner

Filled glyph (`glyph.filledNest`) for a marble still home, empty
(`glyph.emptyNest`) for one that is out — reusing today's glyphs and the existing
`homeCount(state, owner)`. Inactive seats render a blank corner. The four margin
`Nest` text lines are removed; the board becomes self-contained.

Each 2×2 block occupies these grid cells (13×13 shown; the 72-ring uses the
analogous corners of the 19×19 grid). The blocks sit clear of the arms and the
tip rows/cols:

- bottom-left (red): rows `S-3 .. S-2`, cols `1 .. 2`
- top-left (green): rows `0 .. 1`, cols `1 .. 2`
- top-right (yellow): rows `0 .. 1`, cols `S-3 .. S-2`
- bottom-right (blue): rows `S-3 .. S-2`, cols `S-3 .. S-2`

Rendered 48-ring board (uppercase = start square, `✦` = centre):

```
  g g     · · Y     y y
  g g     · y ·     y y
          · y ·
          · y ·
        · · y · ·
G · · · ·       · · · · ·
· g g g g   ✦   b b b b ·
· · · · ·       · · · · B
        · · r · ·
          · r ·
  r r     · r ·     b b
  r r     · r ·     b b
          R · ·
```

## 6. Testing

- **`tests/ui/layout.test.ts`** — rewrite the `ringCoord` cases (seat starts,
  corners, the distinct-cells-on-shape sweep, wrap) to the cross values in §4.3,
  replacing the "on the square border" check with an "on the plus shape" check.
  Add the mouth↔finish adjacency invariant. The `finishCoord` cases stay as-is.
  The `cellOf` / `movePreviewCells` cases stay, but any that assert a specific
  `ringCoord` value inherit the new coordinates.
- **`tests/ui/Board.test.tsx`** — update assertions that the four nests render in
  the corners with the right per-seat colour and filled/empty counts; inactive
  seats leave their corner blank.
- Full suite (`pnpm test`) and `pnpm typecheck` stay green. No engine or AI test
  changes.

## 7. Out of scope

- Any change to rules, move generation, scoring, or the AI.
- Adding new ring sizes (the geometry is already size-agnostic via `arm`, `S`,
  `mid`).
- Restyling glyphs, colours, or the surrounding panels (hand, log, status).

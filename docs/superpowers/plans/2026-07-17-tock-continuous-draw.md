# Continuous Draw (constant 5-card hand) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the round-based redeal with a per-turn draw so every active hand always holds five cards.

**Architecture:** Fold a "draw one replacement card" step into the engine's single `applyMove` path. A new pure `drawCard` helper in `state.ts` owns the draw + reshuffle; `applyMove` gains an optional injected RNG so the reshuffle is deterministic under test. `redealIfNeeded` is removed. The bot's `scoreMove` passes a fixed RNG so it stays pure.

**Tech Stack:** TypeScript (strict) · Vitest · pnpm. Engine + AI are isomorphic (zero Node deps).

## Global Constraints

- No semicolons. No trailing commas. (Code Style)
- No `function` keyword — const arrow functions only. (Code Style)
- **No non-null assertions (`!`) in production code** (`src/`). Test files (`tests/`) may use `!`. (Code Style)
- All identifiers and comments in **English**. (Code Style)
- Variables camelCase, no plural (`cardList`, not `cards`). (Code Style)
- `GameState` stays **100% JSON-serializable** — plain data only. (Architecture)
- **Immutability:** `applyMove` returns a new state and never mutates its input. (Architecture)
- Engine/AI import only through `src/engine/index.ts` (the single public API) and `src/ai/index.ts`. (Architecture)
- Commands: `pnpm test` (full suite), `pnpm test <path>` (one file), `pnpm typecheck` (`tsc --noEmit`).
- Working branch: `feat/continuous-draw` (already checked out).

---

### Task 1: `drawCard` helper in `state.ts`

Pure helper that draws the top card, reshuffling the discard pile into an empty draw pile first. Self-contained; wired into `applyMove` in Task 2.

**Files:**
- Modify: `src/engine/state.ts` (add `drawCard`)
- Test: `tests/engine/draw.test.ts` (create)

**Interfaces:**
- Consumes: `shuffle` (already imported in `state.ts`), `Card` type.
- Produces: `drawCard(drawPile: Card[], discardPile: Card[], random?: () => number): { card: Card | null, drawPile: Card[], discardPile: Card[] }` — returns the drawn card and the updated piles; `card` is `null` (piles returned unchanged/empty) only when both piles are empty.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/draw.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { drawCard } from '../../src/engine/state'
import { card } from '../../tests/support'

describe('drawCard', () => {
  it('draws the top card and leaves the discard pile untouched when the draw pile has cards', () => {
    const result = drawCard([card('A'), card('2')], [card('K')], () => 0)
    expect(result.card).toEqual(card('A'))
    expect(result.drawPile).toEqual([card('2')])
    expect(result.discardPile).toEqual([card('K')])
  })

  it('reshuffles the discard pile into an empty draw pile, then draws', () => {
    const result = drawCard([], [card('3'), card('4')], () => 0)
    expect(result.card).toEqual(card('3'))
    expect(result.drawPile).toEqual([card('4')])
    expect(result.discardPile).toEqual([])
  })

  it('returns card: null and leaves both piles empty when both are empty', () => {
    const result = drawCard([], [], () => 0)
    expect(result.card).toBeNull()
    expect(result.drawPile).toEqual([])
    expect(result.discardPile).toEqual([])
  })
})
```

Note: `shuffle(list, () => 0)` is a deterministic identity order (Fisher-Yates by removal always picks index 0), so `[card('3'), card('4')]` reshuffles to `[card('3'), card('4')]` and the top drawn is `card('3')`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/engine/draw.test.ts`
Expected: FAIL — `drawCard` is not exported from `src/engine/state.ts`.

- [ ] **Step 3: Add `drawCard` to `state.ts`**

In `src/engine/state.ts`, add after the imports / near `createGame` (the file already imports `shuffle` and the `Card` type):

```ts
// Draw the top card, reshuffling the discard pile into an empty draw pile first.
// Returns the drawn card and the updated piles; card is null only when both
// piles are empty.
export const drawCard = (
  drawPile: Card[],
  discardPile: Card[],
  random: () => number = Math.random
): { card: Card | null, drawPile: Card[], discardPile: Card[] } => {
  let draw = drawPile
  let discard = discardPile
  if (draw.length === 0) {
    draw = shuffle(discard, random)
    discard = []
  }
  const [top, ...rest] = draw
  if (top === undefined) return { card: null, drawPile: draw, discardPile: discard }
  return { card: top, drawPile: rest, discardPile: discard }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/engine/draw.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/state.ts tests/engine/draw.test.ts
git commit -m "feat(engine): add pure drawCard helper (draw + reshuffle)"
```

---

### Task 2: Wire the continuous draw into `applyMove` and remove `redealIfNeeded`

Thread an optional RNG through `applyMove`, draw one replacement card per turn (played card enters the discard **before** the draw, so a reshuffle can redraw it), and delete the now-dead `redealIfNeeded`.

**Files:**
- Modify: `src/engine/moves.ts` (`withTurnDone`, `applyMoveInner`, `applySplit`, `applyMove`, imports)
- Modify: `src/engine/state.ts` (remove `redealIfNeeded`)
- Modify: `src/engine/index.ts` (remove `redealIfNeeded` export)
- Test: `tests/engine/apply-move.test.ts` (update bookkeeping test)
- Test: `tests/engine/rounds.test.ts` (replace `redeal` block with `continuous draw`)

**Interfaces:**
- Consumes: `drawCard` (Task 1).
- Produces: `applyMove(state: GameState, move: Move, random: () => number = Math.random): GameState` — now also draws the actor's replacement card. Two-argument calls (`applyMove(state, move)`) remain valid (RNG defaults to `Math.random`).

- [ ] **Step 1: Update the failing tests first**

In `tests/engine/apply-move.test.ts`, replace the `applyMove: bookkeeping` test named `discards the played card and advances the turn` (currently lines ~47-54) with:

```ts
  it('discards the played card, refills the hand, and advances the turn', () => {
    let state = fourPlayers()
    state = setHand(state, 0, [card('A'), card('K')])
    const next = applyMove(state, { type: 'exit', card: card('A'), marbleId: 'p0m0' })
    // played A goes to the discard; a replacement is drawn, so the hand size is preserved
    expect(next.playerList[0]!.hand).toHaveLength(2)
    expect(next.playerList[0]!.hand).toContainEqual(card('K'))
    expect(next.discardPile).toContainEqual(card('A'))
    expect(next.currentPlayer).toBe(1)
  })
```

In `tests/engine/rounds.test.ts`, replace the entire `describe('redeal', ...)` block (currently lines ~25-38) with:

```ts
describe('continuous draw', () => {
  it('refills the hand to five and removes one card from the draw pile each turn', () => {
    let state = game()
    state = setHand(state, 0, [card('9'), card('9'), card('9'), card('9'), card('9')])
    const beforeDraw = state.drawPile.length
    const next = applyMove(state, { type: 'discard', card: card('9') })
    expect(next.playerList[0]!.hand).toHaveLength(5)
    expect(next.drawPile).toHaveLength(beforeDraw - 1)
    expect(next.discardPile).toContainEqual(card('9'))
  })

  it('reshuffles the discard pile (including the just-played card) into an empty draw pile', () => {
    let state = game()
    state = setHand(state, 0, [card('9'), card('9'), card('9'), card('9'), card('9')])
    state = { ...state, drawPile: [], discardPile: [card('2'), card('3')] }
    const next = applyMove(state, { type: 'discard', card: card('9') })
    // discard [2,3] + the just-played 9 = 3 cards reshuffled into the draw pile, one drawn
    expect(next.playerList[0]!.hand).toHaveLength(5)
    expect(next.discardPile).toEqual([])
    expect(next.drawPile).toHaveLength(2)
  })
})
```

The `describe('discard', ...)` block at the top of `rounds.test.ts` is unchanged.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/engine/apply-move.test.ts tests/engine/rounds.test.ts`
Expected: FAIL — the old `applyMove` does not refill the hand (bookkeeping hand length is 1, not 2; the continuous-draw hand length is 4, not 5).

- [ ] **Step 3: Rewrite `withTurnDone` in `moves.ts`**

In `src/engine/moves.ts`, change the import on line 4 from:

```ts
import { redealIfNeeded } from './state'
```

to:

```ts
import { drawCard } from './state'
```

Replace `withTurnDone` (currently lines ~50-58) with:

```ts
const withTurnDone = (
  state: GameState,
  actor: Player,
  move: Move,
  marbleList: Marble[],
  random: () => number
): GameState => {
  const handAfterPlay = removeCard(actor.hand, move.card)
  const discardWithPlayed = [...state.discardPile, move.card]
  const drawn = drawCard(state.drawPile, discardWithPlayed, random)
  const refilledHand = drawn.card ? [...handAfterPlay, drawn.card] : handAfterPlay
  return {
    ...state,
    marbleList,
    playerList: state.playerList.map(player =>
      player.id === actor.id ? { ...player, hand: refilledHand } : player
    ),
    drawPile: drawn.drawPile,
    discardPile: drawn.discardPile,
    currentPlayer: nextPlayer({ ...state, marbleList })
  }
}
```

- [ ] **Step 4: Thread `random` through `applyMoveInner`, `applySplit`, and `applyMove`**

In `src/engine/moves.ts`, change the `applyMoveInner` signature and every `withTurnDone` / `applySplit` call inside it to pass `random`. Replace `applyMoveInner` (currently lines ~127-165) with:

```ts
const applyMoveInner = (state: GameState, move: Move, random: () => number): GameState => {
  const actor = playerById(state, state.currentPlayer)

  if (move.type === 'discard') {
    return withTurnDone(state, actor, move, state.marbleList, random)
  }

  if (move.type === 'exit') {
    const mover = findMarble(state, move.marbleId)
    const to: Position = { zone: 'track', index: startCell(actor.id) }
    return withTurnDone(state, actor, move, relocate(state.marbleList, mover, to), random)
  }

  if (move.type === 'move') {
    const mover = findMarble(state, move.marbleId)
    const to = resolveDestination(state, mover, move.steps, move.enterLane ?? false)
    if (!to) throw new Error('illegal move passed to applyMove')
    const doneState = withTurnDone(state, actor, move, relocate(state.marbleList, mover, to), random)
    const winner = allInFinish(doneState, actor.id) ? actor.id : doneState.winner
    return { ...doneState, winner }
  }

  if (move.type === 'split7') {
    return applySplit(state, actor, move, random)
  }

  if (move.type === 'swap') {
    const own = findMarble(state, move.marbleId)
    const enemy = findMarble(state, move.targetMarbleId)
    const marbleList = state.marbleList.map(marble => {
      if (marble.id === own.id) return { ...marble, position: enemy.position }
      if (marble.id === enemy.id) return { ...marble, position: own.position }
      return marble
    })
    return withTurnDone(state, actor, move, marbleList, random)
  }

  throw new Error(`move type not supported yet: ${JSON.stringify(move)}`)
}

export const applyMove = (state: GameState, move: Move, random: () => number = Math.random): GameState =>
  applyMoveInner(state, move, random)
```

Replace the `applySplit` signature and its `withTurnDone` call (currently lines ~312-323) with:

```ts
const applySplit = (
  state: GameState,
  actor: Player,
  move: Extract<Move, { type: 'split7' }>,
  random: () => number
): GameState => {
  let working: GameState = state
  for (const part of move.partList) {
    const mover = findMarble(working, part.marbleId)
    const advanced = applyPart(working, mover, part)
    if (!advanced) throw new Error('illegal split part passed to applyMove')
    working = advanced
  }
  const doneState = withTurnDone(state, actor, move, working.marbleList, random)
  const winner = allInFinish(doneState, actor.id) ? actor.id : doneState.winner
  return { ...doneState, winner }
}
```

- [ ] **Step 5: Remove `redealIfNeeded` from `state.ts` and the barrel**

In `src/engine/state.ts`, delete the entire `redealIfNeeded` function (currently lines ~43-65).

In `src/engine/index.ts` line 5, change:

```ts
export { createGame, redealIfNeeded, handSize, colorOf, marbleId } from './state'
```

to:

```ts
export { createGame, handSize, colorOf, marbleId } from './state'
```

- [ ] **Step 6: Run the full suite and typecheck**

Run: `pnpm test`
Expected: PASS — including the updated `apply-move` and `rounds` tests. (The existing `tests/ai/integration.test.ts` still passes; it is strengthened in Task 4.)

Run: `pnpm typecheck`
Expected: no errors (no remaining references to `redealIfNeeded`).

- [ ] **Step 7: Commit**

```bash
git add src/engine/moves.ts src/engine/state.ts src/engine/index.ts tests/engine/apply-move.test.ts tests/engine/rounds.test.ts
git commit -m "feat(engine): continuous draw — refill hand each turn, drop redealIfNeeded"
```

---

### Task 3: Keep `scoreMove` pure by passing a fixed RNG

`applyMove` now always draws; `scoreMove` must not consume `Math.random` while simulating candidates. Pass `() => 0` — the drawn card affects no score (positions only).

**Files:**
- Modify: `src/ai/score.ts:71`
- Test: `tests/ai/score.test.ts` (add one test)

**Interfaces:**
- Consumes: `applyMove(state, move, random)` (Task 2).
- Produces: no signature change — `scoreMove(state, move)` stays pure and does not read `Math.random`.

- [ ] **Step 1: Write the failing test**

In `tests/ai/score.test.ts`, add inside `describe('scoreMove', ...)`:

```ts
  it('never touches Math.random, even when the simulated move triggers a reshuffle', () => {
    let state = place(game(), 'p0m0', { zone: 'track', index: 3 })
    state = setHand(state, 0, [card('5')])
    state = { ...state, drawPile: [], discardPile: [card('2'), card('3')] }
    const move: Move = { type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5 }
    const realRandom = Math.random
    Math.random = () => { throw new Error('Math.random must not be called') }
    try {
      expect(typeof scoreMove(state, move)).toBe('number')
    } finally {
      Math.random = realRandom
    }
  })
```

(`game`, `place`, `setHand`, `card`, `scoreMove`, and the `Move` type are already imported at the top of `score.test.ts`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/ai/score.test.ts`
Expected: FAIL — `scoreMove` calls the two-argument `applyMove`, whose reshuffle uses `Math.random`, which throws.

- [ ] **Step 3: Pass a fixed RNG in `scoreMove`**

In `src/ai/score.ts`, change line 71 from:

```ts
  const after = applyMove(state, move)
```

to:

```ts
  const after = applyMove(state, move, () => 0)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/ai/score.test.ts`
Expected: PASS (all `scoreMove` tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add src/ai/score.ts tests/ai/score.test.ts
git commit -m "fix(ai): keep scoreMove pure — pass a fixed RNG to applyMove"
```

---

### Task 4: Strengthen the self-play integration test

Rewrite the lockstep test for the continuous-draw model: hands stay at five, the seeded RNG is passed explicitly to `applyMove` (no `Math.random` monkey-patch), and two runs from the same seed must match move-for-move.

**Files:**
- Modify: `tests/ai/integration.test.ts` (replace the whole file)

**Interfaces:**
- Consumes: `pickMove`, `scoreMove`, `pickRandomMove`, `WEIGHTS`, `applyMove(state, move, random)`, `createGame`, `getLegalMoves`.

- [ ] **Step 1: Replace the test file**

Overwrite `tests/ai/integration.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { pickMove, scoreMove, pickRandomMove, WEIGHTS } from '../../src/ai'
import { applyMove, createGame, getLegalMoves } from '../../src/engine'

// Deterministic Park-Miller LCG so self-play is fully reproducible. The same
// seeded stream is threaded into createGame, pickMove (tie-break), and applyMove
// (per-turn draw + reshuffle), so nothing reads the global Math.random.
const makeRandom = (seed: number): (() => number) => {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

const playGame = (seed: number) => {
  const random = makeRandom(seed)
  let state = createGame(['bot', 'bot', 'bot', 'bot'], random)
  const moveLog: string[] = []
  let iterations = 0
  const maxIterations = 20000
  while (state.winner === null && iterations < maxIterations) {
    iterations += 1
    const moveList = getLegalMoves(state, state.currentPlayer)
    expect(moveList.length).toBeGreaterThan(0)
    // Continuous-draw invariant: every active seat always holds exactly five cards.
    for (const player of state.playerList) {
      if (player.kind !== 'inactive') expect(player.hand).toHaveLength(5)
    }
    const move = pickMove(state, random)
    moveLog.push(JSON.stringify(move))
    state = applyMove(state, move, random)
  }
  return { state, moveLog }
}

describe('AI public API', () => {
  it('exposes the bot surface through the barrel', () => {
    expect(typeof pickMove).toBe('function')
    expect(typeof scoreMove).toBe('function')
    expect(typeof pickRandomMove).toBe('function')
    expect(WEIGHTS.finish).toBeGreaterThan(WEIGHTS.capture)
  })
})

describe('bot self-play', () => {
  it('plays four greedy bots to a conclusion with every hand held at five', () => {
    const { state } = playGame(12345)
    const someoneReachedFinish = state.marbleList.some(marble => marble.position.zone === 'finish')
    expect(state.winner !== null || someoneReachedFinish).toBe(true)
  })

  it('is fully deterministic: two runs from the same seed match move for move', () => {
    const first = playGame(999)
    const second = playGame(999)
    expect(first.moveLog).toEqual(second.moveLog)
    expect(first.state).toEqual(second.state)
  })
})
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm test tests/ai/integration.test.ts`
Expected: PASS — the hand-size invariant holds every turn, the game reaches a finish/winner, and both seeded runs are identical.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add tests/ai/integration.test.ts
git commit -m "test(ai): self-play — assert constant hand of five and seeded determinism"
```

---

### Task 5: Update the authoritative docs

Bring `CLAUDE.md` and the authoritative specs in line with the continuous-draw model and remove stale `redealIfNeeded` references.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-07-15-tock-terminal-design.md`
- Modify: `docs/superpowers/specs/2026-07-16-tock-ui-design.md`
- Modify: `docs/superpowers/specs/2026-07-16-tock-ai-design.md`

- [ ] **Step 1: Update `CLAUDE.md`**

Line ~96, change:

```
├── state.ts    createGame, redealIfNeeded, colorOf / marbleId helpers
```

to:

```
├── state.ts    createGame, drawCard, colorOf / marbleId helpers
```

Lines ~111-112, change:

```
import: `createGame` / `redealIfNeeded`, `getLegalMoves(state, playerId): Move[]`,
`applyMove(state, move): GameState`, `nextPlayer`, the board helpers (`ringSize`,
```

to:

```
import: `createGame`, `getLegalMoves(state, playerId): Move[]`,
`applyMove(state, move, random?): GameState`, `nextPlayer`, the board helpers (`ringSize`,
```

- [ ] **Step 2: Update the terminal design spec (§5.1 flow + §6.3 API)**

In `docs/superpowers/specs/2026-07-15-tock-terminal-design.md`, replace the `**Flow**` paragraph (lines ~161-164):

```
**Flow**: a hand of **5 cards** per player. On their turn, a player plays **one**
card and performs the move; if they have no legal move, they **discard** a card
(without moving). Empty hands → redeal. Draw pile exhausted → reshuffle the
discard pile.
```

with:

```
**Flow**: a hand of **5 cards** per player. On their turn, a player plays **one**
card and performs the move; if they have no legal move, they **discard** a card
(without moving). Either way they then **draw one card**, so the hand always
stays at five (continuous draw — no round-based redeal). The played card enters
the discard pile **before** the draw; when the draw pile is empty it is
reshuffled from the discard pile (the just-played card included) before drawing.
```

Replace the `applyMove` bullet in §6.3 (lines ~186-188):

```
- `applyMove(state, move): GameState` — applies the move, handles **captures** (a
  marble landing on an opponent's marble → sent back to the nest), returns a
  **new** immutable state.
```

with:

```
- `applyMove(state, move, random = Math.random): GameState` — applies the move,
  handles **captures** (a marble landing on an opponent's marble → sent back to
  the nest), draws the actor's replacement card (reshuffling the discard pile
  into an empty draw pile via `random`), and returns a **new** immutable state.
```

- [ ] **Step 3: Update the UI design spec**

In `docs/superpowers/specs/2026-07-16-tock-ui-design.md`, line ~117, change:

```
the played card, refills hands (`redealIfNeeded`), and sets `winner`; the UI
```

to:

```
the played card, draws the actor's replacement card, and sets `winner`; the UI
```

- [ ] **Step 4: Update the AI design spec**

In `docs/superpowers/specs/2026-07-16-tock-ai-design.md`, first read the three regions to get exact paragraph boundaries: `pnpm exec sed -n '70,90p;170,190p;198,210p' docs/superpowers/specs/2026-07-16-tock-ai-design.md` (or open the file).

(a) Replace the entire `**`scoreMove` value-purity, with one caveat.**` bullet (starts at line ~74; runs to the end of that bullet, before the next `-` bullet) with:

```
- **`scoreMove` value-purity.** `scoreMove`'s returned number is deterministic
  and it never mutates its inputs. It calls the engine's `applyMove`, which now
  draws a replacement card each turn; `scoreMove` passes a **fixed** RNG
  (`applyMove(state, move, () => 0)`) for its throwaway simulations, so it never
  reads the global `Math.random`. The drawn card is irrelevant to the score
  (`scoreMove` reads marble positions only, never hands or piles), so the
  heuristic is both value-deterministic and side-effect-free with respect to the
  global RNG stream — safe for a future seeded-replay / networked mode.
```

(b) Replace the empty-move-list rationale (lines ~176-181, from `no legal moves (defensive). In **normal cadence...` through `...genuinely empty hand). The`) so it reflects continuous draw. Replace:

```
  no legal moves (defensive). In **normal cadence this never happens**: active
  hands deplete in lockstep (one card per turn, round-robin) and `applyMove`
  runs `redealIfNeeded` in the same step, refilling **all** active hands the
  moment they would all be empty. So at the start of every turn the current
  player holds at least one card, and `getLegalMoves` returns at least a
  `discard` (`getLegalMoves` returns `[]` only for a genuinely empty hand). The
```

with:

```
  no legal moves (defensive). In **normal cadence this never happens**: every
  active hand stays at five because `applyMove` draws one replacement card in the
  same step it plays one (continuous draw). So at the start of every turn the
  current player holds five cards, and `getLegalMoves` returns at least a
  `discard` (`getLegalMoves` returns `[]` only for a genuinely empty hand). The
```

(c) Remove the now-implemented follow-up bullet in §7 (lines ~202-208), the entire bullet starting `- **RNG-injectable `applyMove` (engine follow-up)**` through `...deterministic seeded replay / networked play.` — it is delivered by this change.

- [ ] **Step 5: Verify no stale references remain in the authoritative docs**

Run: `grep -n "redealIfNeeded" CLAUDE.md docs/superpowers/specs/2026-07-15-tock-terminal-design.md docs/superpowers/specs/2026-07-16-tock-ui-design.md docs/superpowers/specs/2026-07-16-tock-ai-design.md`
Expected: no matches. (Historical `docs/superpowers/plans/` files are intentionally left untouched.)

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-07-15-tock-terminal-design.md docs/superpowers/specs/2026-07-16-tock-ui-design.md docs/superpowers/specs/2026-07-16-tock-ai-design.md
git commit -m "docs: continuous draw — align CLAUDE.md and specs, drop redealIfNeeded"
```

---

## Self-Review

**1. Spec coverage** (against `2026-07-17-tock-continuous-draw-design.md`):
- §2 rule change (draw one after playing, hands stay at five, redeal removed) → Task 2.
- §3 `applyMove` ordering (discard before draw) + `drawCard` helper + both-piles-empty guard → Task 1 (`drawCard`, guard) + Task 2 (ordering).
- §4 bot determinism (`scoreMove` fixed RNG) → Task 3.
- §5 public API impact (`applyMove` gains `random`, `redealIfNeeded` removed) → Task 2.
- §6 files touched → Tasks 2, 3, 5.
- §7 testing (apply-move bookkeeping, rounds→continuous-draw, new draw.test.ts, self-play lockstep) → Tasks 1, 2, 4.
- §8 non-goals (no geometry/heuristic/deal-size changes) → respected; no task alters those.

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". All code and doc edits are shown verbatim; the only "read first" step (Task 5 Step 4) is a doc-boundary lookup followed by exact replacement text.

**3. Type consistency:** `drawCard` returns `{ card: Card | null, drawPile: Card[], discardPile: Card[] }` in Task 1 and is consumed with those exact fields (`drawn.card`, `drawn.drawPile`, `drawn.discardPile`) in Task 2. `applyMove(state, move, random = Math.random)` defined in Task 2 is called as `applyMove(state, move, () => 0)` in Task 3 and `applyMove(state, move, random)` in Task 4 — consistent. `withTurnDone(state, actor, move, marbleList, random)` and `applySplit(state, actor, move, random)` signatures match all their call sites.

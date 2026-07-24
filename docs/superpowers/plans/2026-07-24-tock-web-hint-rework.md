# Tock web — hint rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline, phase-only turn hint in the web app with an extracted `<Hint>` component + a pure `hintFor`/`useHint` layer that produces card-aware, teaching text, and give the 7-split hint room above the gauge.

**Architecture:** All work is in `apps/web`; `@tock/core` and `apps/terminal` are untouched. A pure `hintFor(ctx: HintContext): string` in `apps/web/src/hint.ts` is the single source of hint wording, wrapped by a one-line `useHint` hook and rendered by a dumb `<Hint>` chip component. `GameScreen` builds a `HintContext` from its existing interaction state and stacks `<Hint>` above `<SplitControls>` in one bottom-anchored absolute column, with the board shifted up so the overlay never overlaps it.

**Tech Stack:** TypeScript (strict), React 19, Vite, Vitest + jsdom + @testing-library/react, pnpm workspace.

## Global Constraints

- Code and comments in **English**; user-facing hint strings are **French** (verbatim from the spec's §4 table).
- **No semicolons, no trailing commas.** ESLint **max-warnings: 0** — no unused imports/vars.
- **No `function` keyword** — const arrow functions only.
- **No non-null assertions (`!`)** in production code (tests may use them).
- Variables camelCase, descriptive, **no plural** (`moveList`, not `moves`) — but note the spec/interfaces below name the param `moves` inside `HintContext` (a fixed field name in the type); keep that field name exactly as typed.
- `@tock/core` is imported only via the package name `@tock/core`, never a relative path.
- Run commands from the repo root; target the package: `pnpm --filter @tock/web ...`.
- Node: prefix pnpm/node commands with the nvm v24 PATH (tool shells default to Node 18).

---

### Task 1: `hintFor` pure function + `useHint` hook

**Files:**
- Create: `apps/web/src/hint.ts`
- Create: `apps/web/src/hooks/useHint.ts`
- Test: `apps/web/tests/hint.test.ts`

**Interfaces:**
- Consumes: `Card`, `Move` types from `@tock/core`.
- Produces:
  - `type HintContext` (discriminated union, exported from `hint.ts`):
    ```ts
    | { kind: 'idle' }
    | { kind: 'onlyDiscards' }
    | { kind: 'pickCard' }
    | { kind: 'ghosts', card: Card, moves: Move[] }
    | { kind: 'swapSource' }
    | { kind: 'swapTarget' }
    | { kind: 'split', focused: boolean, remaining: number }
    ```
  - `const hintFor = (ctx: HintContext): string` (exported from `hint.ts`).
  - `const useHint = (ctx: HintContext): string` (exported from `hooks/useHint.ts`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/hint.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Card, Move } from '@tock/core'
import type { HintContext } from '../src/hint'
import { hintFor } from '../src/hint'
import { useHint } from '../src/hooks/useHint'

const card = (rank: Card['rank']): Card => ({ rank, suit: 'clubs' })
const moveMove = (rank: Card['rank'], steps: number): Move => ({ type: 'move', card: card(rank), marbleId: 'p0m0', steps })
const exitMove = (rank: Card['rank']): Move => ({ type: 'exit', card: card(rank), marbleId: 'p0m0' })
const pushMove: Move = { type: 'push', card: card('5'), marbleId: 'p1m0', steps: 5 }
const split7Single: Move = { type: 'split7', card: card('7'), partList: [{ marbleId: 'p0m0', steps: 7 }] }

describe('hintFor', () => {
  it('is empty when it is not the human turn', () => {
    expect(hintFor({ kind: 'idle' })).toBe('')
  })

  it('prompts a card pick and a stuck-hand discard', () => {
    expect(hintFor({ kind: 'pickCard' })).toBe('choisis une carte')
    expect(hintFor({ kind: 'onlyDiscards' })).toBe('aucun coup — touche une carte pour la défausser')
  })

  it('teaches the 5 (push) and the 4 (backward)', () => {
    expect(hintFor({ kind: 'ghosts', card: card('5'), moves: [pushMove] }))
      .toBe('avance un adversaire de 5 — choisis lequel')
    expect(hintFor({ kind: 'ghosts', card: card('4'), moves: [moveMove('4', -4)] }))
      .toBe('recule ta bille de 4 cases — choisis laquelle')
  })

  it('treats a single-marble 7 as a plain advance of 7', () => {
    expect(hintFor({ kind: 'ghosts', card: card('7'), moves: [split7Single] }))
      .toBe('avance ta bille de 7')
  })

  it('varies the Ace hint by whether exit and move are available', () => {
    expect(hintFor({ kind: 'ghosts', card: card('A'), moves: [exitMove('A'), moveMove('A', 1)] }))
      .toBe("l'As sort une bille ou l'avance de 1")
    expect(hintFor({ kind: 'ghosts', card: card('A'), moves: [exitMove('A')] }))
      .toBe("l'As fait sortir une bille")
    expect(hintFor({ kind: 'ghosts', card: card('A'), moves: [moveMove('A', 1)] }))
      .toBe('avance ta bille de 1')
  })

  it('varies the King hint the same way', () => {
    expect(hintFor({ kind: 'ghosts', card: card('K'), moves: [exitMove('K'), moveMove('K', 13)] }))
      .toBe("le Roi sort une bille ou l'avance de 13")
    expect(hintFor({ kind: 'ghosts', card: card('K'), moves: [exitMove('K')] }))
      .toBe('le Roi fait sortir une bille')
    expect(hintFor({ kind: 'ghosts', card: card('K'), moves: [moveMove('K', 13)] }))
      .toBe('avance ta bille de 13')
  })

  it('reads the step count from the move for a plain forward card (Queen = 12)', () => {
    expect(hintFor({ kind: 'ghosts', card: card('Q'), moves: [moveMove('Q', 12)] }))
      .toBe('avance ta bille de 12')
    expect(hintFor({ kind: 'ghosts', card: card('3'), moves: [moveMove('3', 3)] }))
      .toBe('avance ta bille de 3')
  })

  it('guides the Jack swap in two steps', () => {
    expect(hintFor({ kind: 'swapSource' })).toBe('échange 2 billes — choisis la tienne')
    expect(hintFor({ kind: 'swapTarget' })).toBe('choisis la bille adverse à échanger')
  })

  it('guides the 7-split progressively', () => {
    expect(hintFor({ kind: 'split', focused: false, remaining: 7 }))
      .toBe('le 7 se répartit — choisis une bille')
    expect(hintFor({ kind: 'split', focused: true, remaining: 7 }))
      .toBe("choisis jusqu'où avancer")
    expect(hintFor({ kind: 'split', focused: false, remaining: 4 }))
      .toBe('continue — répartis les 4 pas restants')
    expect(hintFor({ kind: 'split', focused: false, remaining: 1 }))
      .toBe('continue — répartis le pas restant')
    expect(hintFor({ kind: 'split', focused: false, remaining: 0 })).toBe('')
  })
})

describe('useHint', () => {
  it('returns exactly what hintFor returns', () => {
    const ctx: HintContext = { kind: 'pickCard' }
    expect(useHint(ctx)).toBe(hintFor(ctx))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tock/web test tests/hint.test.ts`
Expected: FAIL — cannot resolve `../src/hint` / `../src/hooks/useHint` (modules not created).

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/hint.ts`:

```ts
import type { Card, Move } from '@tock/core'

export type HintContext =
  | { kind: 'idle' }
  | { kind: 'onlyDiscards' }
  | { kind: 'pickCard' }
  | { kind: 'ghosts', card: Card, moves: Move[] }
  | { kind: 'swapSource' }
  | { kind: 'swapTarget' }
  | { kind: 'split', focused: boolean, remaining: number }

// Forward step count read straight off the enumerated move, so a Queen yields 12
// without re-deriving a rank->steps map here.
const forwardSteps = (moves: Move[]): number => {
  const forward = moves.find(move => move.type === 'move')
  return forward && forward.type === 'move' ? forward.steps : 0
}

const ghostsHint = (card: Card, moves: Move[]): string => {
  const hasExit = moves.some(move => move.type === 'exit')
  const hasMove = moves.some(move => move.type !== 'exit' && move.type !== 'discard')
  switch (card.rank) {
    case '5': return 'avance un adversaire de 5 — choisis lequel'
    case '4': return 'recule ta bille de 4 cases — choisis laquelle'
    case '7': return 'avance ta bille de 7'
    case 'A':
      if (hasExit && hasMove) return "l'As sort une bille ou l'avance de 1"
      if (hasExit) return "l'As fait sortir une bille"
      return 'avance ta bille de 1'
    case 'K':
      if (hasExit && hasMove) return "le Roi sort une bille ou l'avance de 13"
      if (hasExit) return 'le Roi fait sortir une bille'
      return 'avance ta bille de 13'
    default: return `avance ta bille de ${forwardSteps(moves)}`
  }
}

const splitHint = (focused: boolean, remaining: number): string => {
  if (focused) return "choisis jusqu'où avancer"
  if (remaining === 0) return ''
  if (remaining === 7) return 'le 7 se répartit — choisis une bille'
  return remaining === 1
    ? 'continue — répartis le pas restant'
    : `continue — répartis les ${remaining} pas restants`
}

export const hintFor = (ctx: HintContext): string => {
  switch (ctx.kind) {
    case 'idle': return ''
    case 'onlyDiscards': return 'aucun coup — touche une carte pour la défausser'
    case 'pickCard': return 'choisis une carte'
    case 'ghosts': return ghostsHint(ctx.card, ctx.moves)
    case 'swapSource': return 'échange 2 billes — choisis la tienne'
    case 'swapTarget': return 'choisis la bille adverse à échanger'
    case 'split': return splitHint(ctx.focused, ctx.remaining)
  }
}
```

Create `apps/web/src/hooks/useHint.ts`:

```ts
import type { HintContext } from '../hint'
import { hintFor } from '../hint'

// Thin hook wrapper: the wording logic lives in the pure hintFor, so it is unit-
// tested without React; the hook keeps GameScreen declarative.
export const useHint = (ctx: HintContext): string => hintFor(ctx)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tock/web test tests/hint.test.ts`
Expected: PASS (both `describe` blocks green).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hint.ts apps/web/src/hooks/useHint.ts apps/web/tests/hint.test.ts
git commit -m "feat(web): add pure hintFor + useHint hint layer"
```

---

### Task 2: `<Hint>` chip component

**Files:**
- Create: `apps/web/src/components/Hint.tsx`
- Test: `apps/web/tests/hint.test.tsx`

**Interfaces:**
- Consumes: `theme` from `../theme` (uses `theme.radius.sm`).
- Produces: `const Hint = ({ text }: { text: string }) => ...` — renders a felt chip `<div>` when `text` is non-empty, returns `null` when `text` is `''`. Styling copied from the old inline chip **minus** `whiteSpace: 'nowrap'` and the absolute positioning (the parent now positions it); **plus** `maxWidth` + `textAlign: 'center'` so long teaching lines wrap.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/hint.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Hint } from '../src/components/Hint'

describe('Hint', () => {
  it('renders the text', () => {
    render(<Hint text="choisis une carte" />)
    expect(screen.getByText('choisis une carte')).toBeInTheDocument()
  })

  it('renders nothing when the text is empty', () => {
    const { container } = render(<Hint text="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('wraps long lines instead of clipping (no nowrap)', () => {
    render(<Hint text="le Roi sort une bille ou l'avance de 13" />)
    const chip = screen.getByText("le Roi sort une bille ou l'avance de 13")
    expect(chip.style.whiteSpace).not.toBe('nowrap')
    expect(chip.style.textAlign).toBe('center')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tock/web test tests/hint.test.tsx`
Expected: FAIL — cannot resolve `../src/components/Hint`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/Hint.tsx`:

```tsx
import { theme } from '../theme'

type HintProps = { text: string }

// Discreet felt chip. Positioning is owned by the parent overlay column; this
// component only styles the pill and wraps long teaching lines.
export const Hint = ({ text }: HintProps) => {
  if (text === '') return null
  return (
    <div style={{ maxWidth: 300, textAlign: 'center', fontSize: 12, lineHeight: 1.35, color: 'rgba(232,234,240,.62)', background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.13)', borderRadius: theme.radius.sm, padding: '4px 12px', pointerEvents: 'none' }}>{text}</div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tock/web test tests/hint.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Hint.tsx apps/web/tests/hint.test.tsx
git commit -m "feat(web): add Hint chip component"
```

---

### Task 3: Wire the hint into `GameScreen` + unify the bottom overlay + update tests

**Files:**
- Modify: `apps/web/src/components/GameScreen.tsx`
- Test: `apps/web/tests/gameScreen.test.tsx`

**Interfaces:**
- Consumes: `hintFor`/`HintContext` (via `useHint`) from Task 1, `<Hint>` from Task 2, existing `movesForCard` (already imported), `splitRemaining` (already imported), `<SplitControls>` (already imported).
- Produces: no new exported API — `GameScreen` renders `<Hint>` inside one absolute, bottom-anchored flex **column** (`data-testid="split-overlay"`) that also holds `<SplitControls>` during the split phase, inside a board container tagged `data-testid="board-stage"` with a reserved `paddingBottom`.

**Context — exact current code being replaced (from `GameScreen.tsx`):**
- Import `import { theme } from '../theme'` (line 12) — **remove** (only the inline chip used it).
- The `hint` ternary (lines ~108–112) — **replace** with a `HintContext` builder + `useHint`.
- The board container `<div>` (line ~120), the inline hint chip `<div>` (lines ~133–135), and the split overlay `<div data-testid="split-overlay">` (lines ~136–150) — **replace** with the unified structure below.

- [ ] **Step 1: Update the failing tests first (TDD — assert the new strings/structure)**

In `apps/web/tests/gameScreen.test.tsx` make these exact edits:

1. Line ~22 — the fresh-game Ace reveals ghosts (exit only, no marble on track):
   - from: `expect(screen.getByText('choisis où poser ta bille')).toBeInTheDocument()`
   - to: `expect(screen.getByText("l'As fait sortir une bille")).toBeInTheDocument()`
2. Line ~63 — the single-marble 7 routed through the ghost flow:
   - from: `expect(screen.getByText('choisis où poser ta bille')).toBeInTheDocument()`
   - to: `expect(screen.getByText('avance ta bille de 7')).toBeInTheDocument()`
3. Line ~137 — Jack source step:
   - from: `expect(screen.getByText('choisis ta bille à échanger')).toBeInTheDocument()`
   - to: `expect(screen.getByText('échange 2 billes — choisis la tienne')).toBeInTheDocument()`
4. Line ~144 — Jack target step (in the "makes you pick which marble" test):
   - from: `expect(screen.getByText('choisis la bille adverse')).toBeInTheDocument()`
   - to: `expect(screen.getByText('choisis la bille adverse à échanger')).toBeInTheDocument()`
5. Line ~166 — Jack auto-select target step:
   - from: `expect(screen.getByText('choisis la bille adverse')).toBeInTheDocument()`
   - to: `expect(screen.getByText('choisis la bille adverse à échanger')).toBeInTheDocument()`

Then append three new tests inside the `describe('GameScreen (human turn interaction)', ...)` block (before its closing `})`):

```tsx
  it('teaches the push when a 5 is tapped', async () => {
    let state = createGame(['human', 'bot'], 48)
    state = place(state, 'p1m0', { zone: 'track', index: 30 })
    state = setHand(state, 0, [card('5', 'clubs')])
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('card-5-clubs'))
    expect(screen.getByText('avance un adversaire de 5 — choisis lequel')).toBeInTheDocument()
  })

  it('guides the 7-split progressively', async () => {
    let rigged = place(createGame(['human', 'bot'], 48), 'p0m0', { zone: 'track', index: 10 })
    rigged = place(rigged, 'p0m1', { zone: 'track', index: 30 })
    const state = setHand(rigged, 0, [card('7', 'clubs')])
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('card-7-clubs'))
    expect(screen.getByText('le 7 se répartit — choisis une bille')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('select-marble-p0m0'))
    expect(screen.getByText("choisis jusqu'où avancer")).toBeInTheDocument()
  })

  it('reserves bottom clearance so the hint does not overlap the board', () => {
    const state = setHand(createGame(['human', 'bot'], 48), 0, [card('A', 'clubs')])
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={vi.fn()} />)
    const stage = screen.getByTestId('board-stage')
    expect(parseInt(stage.style.paddingBottom, 10)).toBeGreaterThanOrEqual(32)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tock/web test tests/gameScreen.test.tsx`
Expected: FAIL — old strings not found / `board-stage` testid missing / new hint strings not rendered.

- [ ] **Step 3: Rewire `GameScreen.tsx`**

Edit `apps/web/src/components/GameScreen.tsx`:

(a) **Remove** the theme import (line 12): delete `import { theme } from '../theme'`.

(b) **Add** these imports near the other local imports (after the `SplitControls` import line):

```tsx
import type { HintContext } from '../hint'
import { useHint } from '../hooks/useHint'
import { Hint } from './Hint'
```

(c) **Replace** the `hint` ternary block (the `const hint = ...` spanning lines ~108–112) with a context builder + hook. Insert this in place of that block (keep the surrounding `turnLine`, `selectedIndex`, `selectedMarbleId` lines as they are):

```tsx
  const buildHintContext = (): HintContext => {
    if (!humanTurn) return { kind: 'idle' }
    if (onlyDiscards) return { kind: 'onlyDiscards' }
    switch (interaction.phase) {
      case 'pickCard': return { kind: 'pickCard' }
      case 'swapTarget': return interaction.marbleId === null ? { kind: 'swapSource' } : { kind: 'swapTarget' }
      case 'split': return { kind: 'split', focused: interaction.focusMarbleId !== null, remaining: splitRemaining(interaction.draft) }
      case 'ghosts': {
        const card = hand[interaction.cardIndex]
        return card ? { kind: 'ghosts', card, moves: movesForCard(card, legalMoves) } : { kind: 'pickCard' }
      }
    }
  }
  const hint = useHint(buildHintContext())
```

(d) **Replace** the board-container `<div>` opening tag, the inline hint chip block, and the split-overlay block with the unified structure. That is, the region from the `<div style={{ position: 'relative', flex: 1, ...>` open (line ~120) through the split overlay's closing `</div>)}` (line ~150) becomes:

```tsx
      <div data-testid="board-stage" style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', paddingBottom: BOARD_BOTTOM_CLEARANCE }}>
        <Board
          state={state}
          ghostList={ghostList.map(ghost => ({ key: ghost.key, cx: ghost.cx, cy: ghost.cy, label: ghost.label }))}
          onGhost={handleGhost}
          selectedMarbleId={selectedMarbleId}
          selectableMarbleIds={interaction.phase === 'split' ? splitCandidates : interaction.phase === 'swapTarget' ? swapSourceIds : undefined}
          onSelectMarble={interaction.phase === 'split'
            ? (id: MarbleId) => setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: interaction.draft, focusMarbleId: id })
            : interaction.phase === 'swapTarget'
              ? (id: MarbleId) => setInteraction({ phase: 'swapTarget', cardIndex: interaction.cardIndex, marbleId: id })
              : undefined}
        />
        <div data-testid="split-overlay" style={{ position: 'absolute', left: 0, right: 0, bottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
          <Hint text={hint} />
          {interaction.phase === 'split' && (
            <div style={{ pointerEvents: 'auto' }}>
              <SplitControls
                remaining={splitRemaining(interaction.draft)}
                canPlay={completedSplitMove(interaction.draft, legalMoves) !== undefined}
                onUndo={() => setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: undoLast(interaction.draft), focusMarbleId: null })}
                onPlay={() => {
                  const done = completedSplitMove(interaction.draft, legalMoves)
                  if (done) doCommit(done)
                }}
              />
            </div>
          )}
        </div>
      </div>
```

(e) **Add** the clearance constant just above the `GameScreen` component definition (below the `Interaction` type):

```tsx
// Bottom space reserved in the board stage so the overlay column (hint chip, and
// the taller split gauge) never overlaps the board. Tuned visually in Task 4.
const BOARD_BOTTOM_CLEARANCE = 44
```

- [ ] **Step 4: Run the web suite to verify it passes**

Run: `pnpm --filter @tock/web test`
Expected: PASS — all web tests green (including the 3 new tests and the 5 edited assertions). If `board-stage` clearance assertion fails, confirm `BOARD_BOTTOM_CLEARANCE >= 32`.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @tock/web typecheck`
Expected: clean (no unused `theme` import; `buildHintContext`'s switch is exhaustive over `interaction.phase`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/GameScreen.tsx apps/web/tests/gameScreen.test.tsx
git commit -m "feat(web): card-aware hints + unified bottom overlay in GameScreen"
```

---

### Task 4: Visual layout verification + full-workspace verification

**Files:**
- Modify (only if the visual check requires it): `apps/web/src/components/GameScreen.tsx` (tune `BOARD_BOTTOM_CLEARANCE`)

**Interfaces:**
- Consumes: everything from Tasks 1–3. Produces: no new API — a verified, non-overlapping layout and a green workspace.

- [ ] **Step 1: Build and preview the app**

Run: `pnpm --filter @tock/web build`
Expected: build succeeds, `apps/web/dist/` emitted.
Then run (background/preview): `pnpm --filter @tock/web preview`
Open the served URL (mobile viewport, e.g. 390×844).

- [ ] **Step 2: Visually verify no overlap in the normal phase**

Start a solo-vs-bot game, reach a human turn, tap a card that produces a multi-line teaching hint (e.g. an Ace with a marble already out → `l'As sort une bille ou l'avance de 1`).
Confirm: the hint chip sits below the board with **no overlap** onto the board sockets/marbles, and the layout does not shift horizontally.

- [ ] **Step 3: Visually verify the split phase**

Reach a turn where a 7 can be split across two marbles; tap the 7.
Confirm: the progressive hint (`le 7 se répartit — choisis une bille`) sits **above** the `SplitControls` gauge (7 pips + Undo/Play), the two are stacked with a small gap, and neither overlaps the board. Tap a marble → hint changes to `choisis jusqu'où avancer`.

- [ ] **Step 4: Tune the clearance if needed**

If either phase overlaps the board, increase `BOARD_BOTTOM_CLEARANCE` in `GameScreen.tsx` (step up toward ~120 to also clear the split gauge, drawing from the ample space above the board) and rebuild. If the board is pushed too high with a large empty band, lower it, keeping it `>= 32` (the hint-only minimum) so the `board-stage` test still passes. Re-verify Steps 2–3.

- [ ] **Step 5: Full workspace verification**

Run: `pnpm -r typecheck`
Expected: clean across `@tock/core`, `@tock/terminal`, `@tock/web`.
Run: `pnpm -r test`
Expected: all suites pass. Web count is the previous total **+ ~15** (Task 1 hint.test.ts ~10 cases, Task 2 hint.test.tsx 3, Task 3 gameScreen +3). Note the exact counts printed.

- [ ] **Step 6: Commit (only if the clearance was tuned in Step 4)**

```bash
git add apps/web/src/components/GameScreen.tsx
git commit -m "fix(web): tune board bottom clearance so the hint overlay never overlaps"
```

---

## Self-Review

**Spec coverage:**
- §3 architecture (hint.ts + useHint.ts + Hint.tsx, GameScreen builds HintContext) → Tasks 1, 2, 3. ✓
- §3.1 `HintContext` union + the phase→context mapping → Task 1 (type) + Task 3 (`buildHintContext`). ✓
- §4 wording table (base / ghosts / Jack / split) → Task 1 `hintFor` + Task 1 tests assert every row incl. Queen=12, singular "pas restant". ✓
- §5 layout (unified absolute column, board shifted up via clearance, chip wraps without nowrap, renders null when empty) → Task 2 (chip wrap/null) + Task 3 (column + `paddingBottom`) + Task 4 (visual tune). ✓
- §6 testing (hint.test.ts, hint.test.tsx, gameScreen assertions updated + card-specific + progressive split) → Tasks 1–3. ✓
- §7 YAGNI (no terminal, no emoji, generic pickCard, empty on spent split) → honored (`splitHint` returns `''` at remaining 0; no icons; pickCard generic). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; the one tunable value (`BOARD_BOTTOM_CLEARANCE`) has a concrete initial value (44) and an explicit visual-tuning step with bounds (`>= 32`). ✓

**Type consistency:** `HintContext` field names (`kind`, `card`, `moves`, `focused`, `remaining`, `marbleId`-free) are identical in Task 1's type, Task 1's tests, and Task 3's `buildHintContext`. `hintFor`/`useHint`/`Hint` names match across tasks. `data-testid` values (`split-overlay`, `board-stage`, `select-marble-<id>`, `card-<rank>-<suit>`) match the tests. ✓

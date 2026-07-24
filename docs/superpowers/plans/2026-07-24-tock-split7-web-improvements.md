# 7-split web improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the web app, make a 7 behave like an ordinary move card when only one marble can move, and render the 7-split panel as a non-reflowing overlay.

**Architecture:** Both changes are confined to `apps/web`; `@tock/core` and `apps/terminal` are untouched. The engine already models "the whole 7 on one marble" as a single-part `split7`, so Request 1 is a pure UI routing change in `moveSelection.ts` (feeding the existing ghost flow), and Request 2 lifts `SplitControls` out of the flex column into the board's already-`position: relative` container as an absolute overlay.

**Tech Stack:** TypeScript (strict), React 19, Vite, Vitest + @testing-library/react + jsdom, pnpm workspace.

## Global Constraints

- Node v24 (`node -v` → v24.x); run all commands from the repo root `/home/eguillaume/workspace/tock`.
- Code and comments in **English**. No semicolons. No trailing commas. No `function` keyword — use `const` arrow functions. **No non-null assertions (`!`) in production code** (tests may use them).
- Variables camelCase, descriptive, no plural (`idList`, not `ids`).
- Scope is `apps/web` only. Do not modify `packages/core` or `apps/terminal`.
- Run one package's tests with `pnpm --filter @tock/web test`; typecheck with `pnpm -r typecheck`.

---

## File Structure

- Modify: `apps/web/src/moveSelection.ts` — `isSplitCard` (candidate-count rule), `landingMarbleId` + `ghostsForCard` (single-part `split7` ghosts).
- Modify: `apps/web/src/components/GameScreen.tsx` — suppress the split hint; render `SplitControls` as an absolute overlay inside the board container.
- Modify: `apps/web/src/components/SplitControls.tsx` — strengthen the backdrop so the floating panel stays legible.
- Modify (tests): `apps/web/tests/moveSelection.test.ts` — replace the single-ring-marble "is a split card" test with single-vs-two-marble expectations.
- Modify (tests): `apps/web/tests/gameScreen.test.tsx` — replace the single-marble full-split-flow test with a two-marble version, add a single-marble ghost-flow test, add an overlay test.

---

## Task 1: Single movable marble ⇒ the 7 acts like a normal move card

**Files:**
- Modify: `apps/web/src/moveSelection.ts`
- Test: `apps/web/tests/moveSelection.test.ts`, `apps/web/tests/gameScreen.test.tsx`

**Interfaces:**
- Consumes: `movesForCard(card, legalMoves): Move[]`, `applyMove`, `marbleCenter` (all already present in `moveSelection.ts`); the engine's `split7` move shape `{ type: 'split7', card, partList: { marbleId, steps, enterLane? }[] }`.
- Produces: `isSplitCard(card, legalMoves): boolean` now returns `true` only when ≥2 distinct marbles appear across the card's `split7` partitions; `ghostsForCard(card, state, legalMoves): Ghost[]` now emits a ghost for a one-part `split7` (label = steps, or `⌂` when it enters the lane).

- [ ] **Step 1: Rewrite the two affected unit tests to express the new behavior**

In `apps/web/tests/moveSelection.test.ts`, replace the existing test (currently "a 7 with a marble on the ring is a split card with no ghosts", lines ~45–54) with these two tests:

```ts
  it('a 7 with a single movable marble is not a split card and yields ghosts', () => {
    const state = setHand(
      place(createGame(['human', 'bot'], 48), 'p0m0', { zone: 'track', index: 10 }),
      0,
      [card('7', 'clubs')]
    )
    const legal = getLegalMoves(state, 0)
    expect(isSplitCard(card('7', 'clubs'), legal)).toBe(false)
    const ghostList = ghostsForCard(card('7', 'clubs'), state, legal)
    expect(ghostList.length).toBeGreaterThanOrEqual(1)
    expect(ghostList.every(ghost => ghost.move.type === 'split7')).toBe(true)
  })

  it('a 7 with two movable marbles is a split card', () => {
    const state = setHand(
      place(
        place(createGame(['human', 'bot'], 48), 'p0m0', { zone: 'track', index: 10 }),
        'p0m1',
        { zone: 'track', index: 30 }
      ),
      0,
      [card('7', 'clubs')]
    )
    const legal = getLegalMoves(state, 0)
    expect(isSplitCard(card('7', 'clubs'), legal)).toBe(true)
  })
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm --filter @tock/web test moveSelection`
Expected: FAIL — the "single movable marble is not a split card" test fails because `isSplitCard` currently returns `true` for any `split7`, and `ghostsForCard` currently returns `[]` for a 7.

- [ ] **Step 3: Implement the `moveSelection.ts` changes**

In `apps/web/src/moveSelection.ts`, replace the current `isSplitCard` (lines ~15–16) with a candidate-count rule plus a private helper:

```ts
// Distinct own marbles that appear across the card's 7-split partitions.
const splitCandidateCount = (card: Card, legalMoves: Move[]): number => {
  const idSet = new Set<MarbleId>()
  for (const move of movesForCard(card, legalMoves)) {
    if (move.type === 'split7') for (const part of move.partList) idSet.add(part.marbleId)
  }
  return idSet.size
}

// A 7 needs the allocation panel only when two or more marbles can share it.
// With a single movable marble the 7 degenerates to a normal move card, routed
// through the ghost flow like a Queen or King.
export const isSplitCard = (card: Card, legalMoves: Move[]): boolean =>
  splitCandidateCount(card, legalMoves) > 1
```

Replace `landingMarbleId` (lines ~25–28) so a one-part `split7` previews like an ordinary move:

```ts
// The marble whose landing a ghost should mark: the actor's marble for
// exit/move/push, and — for a single-part 7 (only one movable marble) — that
// marble. Multi-part splits go through the allocation panel and never reach here.
const landingMarbleId = (move: Move): MarbleId | null => {
  if (move.type === 'exit' || move.type === 'move' || move.type === 'push') return move.marbleId
  if (move.type === 'split7' && move.partList.length === 1) return move.partList[0]?.marbleId ?? null
  return null
}
```

Add a `ghostLabel` helper just above `ghostsForCard`, and use it inside `ghostsForCard` in place of the inline `label` expression:

```ts
// The glyph shown on a destination ghost: '⌂' when the marble enters its finish
// lane, otherwise the step count; empty for an exit (it lands on the start cell).
const ghostLabel = (move: Move): string => {
  const part = move.type === 'split7' ? move.partList[0] : undefined
  const entersLane = (move.type === 'move' && move.enterLane === true) || part?.enterLane === true
  if (entersLane) return '⌂'
  if (move.type === 'split7') return part ? String(part.steps) : ''
  return 'steps' in move ? String(move.steps) : ''
}
```

Inside `ghostsForCard`, replace the line

```ts
    const label = move.type === 'move' && move.enterLane ? '⌂' : String('steps' in move ? move.steps : '')
```

with

```ts
    const label = ghostLabel(move)
```

(Leave the surrounding `ghostList.push({ key: \`ghost-${index}\`, move, cx: point.x, cy: point.y, label: label || undefined })` unchanged.)

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `pnpm --filter @tock/web test moveSelection`
Expected: PASS (all `moveSelection` tests green).

- [ ] **Step 5: Rewrite the GameScreen 7-flow tests**

In `apps/web/tests/gameScreen.test.tsx`, replace the existing test "drives the full 7-split flow: pick marble, spend steps, then Play" (lines ~53–80) with these two tests:

```ts
  it('routes a 7 with a single movable marble through the ghost flow (no split panel)', async () => {
    const rigged = place(createGame(['human', 'bot'], 48), 'p0m0', { zone: 'track', index: 10 })
    const state = setHand(rigged, 0, [card('7', 'clubs')])
    const commitMove = vi.fn()
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={commitMove} />)

    await userEvent.click(screen.getByLabelText('card-7-clubs'))

    // One movable marble: the 7 behaves like a normal move card — ghost
    // destinations appear immediately and no allocation panel is shown.
    expect(screen.getByText('choisis où poser ta bille')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /jouer le 7/i })).toBeNull()

    await userEvent.click(screen.getByLabelText('ghost-7'))

    expect(commitMove).toHaveBeenCalledTimes(1)
    expect(commitMove.mock.calls[0]?.[0]).toMatchObject({ type: 'split7' })
  })

  it('drives the full 7-split flow with two movable marbles: panel, spend steps, Play', async () => {
    let rigged = place(createGame(['human', 'bot'], 48), 'p0m0', { zone: 'track', index: 10 })
    rigged = place(rigged, 'p0m1', { zone: 'track', index: 30 })
    const state = setHand(rigged, 0, [card('7', 'clubs')])
    const commitMove = vi.fn()
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={commitMove} />)

    await userEvent.click(screen.getByLabelText('card-7-clubs'))

    // Two movable marbles: the allocation panel is shown.
    expect(screen.getByRole('button', { name: /jouer le 7/i })).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('select-marble-p0m0'))
    // Give the whole 7 to the first marble (its lone full-7 landing).
    await userEvent.click(screen.getByLabelText('ghost-7'))

    expect(screen.getByText('0 ✓')).toBeInTheDocument()
    const playButton = screen.getByRole('button', { name: /jouer le 7/i })
    expect(playButton).toBeEnabled()
    expect(commitMove).not.toHaveBeenCalled()

    await userEvent.click(playButton)

    expect(commitMove).toHaveBeenCalledTimes(1)
    expect(commitMove.mock.calls[0]?.[0]).toMatchObject({ type: 'split7' })
  })
```

- [ ] **Step 6: Run the GameScreen tests to verify they pass**

Run: `pnpm --filter @tock/web test gameScreen`
Expected: PASS. (No `GameScreen.tsx` code change is needed for routing — a single-candidate 7 now fails `isSplitCard`, so `handleCard` falls through to the ghost phase automatically.)

- [ ] **Step 7: Typecheck and run the whole web suite**

Run: `pnpm -r typecheck && pnpm --filter @tock/web test`
Expected: typecheck clean; all `@tock/web` tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/moveSelection.ts apps/web/tests/moveSelection.test.ts apps/web/tests/gameScreen.test.tsx
git commit -m "feat(web): a single-marble 7 plays like a normal move card

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Split panel as a non-reflowing overlay

**Files:**
- Modify: `apps/web/src/components/GameScreen.tsx`
- Modify: `apps/web/src/components/SplitControls.tsx`
- Test: `apps/web/tests/gameScreen.test.tsx`

**Interfaces:**
- Consumes: the board container `<div style={{ position: 'relative', flex: 1, … }}>` already present in `GameScreen.tsx`; `SplitControls` props `{ remaining, canPlay, onUndo, onPlay }` (unchanged).
- Produces: a `data-testid="split-overlay"` wrapper with inline `position: absolute` around `SplitControls`, rendered inside the board container; the `'répartis le 7'` hint chip is suppressed during the split phase.

- [ ] **Step 1: Write the failing overlay test**

In `apps/web/tests/gameScreen.test.tsx`, add this test inside the `describe` block:

```ts
  it('renders the split panel as an out-of-flow overlay (no layout reflow)', async () => {
    let rigged = place(createGame(['human', 'bot'], 48), 'p0m0', { zone: 'track', index: 10 })
    rigged = place(rigged, 'p0m1', { zone: 'track', index: 30 })
    const state = setHand(rigged, 0, [card('7', 'clubs')])
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('card-7-clubs'))

    const overlay = screen.getByTestId('split-overlay')
    expect(overlay.style.position).toBe('absolute')
    expect(screen.getByRole('button', { name: /jouer le 7/i })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @tock/web test gameScreen`
Expected: FAIL — `getByTestId('split-overlay')` throws (no such element yet), since `SplitControls` currently renders as a bare flex sibling.

- [ ] **Step 3: Move `SplitControls` into the board container as an absolute overlay and suppress the split hint**

In `apps/web/src/components/GameScreen.tsx`:

(a) Suppress the redundant hint during split. Change the `hint` computation line that reads:

```ts
    : interaction.phase === 'split' ? 'répartis le 7'
```

to:

```ts
    : interaction.phase === 'split' ? ''
```

(b) In the render, move the `SplitControls` block from between the board container and `<Hand />` into the board container itself, as an absolute overlay. The board container block currently reads:

```tsx
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
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
        {hint && (
          <div style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', fontSize: 12, color: 'rgba(232,234,240,.62)', background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.13)', borderRadius: theme.radius.sm, padding: '4px 12px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{hint}</div>
        )}
      </div>
      {interaction.phase === 'split' && (
        <SplitControls
          remaining={splitRemaining(interaction.draft)}
          canPlay={completedSplitMove(interaction.draft, legalMoves) !== undefined}
          onUndo={() => setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: undoLast(interaction.draft), focusMarbleId: null })}
          onPlay={() => {
            const done = completedSplitMove(interaction.draft, legalMoves)
            if (done) doCommit(done)
          }}
        />
      )}
```

Replace that whole span with (the `SplitControls` block now lives inside the board container, wrapped in an absolute overlay; the outer flex sibling is removed):

```tsx
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
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
        {hint && (
          <div style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', fontSize: 12, color: 'rgba(232,234,240,.62)', background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.13)', borderRadius: theme.radius.sm, padding: '4px 12px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{hint}</div>
        )}
        {interaction.phase === 'split' && (
          <div data-testid="split-overlay" style={{ position: 'absolute', left: 0, right: 0, bottom: 8, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
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
          </div>
        )}
      </div>
```

- [ ] **Step 4: Strengthen the `SplitControls` backdrop for legibility over the felt**

In `apps/web/src/components/SplitControls.tsx`, change the root wrapper style (line ~9) from:

```tsx
    <div style={{ margin: '0 16px', background: 'rgba(0,0,0,.24)', borderRadius: theme.radius.md, padding: '9px 11px' }}>
```

to:

```tsx
    <div style={{ margin: '0 16px', background: 'rgba(12,10,20,.72)', border: '1px solid rgba(255,255,255,.13)', boxShadow: '0 8px 22px rgba(0,0,0,.45)', borderRadius: theme.radius.md, padding: '9px 11px' }}>
```

- [ ] **Step 5: Run the overlay test to verify it passes**

Run: `pnpm --filter @tock/web test gameScreen`
Expected: PASS (including the new overlay test and the Task 1 two-marble flow test, which asserts the `Jouer le 7` button — not the removed hint).

- [ ] **Step 6: Typecheck and run the whole workspace suite**

Run: `pnpm -r typecheck && pnpm -r test`
Expected: typecheck clean; every package's suite passes (core, terminal, web). The `splitControls` and `splitAllocation` suites remain green (no behavioral change to the allocation machinery).

- [ ] **Step 7: Manual sanity check (optional but recommended)**

Run: `pnpm --filter @tock/web dev`, start a solo game, and confirm: (1) a 7 with a single movable marble shows ghost destinations directly (no pip panel); (2) a 7 with two movable marbles shows the split panel floating above the hand with no board jump when it appears/disappears.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/GameScreen.tsx apps/web/src/components/SplitControls.tsx apps/web/tests/gameScreen.test.tsx
git commit -m "feat(web): float the 7-split panel as a non-reflowing overlay

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Request 1 (single movable marble ⇒ normal move card) → Task 1 (`isSplitCard` candidate-count rule + single-part `split7` ghosts; routing emerges in `GameScreen` with no logic change). ✓
- Request 2 (non-reflowing overlay) → Task 2 (absolute overlay inside the board container + suppressed split hint + strengthened backdrop). ✓
- Preserved edge cases (≥2 marbles ⇒ panel; lone marble that can't absorb 7 ⇒ discard-only) → covered by the two-marble test and unchanged engine behavior. ✓
- Tests called for in the spec (moveSelection unit, GameScreen single/two-marble, overlay position) → Task 1 Steps 1/5 and Task 2 Step 1. ✓

**Placeholder scan:** No TBD/TODO; every code step shows exact code and every run step shows the command and expected result.

**Type consistency:** `splitCandidateCount`/`isSplitCard`/`landingMarbleId`/`ghostLabel` all use `Card`, `Move`, `MarbleId` (already imported in `moveSelection.ts`). `SplitControls` prop names (`remaining`, `canPlay`, `onUndo`, `onPlay`) are unchanged. The overlay wrapper testid `split-overlay` matches the test query.

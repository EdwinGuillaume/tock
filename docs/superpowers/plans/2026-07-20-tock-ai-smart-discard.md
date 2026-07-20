# Smart Discard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the "Normal" bot is forced to discard, make it throw its least-useful card and keep the strong ones, instead of discarding at random.

**Architecture:** AI-only change (no engine, no rules, no UI). A new pure helper `cardKeepValue(rank)` ranks the 13 ranks; `pickMove` uses it as a tie-break refinement among the tied `discard` moves — the only situation where discards appear in `getLegalMoves`. `scoreMove` is untouched.

**Tech Stack:** TypeScript (strict), Vitest, pnpm.

## Global Constraints

- Code and comments in **English**.
- **No semicolons, no trailing commas.**
- **No `function` keyword** — use `const` arrow functions.
- **No non-null assertions (`!`) in production code** (`src/`); the only exception is unit tests. Prefer a total `Record<Key, V>` or a safe fallback over `!`.
- **Immutability / isomorphism unchanged**: `src/ai/` stays pure TypeScript with zero Node dependencies; `scoreMove` is not modified.
- Variables camelCase, descriptive, **no plural** (`moveList`, not `moves`).
- Keep-value ranking (kept longest ⟶ discarded first), copied verbatim from the spec: `4 > 7 > J > A > K > 5 > Q > 10 > 9 > 8 > 6 > 3 > 2`.
- **Run commands** in this repo must be prefixed with the Node 24 PATH (tool shells default to Node 18, which breaks Vitest/tsc): `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; `

---

### Task 1: `cardKeepValue` pure helper

**Files:**
- Modify: `src/ai/score.ts` (add the helper + extend the type import)
- Modify: `src/ai/index.ts` (re-export the helper)
- Test: `tests/ai/score.test.ts` (new `describe('cardKeepValue')` block + extend the import)

**Interfaces:**
- Consumes: `Rank` from `../engine` (re-exported by `src/engine/index.ts`).
- Produces: `cardKeepValue: (rank: Rank) => number` — higher return means the card is worth keeping longer; every rank returns a **distinct** value; `cardKeepValue('4')` is the max and `cardKeepValue('2')` is the min. Exported from `src/ai/score.ts` and re-exported from `src/ai/index.ts`. Task 2 relies on this exact signature.

- [ ] **Step 1: Write the failing tests**

In `tests/ai/score.test.ts`, change the first two import lines to add `cardKeepValue` and the `Rank` type:

```ts
import { scoreMove, WEIGHTS, cardKeepValue } from '../../src/ai/score'
import { createGame } from '../../src/engine'
import { place, setHand, card } from '../../tests/support'
import type { GameState, Move, Rank } from '../../src/engine'
```

Then append this block at the end of the file (after the final `})` of `describe('scoreMove', ...)`):

```ts
describe('cardKeepValue', () => {
  it('ranks the cards from most to least worth keeping, all distinct', () => {
    const orderedFromKeep: Rank[] = ['4', '7', 'J', 'A', 'K', '5', 'Q', '10', '9', '8', '6', '3', '2']
    const valueList = orderedFromKeep.map(cardKeepValue)
    const descending = [...valueList].sort((left, right) => right - left)
    expect(valueList).toEqual(descending)
    expect(new Set(valueList).size).toBe(valueList.length)
  })

  it('makes the 4 the most valuable and the 2 the least', () => {
    const allRank: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
    const valueList = allRank.map(cardKeepValue)
    expect(cardKeepValue('4')).toBe(Math.max(...valueList))
    expect(cardKeepValue('2')).toBe(Math.min(...valueList))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm test tests/ai/score.test.ts`
Expected: FAIL — `cardKeepValue` is not exported (`cardKeepValue is not a function` / type error).

- [ ] **Step 3: Implement `cardKeepValue`**

In `src/ai/score.ts`, add `Rank` to the type-only import (first line):

```ts
import type { GameState, Marble, Move, PlayerId, Rank } from '../engine'
```

Then insert this block immediately after the `WEIGHTS` declaration (before `export const advancement`):

```ts
// How much the bot wants to keep each card when it is forced to discard: higher
// means held longer, so the lowest-valued offered card is thrown first. The 4
// tops the list — played right after an exit it sends a marble to start - 4,
// three cells behind its own lane mouth, saving almost a full lap. Then the
// flexible / high-impact specials (7, J, A, K), the offensive 5, and finally the
// plain forward cards by descending reach (the 2 is dumped first). Every rank
// gets a distinct value, so the forced-discard choice is deterministic.
const KEEP_VALUE: Record<Rank, number> = {
  '4': 13,
  '7': 12,
  J: 11,
  A: 10,
  K: 9,
  '5': 8,
  Q: 7,
  '10': 6,
  '9': 5,
  '8': 4,
  '6': 3,
  '3': 2,
  '2': 1
}

export const cardKeepValue = (rank: Rank): number => KEEP_VALUE[rank]
```

- [ ] **Step 4: Re-export from the AI barrel**

In `src/ai/index.ts`, change the first line to:

```ts
export { scoreMove, WEIGHTS, cardKeepValue } from './score'
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm test tests/ai/score.test.ts`
Expected: PASS (all `scoreMove` cases plus the two new `cardKeepValue` cases).

- [ ] **Step 6: Typecheck**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm typecheck`
Expected: no output (clean).

- [ ] **Step 7: Commit**

```bash
git add src/ai/score.ts src/ai/index.ts tests/ai/score.test.ts
git commit -m "feat(ai): add cardKeepValue rank ranking for smart discard"
```

---

### Task 2: Smart-discard tie-break in `pickMove`

**Files:**
- Modify: `src/ai/bot.ts` (import `cardKeepValue`, add the guarded tie-break)
- Test: `tests/ai/bot.test.ts` (new cases inside `describe('pickMove')`)

**Interfaces:**
- Consumes: `cardKeepValue(rank)` from `./score` (Task 1); `pickRandomMove(moveList, random)` and `getLegalMoves` / `scoreMove` (existing).
- Produces: no signature change to `pickMove(state, random?) => Move`; only its selection among tied `discard` moves changes.

- [ ] **Step 1: Write the failing tests**

In `tests/ai/bot.test.ts`, append these three cases **inside** the existing `describe('pickMove', () => { ... })` block (before its closing `})`):

```ts
  it('discards the weakest card and keeps the strong ones when forced', () => {
    // all four own marbles are home and the hand has no A/K, so nothing is
    // playable -> getLegalMoves offers only discards for {2, 4, 7}. Smart discard
    // throws the 2 (lowest keep-value) and keeps the 4 and 7.
    const state = setHand(game(), 0, [card('2'), card('4'), card('7')])
    expect(pickMove(state, () => 0)).toEqual({ type: 'discard', card: card('2') })
  })

  it('discards the lowest-value filler', () => {
    const state = setHand(game(), 0, [card('6'), card('3'), card('2')])
    expect(pickMove(state, () => 0)).toEqual({ type: 'discard', card: card('2') })
  })

  it('picks the same forced discard whatever the RNG (deterministic)', () => {
    const state = setHand(game(), 0, [card('2'), card('4'), card('7')])
    for (const value of [0, 0.5, 0.99]) {
      expect(pickMove(state, () => value)).toEqual({ type: 'discard', card: card('2') })
    }
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm test tests/ai/bot.test.ts`
Expected: FAIL — today's random tie-break may return `discard('4')` or `discard('7')` for `() => 0.99`, and even `() => 0` returns the first-enumerated discard (rank order), not the lowest-value one, so at least the deterministic/weakest assertions fail.

- [ ] **Step 3: Implement the tie-break**

In `src/ai/bot.ts`, change the `scoreMove` import (line 3) to also pull in `cardKeepValue`:

```ts
import { scoreMove, cardKeepValue } from './score'
```

Then replace the final line of `pickMove`:

```ts
  return pickRandomMove(topList, random)
```

with:

```ts
  // Forced-discard turn: getLegalMoves offers `discard` moves only when nothing
  // else is playable, so if every top move is a discard, keep the strong cards
  // and throw the weakest. The lowest keep-value is unique (distinct per rank,
  // and discards are de-duplicated by rank), so this is deterministic; the RNG
  // path is kept for uniformity and as a defensive fallback.
  const discardTop = topList.filter(move => move.type === 'discard')
  if (discardTop.length === topList.length && discardTop.length > 0) {
    const minKeep = Math.min(...discardTop.map(move => cardKeepValue(move.card.rank)))
    const weakest = discardTop.filter(move => cardKeepValue(move.card.rank) === minKeep)
    return pickRandomMove(weakest, random)
  }
  return pickRandomMove(topList, random)
```

(`move.card` is present on every `Move` variant, so `move.card.rank` needs no narrowing beyond the `type === 'discard'` filter.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm test tests/ai/bot.test.ts`
Expected: PASS (the three new cases plus all existing `pickMove` / `pickRandomMove` cases — the existing productive-move and empty-hand cases are unaffected because the guard fires only when every top move is a discard).

- [ ] **Step 5: Run the full suite + typecheck (no regressions)**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm test && pnpm typecheck`
Expected: all tests pass; typecheck clean. In particular `tests/ai/score.test.ts` (discard ≈ 0, push-vs-discard comparisons) is unchanged because `scoreMove` was not touched.

- [ ] **Step 6: Commit**

```bash
git add src/ai/bot.ts tests/ai/bot.test.ts
git commit -m "feat(ai): keep strong cards on a forced discard"
```

---

### Task 3: Documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-07-16-tock-ai-design.md` (move "Smart discard" from deferred to implemented)
- Modify: `CLAUDE.md` (note `cardKeepValue` in the module layout + AI public surface)

**Interfaces:** none (documentation only).

- [ ] **Step 1: Update the AI spec — the forced-discard edge case**

In `docs/superpowers/specs/2026-07-16-tock-ai-design.md`, replace this paragraph:

```
- **Forced discards** — when the hand is non-empty but nothing else is playable,
  `getLegalMoves` offers `discard` moves; they all score ≈ 0 (no progress, no
  capture, no exposure change on already-safe boards), so the random tie-break
  picks among them. (Smart discard is deferred, §7.)
```

with:

```
- **Forced discards (smart discard)** — when the hand is non-empty but nothing
  else is playable, `getLegalMoves` offers `discard` moves; they all score ≈ 0
  (no progress, no capture, no exposure change on already-safe boards), so they
  form the tied top set. Rather than pick at random, `pickMove` throws the card
  with the lowest **keep-value** and holds the rest, via the pure helper
  `cardKeepValue(rank)` (in `score.ts`). Keep-value ranking (kept longest ⟶
  discarded first): `4 > 7 > J > A > K > 5 > Q > 10 > 9 > 8 > 6 > 3 > 2` — the 4
  leads because, played just after an exit, it lands a marble at `start - 4`, a
  few cells behind its own lane mouth, saving almost a full lap. Each rank has a
  distinct value and discards are de-duplicated by rank, so the choice is
  deterministic (RNG-independent). `scoreMove` is unchanged; smart discard lives
  in the selector. See `docs/superpowers/specs/2026-07-20-tock-ai-smart-discard-design.md`.
```

- [ ] **Step 2: Update the AI spec — remove the deferred bullet**

In the same file, in "## 7. Deferred / future work", delete this line:

```
- **Smart discard** — prefer dumping filler over 7 / Jack / Ace / King.
```

- [ ] **Step 3: Update `CLAUDE.md` — module layout**

In `CLAUDE.md`, replace the `score.ts` line in the `src/ai/` module-layout block:

```
├── score.ts    scoreMove (before→after delta via applyMove) + WEIGHTS, advancement, exposureFor — all pure
```

with:

```
├── score.ts    scoreMove (before→after delta via applyMove) + WEIGHTS, advancement, exposureFor, cardKeepValue (smart-discard ranking) — all pure
```

- [ ] **Step 4: Update `CLAUDE.md` — AI public surface**

In `CLAUDE.md`, replace this sentence:

```
The bot's public surface (`src/ai/index.ts`) is the only thing a UI imports to
drive a seat: `pickMove` / `pickRandomMove` (selection) and `scoreMove` /
`WEIGHTS` (the pure heuristic).
```

with:

```
The bot's public surface (`src/ai/index.ts`) is the only thing a UI imports to
drive a seat: `pickMove` / `pickRandomMove` (selection) and `scoreMove` /
`WEIGHTS` / `cardKeepValue` (the pure heuristic).
```

- [ ] **Step 5: Verify the referenced identifiers exist**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; grep -n "cardKeepValue" src/ai/index.ts src/ai/score.ts`
Expected: matches in both files (confirms the docs point at real exports).

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-16-tock-ai-design.md CLAUDE.md
git commit -m "docs(ai): mark smart discard implemented"
```

---

## Notes for the implementer

- **Why the tie-break lives in `pickMove`, not `scoreMove`:** discards appear in `getLegalMoves` **only** when no productive move is legal (the `result.length === 0` fallback in `moves.ts`), and a discard moves no marble so all discards score identically. They therefore always form the tied top set, and a discard never competes with a productive move on score. Baking card value into `scoreMove` would instead break the existing `score.test.ts` invariants (a discard scores ≈ 0; the push-vs-discard tests use a discard as the neutral reference). Do not modify `scoreMove`.
- **`Record<Rank, number>` over a `switch` with a default:** a total record makes the compiler enforce all 13 ranks and avoids a `default`/`!` the style rules forbid.
- **Out of scope:** voluntary discard (discarding while a productive move is legal) — that would change the Tock rules and the engine; not part of this plan.

# Tock Web Audio — distinct lane-entry cue — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the moment a marble crosses into its finish lane its own sound (`'laneEntry'`), split out from the classic `move` cue, triggered by the exact same before/after diff the lane-entry animation uses.

**Architecture:** Extends `apps/web/src/audio/`. Adds a `'laneEntry'` SoundId and reworks `soundForMove` to consult `laneEntries(before, after)` (from `apps/web/src/laneFx.ts`, the animation's own detector). `@tock/core` untouched.

**Tech Stack:** TypeScript (strict), React 19, Vitest + jsdom.

## Global Constraints

- **Node:** prefix every `pnpm`/`node` command with `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; ` (Node ≥ 22).
- **Package boundary:** `apps/web` only. Do NOT touch `@tock/core`.
- **Code style:** no semicolons, no trailing commas, no `function` keyword (const arrow functions), no non-null `!` in production code (tests may), English identifiers/comments, ESLint max-warnings 0. No two statements packed on one line with `;`.
- **Branch:** continue on `feat/web-audio`.
- **Trigger parity:** detect lane entry with `laneEntries(before, after)` from `../laneFx` — NOT `Move.enterLane` — so the cue fires exactly when the animation does.
- **Decided mapping:** plain `move` entering → `'laneEntry'` replaces `'move'`; `split7` entering → `'split7'` + layered `'laneEntry'`; within-lane / classic → `'move'`; capture/win accents unchanged.
- **Spec:** `docs/superpowers/specs/2026-07-28-tock-web-audio-design.md` (see the 2026-07-28 lane-entry addendum).
- Tests live flat in `apps/web/tests/`. Commit at the end.

## File Structure

**Modified:**
- `apps/web/src/audio/sounds.ts` — add `'laneEntry'` to `SoundId` + a manifest entry.
- `apps/web/public/audio/README.md` — narrow the `move` row to classic displacement, add a `laneEntry` row.
- `apps/web/src/audio/soundForMove.ts` — import `laneEntries`, compute `entered`, apply the decided mapping.
- `apps/web/tests/soundForMove.test.ts` — new cases (move entering, split7 entering, within-lane stays move).

---

### Task 1: Distinct `'laneEntry'` cue in `soundForMove`

**Files:**
- Modify: `apps/web/src/audio/sounds.ts`
- Modify: `apps/web/public/audio/README.md`
- Modify: `apps/web/src/audio/soundForMove.ts`
- Test: `apps/web/tests/soundForMove.test.ts`

**Interfaces:**
- Produces: `SoundId` now includes `'laneEntry'`; `soundForMove` emits it per the decided mapping.

- [ ] **Step 1: Write the failing tests**

Add these cases to `apps/web/tests/soundForMove.test.ts` inside the existing `describe('soundForMove', ...)`. They use synthetic states shaped like the existing tests; a finish position needs an `index`, because `laneEntries` reads `post.position.index`.

```ts
  it('plays laneEntry instead of move when a marble crosses into the finish lane', () => {
    const before = { marbleList: [{ id: 'p0-0', owner: 0, position: { zone: 'ring' } }], winner: null } as unknown as GameState
    const after = { marbleList: [{ id: 'p0-0', owner: 0, position: { zone: 'finish', index: 0 } }], winner: null } as unknown as GameState
    expect(soundForMove(before, after, { type: 'move' } as Move)).toEqual(['laneEntry'])
  })

  it('layers laneEntry over split7 when a 7-split part enters the lane', () => {
    const before = { marbleList: [{ id: 'p0-0', owner: 0, position: { zone: 'ring' } }], winner: null } as unknown as GameState
    const after = { marbleList: [{ id: 'p0-0', owner: 0, position: { zone: 'finish', index: 0 } }], winner: null } as unknown as GameState
    expect(soundForMove(before, after, { type: 'split7' } as Move)).toEqual(['split7', 'laneEntry'])
  })

  it('keeps move for an advance within the lane (no re-trigger)', () => {
    const before = { marbleList: [{ id: 'p0-0', owner: 0, position: { zone: 'finish', index: 0 } }], winner: null } as unknown as GameState
    const after = { marbleList: [{ id: 'p0-0', owner: 0, position: { zone: 'finish', index: 1 } }], winner: null } as unknown as GameState
    expect(soundForMove(before, after, { type: 'move' } as Move)).toEqual(['move'])
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/soundForMove.test.ts`
Expected: FAIL — `'laneEntry'` is not a valid SoundId yet (typecheck/compile error in the test) and `soundForMove` still returns `['move']` / `['split7']`.

- [ ] **Step 3: Add the `laneEntry` SoundId + manifest entry**

In `apps/web/src/audio/sounds.ts`, extend the `SoundId` union and manifest. Add `'laneEntry'` to the accent/UI group of the union:

```ts
export type SoundId =
  | 'exit' | 'move' | 'push' | 'swap' | 'split7' | 'discard'
  | 'capture' | 'win'
  | 'draw'
  | 'tap'
  | 'laneEntry'
```

Add to `soundManifest` (after the `tap` entry; `tap` gains a trailing comma because a line now follows it, `laneEntry` is last with none):

```ts
  tap: { pool: ['tap-1', 'tap-2'], volume: 0.5 },
  laneEntry: { pool: ['lane-entry-1'], volume: 0.7 }
```

- [ ] **Step 4: Rework `soundForMove`**

Replace the body of `apps/web/src/audio/soundForMove.ts`'s `soundForMove` (keep `soundsForCommit` unchanged) and add the import:

```ts
import type { GameState, Move } from '@tock/core'
import { laneEntries } from '../laneFx'
import { capturedColorList } from './gameEvents'
import type { SoundId } from './sounds'

// The Move union member names double as SoundIds, so move.type maps directly.
// A marble crossing into its finish lane is a special beat: detected by the same
// before/after diff the lane-entry animation uses (laneEntries), so the cue fires
// exactly when the animation does — for a plain move OR a 7-split part. A plain
// move that enters replaces 'move' with 'laneEntry'; any other entering move
// type (e.g. split7) keeps its own cue and layers 'laneEntry' on top. Multiple
// ids are the superposition case (e.g. ['split7','laneEntry']) — played together.
export const soundForMove = (before: GameState, after: GameState, move: Move): SoundId[] => {
  const entered = laneEntries(before, after).length > 0
  const base: SoundId = move.type === 'move' && entered ? 'laneEntry' : move.type
  const list: SoundId[] = [base]
  if (entered && base !== 'laneEntry') list.push('laneEntry')
  if (capturedColorList(before, after).length > 0) list.push('capture')
  if (after.winner !== null) list.push('win')
  return list
}
```

(`soundsForCommit` below it is unchanged.)

- [ ] **Step 5: Update the README cue table**

In `apps/web/public/audio/README.md`:
- Narrow the `move-1, move-2, move-3` row's "Fires when" to a classic displacement that does NOT cross into the lane (e.g. "A marble advances along the ring or **within** the finish lane (also a backward 4), without crossing the lane mouth.").
- Add a new row after it:

```
| `lane-entry-1` | A marble **crosses into its finish lane** (the audible twin of the lane-entry animation; a plain move replaces its `move` cue, a 7-split layers this on top). | A marked "home-stretch" beat — a chime/swoosh as the marble turns for home. |
```

- [ ] **Step 6: Run the tests + full suite**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/soundForMove.test.ts`
Expected: PASS (new lane-entry cases + the existing move/capture/win/draw cases still green — the capture test's after-zone is `home`, not `finish`, so `entered` stays false there).

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test`
Expected: PASS — the manifest loop in `sounds.test.ts` now also covers `laneEntry` (non-empty pool); nothing else affected.

- [ ] **Step 7: Typecheck + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web typecheck
git add apps/web/src/audio/sounds.ts apps/web/public/audio/README.md apps/web/src/audio/soundForMove.ts apps/web/tests/soundForMove.test.ts
git commit -m "feat(web): distinct lane-entry sound cue"
```

---

## Self-Review

**Spec coverage** (against the lane-entry addendum): detection via `laneEntries` (not `enterLane`) → Step 4 import + `entered`. `'laneEntry'` SoundId → Step 3. Plain move entering replaces `move`; split7 entering layers → Step 4 (`base` ternary + the `entered && base !== 'laneEntry'` push). Within-lane / classic stays `move` → covered by `laneEntries` skipping already-`finish` marbles (Step 1 third test). Capture/win accents unchanged → Step 4 keeps those two lines. README updated → Step 5.

**Placeholder scan:** none; every step has concrete code.

**Type consistency:** `'laneEntry'` added to `SoundId` (Step 3) and produced by `soundForMove` (Step 4); manifest entry gives it a non-empty pool so `sounds.test.ts`'s loop passes. No signature changes to `soundForMove`/`soundsForCommit`.

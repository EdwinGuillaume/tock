# Smart discard — keep the strong cards — Design document

- **Date**: 2026-07-20
- **Status**: approved (brainstorming), ready for the implementation plan
- **Author**: eguillaume

## 1. Context & goal

The engine, the "Normal" bot, and the Ink TUI are built, tested, and merged. The
authoritative rules live in `docs/superpowers/specs/2026-07-15-tock-terminal-design.md`
(the game) and `docs/superpowers/specs/2026-07-16-tock-ai-design.md` (the bot).

Today, when the bot is **forced to discard** — its hand holds cards but none is
playable — every `discard` move scores ≈ 0 in `scoreMove`, so `pickMove` breaks
the tie **at random** and throws away an arbitrary card. This wastes cards the
bot would rather keep (a 7, a Jack, the backward-4 shortcut).

This document designs the **"Smart discard"** feature listed as deferred in the
AI spec (§7): when the bot must discard, it should **keep its most useful cards
and throw the least useful one**. The change is **AI-only** and does not touch
the rules or the engine.

The architectural constraints are unchanged (terminal spec §3–§4): the engine
stays isomorphic and JSON-serializable, `applyMove` stays immutable, and both the
human and the bot choose only from `getLegalMoves`.

## 2. The behaviour (decided)

- **Forced discard only.** The bot still plays a productive move whenever one is
  legal. Smart discard applies **only** on a forced-discard turn — a non-empty
  hand with no playable move — which is exactly when `getLegalMoves` emits
  `discard` moves and nothing else. This respects the Tock rule "you must play if
  you can"; no voluntary discard is introduced, and the engine is untouched.
- **Keep the strong cards, dump the weakest.** Among the offered `discard` moves,
  the bot discards the card with the **lowest keep-value** and holds the rest.
- **Keep-value ranking** (kept longest ⟶ discarded first):

  ```
  4  >  7  >  J  >  A  >  K  >  5  >  Q  >  10 >  9  >  8  >  6  >  3  >  2
  ```

  - **4 is the most valuable.** A backward-4 played just after a marble exits
    lands it at `start − 4`, three cells behind its own lane mouth (`start − 1`),
    saving almost a full lap around the ring. This shortcut makes the 4 the card
    the bot most wants to keep.
  - **7, J, A, K next** — the flexible / high-impact specials (split, swap, exit
    + 1, exit + 13), matching the original AI-spec intent "prefer dumping filler
    over 7 / Jack / Ace / King".
  - **5 next** — offensive push value, above plain forward cards.
  - **Plain forward cards `Q,10,9,8,6,3,2`** rank by descending reach; the **2**
    is the least valuable and is discarded first.
- **The discarded card is uniquely determined.** `getLegalMoves` de-duplicates
  discards by rank, and every rank has a **distinct** keep-value, so the offered
  discards always have distinct keep-values and the lowest one is unique. The
  smart discard is therefore **deterministic** — independent of the RNG. The
  selector still routes the (singleton) result through the same RNG tie-break used
  elsewhere, purely for uniformity and as a defensive fallback should two ranks
  ever be given the same keep-value.

## 3. Why the selection layer, not `scoreMove` (approach B)

Two approaches were considered.

- **A — fold card value into `scoreMove`**: make a `discard` score
  `= −keepValue(card)`. Rejected: it breaks existing `score.test.ts` invariants
  (`discard('4')` must score `0`; the push-vs-discard tests use a discard as the
  "neutral ≈ 0" reference) and couples the discard penalty to the exposure/push
  weights — fragile and meaningless outside a forced-discard turn.
- **B — tie-break in `pickMove` (chosen)**: `scoreMove` is left **unchanged**
  (a discard still scores ≈ 0). Because `getLegalMoves` emits `discard` moves
  **only** when no other move is legal (the `result.length === 0` fallback), all
  offered discards arrive together and, moving no marble, score **identically**.
  So they always form the tied top set, and the smart choice is purely a
  **tie-break refinement** in the selector.

Approach B is minimal and isolated, keeps `scoreMove` pure, and breaks **no**
existing test.

### Invariant preserved

A discard never outscores a productive move — guaranteed **by construction**, not
by tuning: discards and productive moves never coexist in a single
`getLegalMoves` result, so their relative score is never compared by `pickMove`.

## 4. AI changes

### 4.1 New pure helper `cardKeepValue` (`src/ai/score.ts`)

A pure function living beside `advancement` / `exposureFor`, re-exported from
`src/ai/index.ts`:

```ts
export const cardKeepValue = (rank: Rank): number => KEEP_VALUE[rank]
```

- Backed by a `Record<Rank, number>` (total over the 13 ranks — no non-null
  assertion, no `default` branch to forget), higher = kept longer. Values encode
  the §2 ordering, e.g. `4 → 13, 7 → 12, J → 11, A → 10, K → 9, 5 → 8, Q → 7,
  10 → 6, 9 → 5, 8 → 4, 6 → 3, 3 → 2, 2 → 1`.
- The **ordering is the contract**; the exact integers are an implementation
  detail asserted only relative to one another in tests.

### 4.2 `pickMove` tie-break (`src/ai/bot.ts`)

`pickMove` is unchanged through computing `topList` (the moves tied at
`bestScore`). The final selection gains one guarded branch:

```ts
const discardTop = topList.filter(move => move.type === 'discard')
if (discardTop.length === topList.length && discardTop.length > 0) {
  // forced-discard turn: keep the strong cards, throw the weakest
  const minKeep = Math.min(...discardTop.map(move => cardKeepValue(move.card.rank)))
  const weakest = discardTop.filter(move => cardKeepValue(move.card.rank) === minKeep)
  return pickRandomMove(weakest, random)
}
return pickRandomMove(topList, random)
```

- The guard `discardTop.length === topList.length` means "every top move is a
  discard" — the forced-discard turn. Otherwise the branch is skipped and today's
  behaviour is preserved exactly. The guard also makes the change harmless if a
  future feature ever let a discard coexist with other moves.
- `move.card` is present on every `Move` variant (all carry the played card), so
  `move.card.rank` needs no narrowing beyond the `type === 'discard'` filter.
- The RNG-driven tie-break among equally-weak discards reuses `pickRandomMove`,
  keeping bot play deterministic under a seeded RNG.

### 4.3 `scoreMove`: no change

`scoreMove` is not modified, so every `score.test.ts` case passes unchanged and
the push-vs-discard comparisons keep their "discard ≈ 0" reference intact.

## 5. Testing strategy

Tests live in `tests/ai/`, reusing `tests/support.ts` (`place`, `setHand`,
`card`) and a stub RNG for determinism.

### 5.1 `cardKeepValue` (`score.test.ts`)

- Relative ordering holds: `cardKeepValue('4')` is the maximum, and
  `4 > 7 > J > A > K > 5 > Q > 10 > 9 > 8 > 6 > 3 > 2`.
- `cardKeepValue('2')` is the minimum.

### 5.2 `pickMove` smart discard (`bot.test.ts`)

- **Forced discard keeps the strong card.** Build a forced-discard state (all four
  own marbles at `home`, hand has no `A`/`K` so no exit and no playable move),
  e.g. hand `[2, 4, 7]` → `getLegalMoves` yields discards for `{2, 4, 7}` →
  `pickMove` returns `discard('2')` (lowest keep-value), keeping the 4 and 7.
- **Lowest wins across filler**, e.g. hand `[6, 3, 2]` → discards `{6, 3, 2}` →
  picks `discard('2')`.
- **RNG-independent (deterministic).** The offered discards always have distinct
  keep-values, so the pick is unique: `pickMove` returns the same lowest-keep
  discard for several different stub RNGs (e.g. `() => 0`, `() => 0.5`,
  `() => 0.99`), proving the RNG does not change the outcome.
- **No regression on a normal turn.** A hand with a productive move still returns
  the best productive move (the existing `pickMove` cases are untouched).

## 6. Documentation to update

- **AI spec** (`2026-07-16-tock-ai-design.md`): move "Smart discard" out of §7
  (deferred) into the behaviour section — describe the forced-discard tie-break,
  the keep-value ranking (with the 4-shortcut rationale), and that it lives in the
  selector, not `scoreMove`.
- **`CLAUDE.md`**: note `cardKeepValue` in the `src/ai/score.ts` line of the
  module layout and add it to the AI public surface (`src/ai/index.ts`).

## 7. Decisions defaulted (not open questions)

- **Helper name**: `cardKeepValue`.
- **Location**: pure helper in `score.ts` (beside `advancement` / `exposureFor`),
  tie-break logic in `bot.ts` (the selector).
- **Backing structure**: a total `Record<Rank, number>` (no non-null assertion).
- **Tie-break among equal-weak discards**: injected RNG, as today.

## 8. Out of scope

- **Voluntary discard** — discarding a filler card while a productive move is
  legal (to hold a strong card for later). This changes the Tock rules and the
  engine's move generation; explicitly excluded (see §2).
- No new bot difficulty; the change is folded into the single "Normal" heuristic.
- No change to `scoreMove`, the engine, or the UI.

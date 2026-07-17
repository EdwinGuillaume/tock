# Tock — Continuous draw (constant 5-card hand)

**Date:** 2026-07-17
**Status:** Approved, ready for implementation plan
**Supersedes:** the round-based dealing described in
`2026-07-15-tock-terminal-design.md` §5.1 ("Empty hands → redeal") and every
`redealIfNeeded` mention in the UI/AI specs.

## 1. Motivation

The game currently deals a hand of five, lets every seat play its hand down to
zero, then redeals five to everyone at once (`redealIfNeeded`). We want a
smoother card flow: **each player draws one card immediately after playing**, so
a hand always holds five cards and the round boundary disappears.

## 2. The rule change

- The initial deal is unchanged: `createGame` gives each active seat five cards.
- On a turn, the player plays (or discards) exactly one card as today, **then
  draws one replacement card**, returning the hand to five.
- Hands never empty, so the grouped redeal is gone. `redealIfNeeded` is removed.
- When the draw pile is empty at draw time, the discard pile is reshuffled into
  the draw pile first (unchanged reshuffle semantics, now triggered per draw
  instead of per redeal).

With 52 cards and at most `5 × activeSeats` (≤ 20) held in hands, the draw and
discard piles together always hold ≥ 32 cards, so a replacement is always
available. A defensive guard still handles the impossible "both piles empty"
case by simply not drawing (the hand stays at four rather than crashing).

## 3. Where it happens — `applyMove`

`applyMove` stays the single path both the human and the bot take. It gains an
optional RNG so the reshuffle is deterministic under test:

```ts
applyMove(state, move, random = Math.random): GameState
```

Atomic per-turn sequence (order matters):

1. Remove the played card from the actor's hand.
2. **Push the played card onto `discardPile`.**
3. **Draw one card** from `drawPile` into the actor's hand; if `drawPile` is
   empty, reshuffle `discardPile` (which now includes the just-played card) into
   `drawPile` using `random`, then draw.
4. Advance to the next player.

Steps 2-before-3 are deliberate: the just-played card is placed in the discard
**before** the draw, so on a reshuffle it becomes eligible to be drawn back. Edge
case that follows from this: if the draw pile is empty and the discard holds only
the card just played, the actor immediately draws that same card back. This is
accepted and intended.

`applyMove` is no longer a wrapper around `redealIfNeeded`; the draw is folded
into the turn resolution (`withTurnDone` and `applySplit`), which already build
the post-move `discardPile`.

### New helper — `drawCard` (in `state.ts`)

A small pure helper owns the draw + reshuffle:

```ts
drawCard(drawPile, discardPile, random = Math.random):
  { card: Card | null, drawPile: Card[], discardPile: Card[] }
```

Returns the drawn card and the updated piles; returns `card: null` (piles
unchanged) when both piles are empty.

## 4. Bot non-regression — determinism

`scoreMove` calls `applyMove(state, move, () => 0)`:

- The drawn card affects **no** quantity `scoreMove` computes — it reads only
  marble positions (advancement, capture, entering-finish, exit urgency,
  exposure), never hand contents or pile sizes. So the hypothetical draw cannot
  change a score.
- Passing a fixed RNG keeps `scoreMove` pure: it never touches `Math.random`, so
  it cannot perturb any real game's random stream and stays deterministic for its
  score tests.

`layout.ts` (landing preview, positions only) and the UI (`App.tsx`) keep the
default `Math.random`.

## 5. Public API impact

- `applyMove` gains an optional third argument `random` (backward compatible —
  existing two-argument calls are unaffected).
- `redealIfNeeded` is **removed** from `src/engine/state.ts` and from the
  `src/engine/index.ts` barrel. `handSize`, `createGame`, and the rest of the
  surface are unchanged.
- `drawCard` is added to `state.ts`. It is an internal helper used by `moves.ts`;
  exporting it from the barrel is optional and not required by any UI.

## 6. Files touched

- `src/engine/state.ts` — remove `redealIfNeeded`, add `drawCard`.
- `src/engine/moves.ts` — thread `random` through
  `applyMove` → `applyMoveInner` / `withTurnDone` / `applySplit`; perform the
  draw; drop the `redealIfNeeded` import.
- `src/engine/index.ts` — remove the `redealIfNeeded` export.
- `src/ai/score.ts` — call `applyMove(state, move, () => 0)`.
- Docs: `CLAUDE.md`, `2026-07-15-tock-terminal-design.md` §5.1 and the API list,
  and the `redealIfNeeded` mentions in the UI/AI specs, updated to describe the
  continuous draw. (Historical plan docs under `docs/superpowers/plans/` are left
  as-is; this spec supersedes them.)

## 7. Testing (TDD, red → green per change)

- `tests/engine/apply-move.test.ts` (bookkeeping): the hand is now refilled —
  assert the played card is gone from the hand, the hand is back to its
  pre-move size, the played card is in the discard, and `currentPlayer` advanced.
- `tests/engine/rounds.test.ts`: rewrite the `redeal` block as a `continuous
  draw` block (hand returns to five, `drawPile` decrements by one per turn,
  discard grows, reshuffle when the draw pile empties). The `discard`
  enumeration block is unchanged.
- New `tests/engine/draw.test.ts`: fine-grained coverage of `drawCard` and the
  reshuffle path, including the "reshuffle can redraw the just-played card" edge
  case and the "both piles empty → no draw" guard.
- `tests/ai/integration.test.ts` (self-play lockstep): drop the "every active
  hand depletes together" invariant; assert every active seat's hand stays at
  five throughout; pass the seeded RNG explicitly to `applyMove` instead of
  monkey-patching `Math.random`; and assert two runs from the same seed produce
  identical trajectories.
- Other `applyMove` tests (exit, move+capture, lane, swap, split7, ui/format)
  assert marble positions only and are unaffected by the refill.

## 8. Non-goals

- No change to move generation, geometry, captures, the 7-split, the Jack swap,
  or the win condition.
- No change to the initial deal size (stays five) or the deck (standard 52).
- No change to the bot heuristic or its weights.

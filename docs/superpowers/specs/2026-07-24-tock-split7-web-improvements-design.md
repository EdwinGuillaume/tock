# Tock — 7-split web improvements

Date: 2026-07-24
Scope: `apps/web` only. `@tock/core` and `apps/terminal` are untouched.

## Motivation

Two rough edges in the web app's handling of the 7 card:

1. **Pointless split panel.** When the current player has only one marble that can
   actually advance, the 7 has nothing to split across — the only legal play is
   that one marble taking the whole 7. Today the web UI still forces the player
   through the progressive split panel (pick marble, allocate 7 pips, press
   "Jouer le 7") for what is really a single, ordinary move.

2. **Layout jump.** `SplitControls` renders as a flex sibling between the board
   and the hand, so mounting it shrinks the board — the screen visibly jumps
   when a split begins and jumps back when it ends.

## Background — how the 7 is modelled

The engine already represents "play the whole 7 on one marble" as a `split7`
move with a single-element `partList`. `enumerateSplits` (in
`packages/core/src/engine/moves.ts`) only assigns steps to marbles that can
legally absorb them, so:

- A marble in the nest (`zone: 'home'`) is never a candidate (already excluded).
- A marble parked at the deepest finish cell, or otherwise unable to advance,
  produces no legal part and therefore never appears in any partition.

Consequently, **when only one marble can advance, every legal `split7` for that
card references that one marble** (as one or two single-part partitions — a ring
landing, plus a lane entry when both are geometrically legal). This is exactly
the same shape of choice a Queen (12) or King (13) offers. No engine change is
needed; this is a UI routing decision.

## Request 1 — single movable marble ⇒ the 7 acts like a normal move card

### `apps/web/src/moveSelection.ts`

- **`isSplitCard(card, legalMoves)`**: return `true` only when the number of
  *distinct* marble ids across the card's `split7` partitions is **greater than
  one**. Exactly one candidate ⇒ the card is not treated as a split.
  (Today it returns `true` whenever any `split7` move exists.)
- **`ghostsForCard(card, state, legalMoves)`**: also emit a ghost for a
  one-part `split7`. `landingMarbleId` returns `partList[0].marbleId` for a
  single-part `split7` (and `null` for a multi-part one, which never reaches
  this path). The ghost label is the part's `steps` (always `7`), or `⌂` when
  the part enters the lane — matching the existing move-ghost labelling.

### `apps/web/src/components/GameScreen.tsx`

No new logic. A single-candidate 7 now fails `isSplitCard`, so `handleCard`
falls through past the split branch to `setInteraction({ phase: 'ghosts', … })`.
`ghostsForCard` yields the 1–2 destinations; tapping one calls
`doCommit(ghost.move)`, committing the single-part `split7` directly. The player
sees the same card → ghost-destination → play interaction as any other move
card, with no panel and no pip gauge.

### Preserved behaviour

- **Two or more movable marbles**: candidate count > 1 ⇒ `isSplitCard` true ⇒
  the split panel appears exactly as today.
- **A lone marble that cannot absorb a full 7** (e.g. only 3 cells left before
  the finish overshoots): no partition sums to 7, so there is no legal `split7`
  at all. The 7 remains discard-only — unchanged, and correct per Tock's rule
  that the whole 7 must be used or the card not played.

## Request 2 — split panel as a non-reflowing overlay

### `apps/web/src/components/GameScreen.tsx`

Move the `SplitControls` render out of the outer flex column and into the
board's existing `position: relative` container, wrapped in a
`position: absolute` overlay pinned bottom-centre — mirroring how the hint chip
is already positioned. Because the overlay is out of normal flow, the board
keeps its full flex height whether or not a split is in progress, so nothing
reflows.

- Suppress the `'répartis le 7'` hint chip while `interaction.phase === 'split'`:
  `SplitControls` already shows "Reste N / 0 ✓", so the chip is redundant and
  would collide with the overlay.
- Slightly strengthen the panel backdrop (currently `rgba(0,0,0,.24)`) so it
  stays legible floating over the felt board. Buttons keep default pointer
  events so Undo / Jouer le 7 remain tappable.

`SplitControls` itself (`apps/web/src/components/SplitControls.tsx`) needs at
most a backdrop tweak; its internal markup is unchanged.

## Testing (`apps/web/tests/`)

- **`moveSelection`**: `isSplitCard` returns `false` for a one-marble 7 and
  `true` for a ≥2-marble 7; `ghostsForCard` emits a destination ghost for a
  single-part `split7`.
- **`GameScreen`**: with exactly one movable marble, tapping the 7 shows ghost
  destinations and renders no `SplitControls`, and tapping a ghost commits the
  move; with two or more movable marbles, the panel still appears.
- **Overlay**: a light assertion that the `SplitControls` wrapper is
  `position: absolute` (i.e. out of flow), guarding against a regression to the
  reflowing layout.

Test fixtures build a `GameState` via the existing per-package `tests/support.ts`
rig, positioning the current player's marbles so that exactly one (vs. two) can
absorb a 7.

## Out of scope

- The terminal app (`apps/terminal`) keeps its current `SplitPanel` behaviour.
- No change to `@tock/core` — move generation, scoring, and the bot are
  untouched.

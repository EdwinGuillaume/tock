# Tock UI — Ink terminal front-end design

- **Date**: 2026-07-16
- **Status**: approved (brainstorming), ready for the implementation plan
- **Author**: eguillaume

## 1. Context & goal

The engine (`src/engine/`) and the "Normal" bot (`src/ai/`) are built, tested, and
merged (87 passing tests). This document designs the **third and final v1
milestone**: the **Ink terminal UI** (`src/ui/` + `src/index.tsx`) — the
full-screen, colored, keyboard-driven front-end that makes the game playable.

It refines the high-level sketch in the terminal design spec §9
(`2026-07-15-tock-terminal-design.md`) into a concrete implementation design. It
does **not** revisit the game rules, the data model, or the AI — those are fixed
and consumed unchanged.

The overriding constraint is unchanged from spec §3/§4: **strict engine/UI
separation**. The UI knows nothing about the rules; it drives the game purely
through the engine's public API and the AI's `pickMove`. This keeps the door open
for a future web UI on the same engine.

## 2. Scope

In scope (v1):
- An **interactive setup screen** to pick the number of bot opponents (1–3).
- A **full square board** rendered in characters, human always at the bottom,
  with colored marbles and highlighted legal choices.
- A **keyboard-driven turn** for the human: card → marble → destination, with a
  **guided step-allocation** flow for the splittable 7 and a target picker for the
  Jack.
- **Auto-played bot turns** with a short delay and a per-move recap line.
- An **end-of-game** overlay with restart / quit.

Out of scope (deferred, §13):
- Alternate-screen buffer / mouse support / resize reflow beyond a fixed layout.
- Bots-only spectator mode, an "Easy" difficulty in the menu, >4 seats, team play.
- Networked/web UI (the engine already supports it; not built here).
- Animations beyond the inter-turn delay.

## 3. Toolchain additions

The UI is the first code with runtime dependencies. Add (exact ranges pinned at
install, `pnpm-lock.yaml` committed):

- **`react` ^19.2** (latest 19.2.x) — Ink 7 peer-requires `react >=19.2.0`.
- **`ink` ^7.1** (latest 7.1.1) — React renderer for the terminal.
- **`react-devtools-core` ^6.1.2** — Ink 7 lists it as a peer dependency; add it
  explicitly so pnpm does not warn / fail on install.
- dev: **`tsx`** (run the TUI without a build), **`@types/react` ^19.2**,
  **`ink-testing-library` ^4** (render assertions for pure-ish components).

No `react-dom` — Ink uses its own reconciler.

New `package.json` scripts:
- `"dev": "tsx src/index.tsx"` — play the game.
- `"dev:watch": "tsx watch src/index.tsx"` — dev loop.

`test` / `test:watch` / `typecheck` are unchanged.

**The isomorphic wall holds:** only `src/ui/` and `src/index.tsx` may import React,
Ink, or any Node global. `src/engine/` and `src/ai/` remain pure, zero-Node-deps,
and must still `typecheck` and test without any of the above installed at their
level.

## 4. Module layout

Fills in the `ui/` folder left as a stub in terminal spec §4.

```
src/
├── index.tsx              entry point: render(<App/>)
└── ui/
    ├── App.tsx            root: phase (setup|playing|gameover) + GameState; owns commitMove
    ├── Setup.tsx          opponent-count picker (1–3 bots)
    ├── Board.tsx          draws the 13×13 square board from GameState
    ├── Hand.tsx           the human hand + card cursor / highlight
    ├── Status.tsx         whose turn · last-move recap · current prompt
    ├── GameOver.tsx       winner overlay · r = play again · q = quit
    ├── layout.ts          PURE: Position → grid [row,col]; nest & finish slots; seat → side
    ├── format.ts          PURE: Move → human-readable string; Position → short label (@12)
    ├── theme.ts           PURE: Color → Ink color name; glyph constants
    └── hooks/
        ├── useGameLoop.ts   drives bot turns on a timer; funnels every move through commitMove
        └── useTurnInput.ts  the human selection state machine (useInput)
```

**Design intent:** the real logic lives in the three **pure** modules
(`layout.ts`, `format.ts`, `theme.ts`), which are plain TypeScript with no React
and no Ink. Components stay thin: they read `GameState` + selection state and emit
`<Box>`/`<Text>`. This keeps the components easy to reason about and pushes the
testable surface into pure functions (see §11).

## 5. Game loop & state ownership

`App` owns exactly one piece of game data — the current `GameState` — plus a
`phase` discriminator:

```ts
type Phase = 'setup' | 'playing' | 'gameover'
```

Flow:
1. `phase = 'setup'`: `Setup` collects the bot count. On confirm,
   `createGame(['human', ...bots])` (seat 0 is always the human = red; the N bots
   fill seats 1… in order). Any seat past the last bot stays **inactive** — it
   keeps its quadrant on the board but shows an empty nest and has no marbles
   (terminal spec §2). Then `phase = 'playing'`.
2. `phase = 'playing'`: exactly one **`commitMove`** funnel applies every move:
   ```ts
   const commitMove = (move: Move) => setState(prev => applyMove(prev, move))
   ```
   Both the human's confirmed move **and** the bot's `pickMove` result go through
   it — the same single path the engine/AI design mandates. `applyMove` already
   advances `currentPlayer` (skipping inactive seats), handles captures, discards
   the played card, refills hands (`redealIfNeeded`), and sets `winner`; the UI
   never touches any of that.
3. `useGameLoop` reacts to each new state:
   - `winner !== null` → `phase = 'gameover'`.
   - current seat is a **bot** → start a `setTimeout(~700 ms)`; on fire,
     `commitMove(pickMove(state))` and stash the move for `Status`. The timer is
     cleared on unmount and whenever the effect re-runs, so exactly one bot move
     is scheduled per state.
   - current seat is the **human** → do nothing; `useTurnInput` awaits keys.

Because `pickMove` and `applyMove` fully encapsulate correctness, the loop is a
thin state machine: **apply → re-render → maybe schedule the next bot move**.

**Note on bot RNG:** `pickMove` (and the `applyMove` it calls internally) use
`Math.random`. That is correct for interactive play; the seeded-determinism caveat
from the AI spec §4 does not affect the UI.

## 6. The human turn — selection state machine (`useTurnInput`)

**Core principle (unchanged from the architecture):** the UI **only ever selects
from `getLegalMoves(state, human)`** — it never constructs a move from scratch, so
an illegal move is structurally impossible. The hook computes the legal-move list
once at the start of the human's turn and drives a discriminated-union selection
state:

```ts
type Selection =
  | { step: 'pickCard' }
  | { step: 'pickMarble', card: Card }
  | { step: 'pickDestination', card: Card, marbleId: MarbleId, options: Move[] }
  | { step: 'pickTarget', card: Card, marbleId: MarbleId, targets: Move[] }   // Jack
  | { step: 'splitAllocation', card: Card, alloc: SplitAlloc }                // the 7
```

### 6.1 Card selection (`pickCard`)

`←/→` (or a number key) moves a cursor over the hand; `Enter` selects.

- **Playable cards** — those that appear in a non-`discard` legal move — are
  selectable; the rest are dimmed.
- **Forced discard** — the engine only emits `discard` moves when nothing
  productive is playable (AI spec §6). If every legal move is a `discard`, the
  step's prompt becomes "no move possible — choose a card to discard"; `Enter`
  commits the `discard` for the highlighted card directly.

### 6.2 Ordinary cards (Ace / King / Queen / numbers / 4-back)

`pickCard` → **`pickMarble`**: `←/→` cycles the marbles that have a legal move with
the chosen card (highlighted on the board); `Enter` selects. → **`pickDestination`**
*only when that marble has more than one outcome* — the classic case is a landing
that can **enter the lane** *or* **stay on the ring** (the engine emits one `Move`
per outcome). `←/→` cycles the candidate landings (each highlighted in place on the
board); `Enter` commits. A single-outcome marble skips straight to commit.

Exits (Ace/King leaving the nest) are the same shape: the marble is a home marble,
its single `exit` outcome commits immediately.

### 6.3 Jack (swap)

`pickCard` → **`pickMarble`** (cycle the player's own ring marbles that can swap) →
**`pickTarget`** (cycle the capturable opponent marbles for that marble; the engine
already excludes protected start-square marbles) → commit. Both selections
highlight on the board.

### 6.4 The 7 — guided step allocation (`splitAllocation`)

The 7 is always enumerated as `split7` Moves; a full-7-on-one-marble play is simply
the partition assigning `steps: 7` to one marble. The guided flow **builds an
allocation and validates it against the enumerated partitions** — it never invents
one:

```ts
type SplitAlloc = {
  legal: SplitPart[][]                 // getLegalMoves filtered to this 7's split7 partLists
  assigned: { marbleId: MarbleId, steps: number }[]   // locked so far
  focusMarbleId: MarbleId              // marble currently being adjusted
  draftSteps: number                   // steps tentatively on the focused marble
}
```

Interaction:
1. A marble is focused. `←/→` adjusts `draftSteps` for it, but **only through
   values that keep at least one legal partition alive** given what is already
   assigned. Matching is by the engine's order-independent key: a partition is
   *compatible* when its per-marble step counts equal `assigned` for every locked
   marble and it can still accommodate the draft. This makes an illegal total
   simply unreachable.
2. `Enter` locks the focused marble at `draftSteps` and moves focus to the next
   marble with remaining legal options; the header shows `spent / 7`.
3. When `assigned` sums to 7 and matches a complete legal partition, the move is
   confirmable. If several complete partitions match the same step distribution
   but differ only by a marble's **`enterLane`** flag, a short per-marble lane
   choice (`enter lane?` yes/no) resolves it before submit.
4. The submitted Move is the exact enumerated `split7` whose `partList` matches the
   assignment (steps + resolved `enterLane`).

`Esc` / `Backspace` steps back one stage in every branch (unlock the last marble,
or return to `pickMarble` / `pickCard`).

## 7. Board rendering (`Board.tsx` + `layout.ts`)

The approved **full square board**. Geometry (all in `layout.ts`, pure):

- The ring is the **border of a 13×13 grid** = 48 cells (12 per side). Each seat's
  **start cell** sits at the **midpoint of its side**; its **finish lane** threads
  4 cells inward from there toward the centre; its **nest** (4 marbles) sits just
  **outside** the midpoint of that side.
- **Seat → side is fixed**, human at the bottom: seat 0 red = bottom, seat 1 green
  = left, seat 2 yellow = top, seat 3 blue = right. (v1 human is always seat 0, so
  no runtime rotation is needed; the mapping is a constant table.)
- `layout.ts` exposes pure maps: `ringCoord(index) → [row,col]`,
  `finishCoord(owner, index) → [row,col]`, `nestSlot(owner, index) → [row,col]`,
  and the seat→side table. These are the unit-tested heart of the render.

`Board.tsx` walks `state.marbleList`, places each marble via `layout.ts`, colors it
by owner (`theme.ts`), marks a marble on its own **protected start square**
distinctly, draws empty ring/finish cells as neutral glyphs, and overlays the
**current selection's highlighted targets** (the candidate landings / swap targets
for the active `useTurnInput` step).

**Color is real and load-bearing.** Every glyph is emitted through Ink's
`<Text color=…>`, so it renders in true terminal color — this is not a monochrome
board. Each marble is a `●` in its **owner's color** (red / green / yellow / blue),
and (chosen scheme) **color is the *sole* cue distinguishing the four players'
marbles** — no letter, no per-player shape. Empty ring cells render dim/neutral,
each finish lane is tinted in its owner's color, and a marble on its **protected
start square** is emphasized (inverse / bold). Selection highlights use a distinct
emphasis so the human's current legal targets stand out from the marble colors.
The ASCII mockups in this doc look monochrome only because Markdown cannot carry
ANSI color; the running TUI is colored.

**Accepted tradeoff:** because identity rides on color alone, marbles are *not*
distinguishable on a no-color terminal, in a screenshot, or under red/green
color-vision deficiency (and the red and green seats sit adjacent on the ring).
This is a deliberate v1 choice for the cleanest look.

Illustrative frame (glyphs finalized in implementation):

```
              ○ ○ ● ●   yellow
        · · ● · · · Y · · · · · ·
        ·           ◇           ·
        ·           ◇           ·
        ●           ◇           ·
        ·           ◇           ·
 green  ·                       ·  blue
 ○●●○  G ◇ ◇ ◇ ◇ ✦ ◇ ◇ ◇ ◇ B  ●●●○
        ·                       ·
        ·           ◇           ·
        ·           ◆           ·
        ·           ◇           ·
        ·           ◇           ·
        · · · ◈ · · R · · ● · · ·
              ● ● ○ ○   red — YOU
```

`●` marble · `◇`/`◆` empty/filled finish slot · `○` empty nest slot · `◈`
highlighted legal target · `✦` centre.

## 8. Bot pacing

Bots **auto-play with a short delay** (default ~700 ms, a single named constant so
it is trivial to tune) between moves, driven by the `useGameLoop` timer (§5).
`Status` shows a one-line recap of the move just played, produced by
`format.ts` (e.g. `green plays 7 — @12→19, captured your ●`). In a 1-human /
3-bot match this lets the human follow the up-to-three bot turns that pass between
their own turns instead of the board jumping.

## 9. End of game

When `applyMove` sets `winner`, `useGameLoop` flips `phase = 'gameover'` and
`GameOver` overlays the result (winner color, e.g. `🏆 green wins`). Keys: `r`
restarts (returns to `Setup` for a fresh configuration), `q` (and `Ctrl-C`) quits.

## 10. Theme, glyphs & colors

`theme.ts` (pure constants, no Ink import beyond the color-name string type):
- `Color → Ink color name`: red / green / yellow / blue map to the matching Ink
  named colors. This **is** the rendered color of a player's marbles and finish
  lane, and — per §7 — their only distinguishing cue. Blue uses the brighter
  `blueBright` for legibility on dark backgrounds. The human's own selection
  highlights use a distinct emphasis (bold / inverse) so "my legal choices" stand
  out from the marble colors.
- **Glyph table**: marble, empty ring cell, empty/filled finish slot, empty/filled
  nest slot, protected-start marker, highlighted target, centre. Centralized so the
  render is consistent and restyling is one edit.

## 11. Testing strategy

Terminal spec §11 keeps UI testing "mostly manual" — but the logic is pulled into
pure modules that **are** cheaply testable, and we test those:

- **`layout.ts`** (Vitest, pure): ring index → coords round-trips, the four start
  cells land at their side midpoints, finish lanes thread inward, nests sit
  outside, seat→side places red at the bottom. This is the highest-value UI test —
  the board is only correct if this map is.
- **`format.ts`** (pure): a capturing move, a lane entry, an exit, a split, and a
  discard each render to the intended human string.
- **`theme.ts`** (pure): every `Color` maps to a color; the glyph table is complete.
- **`Board` render assertions** (`ink-testing-library`, nice-to-have): mount
  `Board` with a hand-built `GameState` and assert `lastFrame()` contains the
  expected glyphs at the expected positions for a couple of known layouts.

The interactive `useTurnInput` state machine and `useGameLoop` timing are exercised
**manually** in v1 (`pnpm dev`), consistent with the spec. The engine/AI suites are
untouched and must keep passing; no Node dependency may leak into their level.

## 12. Terminal constraints

- "Full-screen" in v1 means a clean **top-to-bottom column layout** (title · board ·
  hand · status), sized to a comfortable ~80×24, **not** an alternate-screen
  buffer. This is the most robust choice across terminals and is simple to render.
- Ink's `useInput` needs a **TTY with raw mode**; the game is meant to be run in a
  real terminal via `pnpm dev`. Tests use `ink-testing-library`, which supplies a
  stubbed stdin/stdout, so they do not require a TTY.

## 13. Deferred / future work

- Alternate-screen buffer, resize reflow, mouse support.
- Bots-only spectator mode; an "Easy" difficulty exposed in the menu.
- A move-history panel / undo (the immutable state makes undo natural later).
- Web UI on the same engine (already isomorphic and serializable).
- Richer animation of marble movement and captures.

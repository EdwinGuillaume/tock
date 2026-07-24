# Tock — lane-entry "juice" (finish-lane arrival effect)

Date: 2026-07-24
Scope: `apps/web` only. `@tock/core` and `apps/terminal` are untouched.

## Motivation

Entering the finish lane (`couloir de fin`) is one of the most satisfying beats
of a Tock turn — a marble that has gone all the way round finally turns for
home. Today it is silent: the marble just glides to its finish cell like any
other move. We want to mark the moment with a small, tasteful board effect —
more "juice" in the spirit of the existing "Feutrine & or" redesign
(colourful yet elegant, adult, *dosed*).

## The effect (validated on animated mockups)

When a marble enters its finish lane — i.e. crosses the lane mouth and its
`position.zone` becomes `finish` — three things play on the SVG board, launched
**at the same instant the marble begins its glide into the lane**:

1. **Golden thread flare** — the seat's gold finish thread brightens briefly
   (fade in, then back down to nothing over the base thread, which never goes
   dark) — "the path home lights up".
2. **White comet** — a soft white light with a gentle glow travels down the
   lane, from the mouth toward the nest, following the track. It launches
   simultaneously with the marble's departure into the lane (not in two steps).
3. **Echo** — two concentric gold rings pulse outward on the cell where the
   marble comes to rest, timed to land just as the marble seats (~the glide
   duration later).

Total lifetime ≈ 1.6 s. There is **no marble "pop"** (an earlier scale-bounce
idea was dropped as too much). The marble keeps its normal glide.

The direction was chosen from a live animated comparison of three options
(spark burst / flash+ring / lane light-up); the mockups live under
`.superpowers/brainstorm/` (git-ignored, not committed).

## Trigger scope

The effect plays for **every marble that enters its lane, for every seat** —
human and bot alike. It is board feedback, so it should read the same whoever
moved. This falls out naturally from the detection strategy below (it keys off a
state transition, not off whose turn it is).

## Architecture — detection by state diff, in the presentation layer

Lane entry is detected by **diffing `GameState` across a move**, mirroring how
`format.ts` already detects captures (a marble whose zone changed). A marble has
entered its lane when its `position.zone` went from **not `finish`** to
`finish` between the previous state and the current one.

This is deliberately **move-type agnostic**: it fires for a plain `move` with
`enterLane`, for a `split7` part entering (including two marbles entering at
once), or any future path into the lane, without inspecting the `Move`. It also
covers **bot** entries for free, because bot moves flow through the same
`setState` as human moves, so the board simply observes each new state.

`@tock/core` and `useTockGame` are **untouched** — the whole feature is an
additive presentation-layer concern living in `apps/web`, watched from the
board component rather than threaded through the game hook.

Rendering uses **CSS keyframes** (as `tock-echo` / `tock-confetti` /
`tock-deal` already do), not Framer Motion — it is the established "juice"
pattern, is deterministic, and is neutralised for free by the existing global
`@media (prefers-reduced-motion: reduce) { * { animation: none } }` rule.

## Components & data flow

### `apps/web/src/laneFx.ts` — pure, the crux

```ts
export type LaneEntry = { marbleId: MarbleId, owner: PlayerId, finishIndex: number }

// Marbles whose zone went from non-'finish' to 'finish' between two states.
export const laneEntries = (before: GameState, after: GameState): LaneEntry[]
```

Pure and fully unit-testable, in the same spirit as `passAndPlay.ts`. It walks
`before.marbleList`, finds the same id in `after`, and emits an entry when
`before` was not in `finish` and `after` is, carrying `after`'s finish index.

### `apps/web/src/hooks/useLaneEntryFx.ts` — transient event list

```ts
export const useLaneEntryFx = (state: GameState): ActiveLaneEntry[]
```

- Keeps a `useRef` to the **previous** `GameState` and a `useRef` numeric
  **counter** for unique keys (**no `Math.random`, no `Date.now`** — both are
  banned elsewhere in this codebase for determinism).
- In a `useEffect` keyed on `state`: if `prefersReducedMotion()` it does
  nothing; otherwise it computes `laneEntries(prev, state)`, appends each as an
  `ActiveLaneEntry` (`{ key: `${marbleId}-${n}`, owner, finishIndex }`) to local
  React state, and schedules its removal with `setTimeout(…, laneEntryFxMs)`.
  It then stores `state` as the new `prev`.
- First render (`prev == null`) and restart (state reset) produce no entries.
- Clears any pending timeouts on unmount.

### `apps/web/src/components/LaneEntryFx.tsx` — one arrival, rendered

Props: `{ owner: PlayerId, finishIndex: number, ringSize: number }`. Renders an
SVG fragment (no wrapper `<svg>` — it is embedded in the board's `<svg>`):

- **Thread flare** — a brighter `<line>` laid over the seat's gold thread from
  `finishThread(owner, ringSize).mouth` to `.stop`, class `tock-lane-glow`,
  softened by a shared blur filter.
- **Comet** — a `<g class="tock-lane-comet">` positioned at the mouth,
  containing a bright core `<circle>` plus a soft (blurred) halo. It animates
  `transform: translate(0,0) → translate(var(--dx), var(--dy))`, where
  `--dx/--dy` is the mouth→stop vector (set inline per instance) so it travels
  the lane in any of the four seat directions with no per-seat CSS. (A
  directional gradient "tail" oriented along the lane is possible later as
  polish; the baseline soft halo reads as a comet and stays orientation-free.)
- **Echo** — two `<circle class="tock-lane-echo">` (one with a `b` modifier for
  a slightly delayed second ring) centred on
  `cellCenter(finishCoord(owner, finishIndex, ringSize))`, scaling out and
  fading (`transform-box: fill-box; transform-origin: center`).

Test hooks: wrapper `data-testid={`lane-fx-${owner}-${finishIndex}`}` and
per-part testids (`lane-fx-glow`, `lane-fx-comet`, `lane-fx-echo`).

### `apps/web/src/components/Board.tsx` — wiring

- Call `const entryList = useLaneEntryFx(state)`.
- Add the shared `<filter id="lane-soft">` (a `feGaussianBlur`) to the existing
  `<defs>`.
- Render `entryList.map(e => <LaneEntryFx key={e.key} owner={e.owner}
  finishIndex={e.finishIndex} ringSize={state.ringSize} />)` **after
  `boardBackdrop(...)` and before the marbles** — so the effect sits above the
  felt and thread but below the marbles (each marble stays on top of its
  socket; the echo ring expands outward beyond the marble and reads as a halo
  around it).

Because the effect layer is purely additive and keyed off state, no other board
code changes; `Marble.tsx` is not touched (no pop).

## Geometry & timing

- **Positions** reuse `svgGeometry.ts` verbatim: `finishThread(owner, ringSize)`
  gives the `{ mouth, stop }` for the flare line and the comet's travel vector;
  `cellCenter(finishCoord(owner, finishIndex, ringSize))` gives the echo centre.
  No new geometry helper is required.
- **Motion tokens** in `apps/web/src/motion.ts`: add the effect's total lifetime
  (e.g. `export const laneEntryFxMs = 1600`) used by the hook's `setTimeout`;
  sub-durations/easings for the three parts live in the CSS keyframes.
- **Keyframes** in `apps/web/src/index.css` (and their classes, so the global
  reduced-motion rule disables them automatically):
  - `tock-lane-glow`: opacity `0 → ~.9 → 0` (brief flare, base thread persists).
  - `tock-lane-comet`: `translate` from origin to `var(--dx),var(--dy)` with an
    opacity fade-in then fade-out.
  - `tock-lane-echo`: `scale(.45) → scale(~1.9)`, opacity `.85 → 0`; the `b`
    ring uses an `animation-delay`.
- **Synchronisation** (matches the validated mockup): comet + thread flare start
  on mount (delay 0), i.e. at the same instant as the marble's glide into the
  lane (the marble's own `transform` transition is ~0.25 s). The echo is delayed
  by ~the glide duration so it pulses exactly as the marble seats.

## Reduced motion

Double-guarded: `useLaneEntryFx` produces **no** active entries when
`prefersReducedMotion()` is true (nothing mounts), **and** the global
`* { animation: none }` rule would neutralise the keyframes regardless. Result:
no animation and no elements left stuck mid-transition.

## Testing (`apps/web/tests/`)

- **`laneFx.test.ts`** (the crux, pure): single entry (track → finish index N)
  yields one `LaneEntry` with the right owner/index; a `split7` sending two
  marbles into lanes yields two; a move **within** the finish (index 1 → 3)
  yields none; a marble staying on the ring yields none; a captured marble
  (sent to `home`) yields none; a **bot**-owned marble entering is included.
  Fixtures build `GameState` via the per-package `tests/support.ts` rig.
- **`LaneEntryFx.test.tsx`**: renders the glow / comet / echo elements
  (by testid) for a given owner + finish index, embedded in a host `<svg>`.
- **Reduced-motion guard**: with `matchMedia` mocked to `reduce`, driving a
  lane-entry state transition through the board yields **no** `lane-fx-*` nodes.

## Out of scope

- Reaching the final nest cell / locking a marble home, and the win itself
  (the game-over screen already has its confetti).
- Sound.
- The terminal app (`apps/terminal`) — no change.
- No change to `@tock/core`: move generation, scoring, and the bot are untouched.

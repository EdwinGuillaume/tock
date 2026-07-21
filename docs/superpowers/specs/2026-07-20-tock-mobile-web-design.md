# Tock on mobile — a shareable web app — Design document

- **Date**: 2026-07-20
- **Status**: approved (brainstorming), ready for the implementation plan
- **Author**: eguillaume

## 1. Context & goal

The engine, the "Normal" bot, and the Ink terminal UI are built, tested, and
merged (`src/engine/` + `src/ai/` + `src/ui/`, ~190 passing tests). The
authoritative rules live in `docs/superpowers/specs/2026-07-15-tock-terminal-design.md`
(the game) and `docs/superpowers/specs/2026-07-16-tock-ai-design.md` (the bot);
every feature since (UI, continuous draw, cross-board, push-5, smart discard)
has its own paired spec + plan.

The goal of this document is to take the game **out of the terminal and onto
mobile**, as a **portfolio piece**: a single URL that opens straight in a phone
browser, is beautiful and touch-friendly, and can be shared with no install. The
trajectory is **web first, native later** — the same web build wraps into a
native app (Capacitor) the day we want a store presence, with no logic rewrite.

The decisive asset is the existing architecture. `src/engine/` and `src/ai/` are
**pure, isomorphic TypeScript with zero Node dependencies**, and `GameState` is
**100% JSON-serializable** (terminal spec §3). That code — the rules, the bot,
and its ~190 tests — is **reused verbatim** in the browser. Only the terminal
renderer (Ink) is replaced. The engine/UI separation the project was built around
(engine knows nothing about the terminal; UI knows nothing about the rules; they
talk only through `getLegalMoves` → chosen `Move` → `applyMove`) is exactly what
makes this port cheap, and it is preserved unchanged.

## 2. Scope & milestones

Delivered as milestones; **this spec's implementation plan covers M1 + M2**.
M3 and M4 are roadmap items that will get their own specs.

- **M1 — Web, solo vs bots.** A Vite + React web app reusing `@tock/core`, an SVG
  wood-themed cross board, the ghost-destination touch interaction (including the
  progressive 7-split), deployed as a static site → **the shareable link**. The
  portfolio centerpiece.
- **M2 — Local pass-and-play.** Two-to-four human seats on one device, with a
  "pass the phone" interstitial that hides the previous player's secret hand
  between two human turns. The engine already supports multiple `human` seats;
  this is a UI concern only.
- **M3 — PWA (roadmap).** Installable, offline-capable, app icon, splash screen.
- **M4 — Native wrap (roadmap).** Capacitor wraps the same build for the iOS/
  Android home screen and, if wanted, the stores.

## 3. Technical foundation — reuse the engine (approach B)

Three approaches were weighed; the choice is recorded here so it is not
relitigated.

- **A — game engine (Godot / Unity), rewrite.** Rejected. It throws away the
  tested TS engine and ~190 tests (the rules would be rewritten in GDScript/C#),
  is oversized for a turn-based, card-driven 2D board game that is ~90% UI, and
  its heavyweight WASM web export is poor for a portfolio link.
- **B — React web reusing the TS engine (chosen).** A fresh React (DOM/SVG) UI
  imports `@tock/core` unchanged, deploys as a static site (shareable link, PWA),
  and wraps into a native app via Capacitor later. Same language top to bottom,
  reuses 100% of the engine + bot + tests, matches the "web first, native later"
  trajectory, and gives the highest portfolio ROI.
- **C — React Native / Flutter, native first.** Rejected for now. Native
  performance buys nothing for a turn-based board game, "web first" becomes
  artificial (RN Web is extra work; Flutter would force a Dart rewrite), and it
  front-loads native setup. Capacitor (M4) reaches the same native destination
  from the web build without any of this.

**Build tooling: Vite.** Standard for React + TS, fast, static output, has a
first-party PWA plugin (`vite-plugin-pwa`) for M3, and produces exactly the build
Capacitor wraps for M4. **Vitest stays** the test runner (already in the repo),
so the engine tests move without changing frameworks.

## 4. Repository restructure — pnpm workspace

To make "one engine, many front-ends" tangible (and to let the terminal and web
apps coexist cleanly), the repo becomes a **pnpm workspace**.

### 4.1 Target layout

```
pnpm-workspace.yaml
package.json                 root: workspace scripts only
tsconfig.base.json           shared compiler options (strict, etc.)

packages/core/               @tock/core — the isomorphic core (zero Node deps)
├── src/engine/              moved verbatim from src/engine/
├── src/ai/                  moved verbatim from src/ai/
├── src/index.ts             re-exports the engine + AI public surfaces
├── tests/                   moved from tests/engine, tests/ai (+ support.ts)
├── package.json
└── vitest.config.ts

apps/terminal/               the existing Ink TUI
├── src/ui/                  moved from src/ui/
├── src/index.tsx            moved from src/index.tsx
├── tests/ui/                moved from tests/ui/  (keeps FORCE_COLOR=1)
├── package.json             depends on @tock/core
└── vitest.config.ts

apps/web/                    NEW — the mobile web app (M1 + M2)
├── index.html
├── src/
├── tests/
├── package.json             depends on @tock/core
└── vite.config.ts           Vite + Vitest config
```

### 4.2 What moves, what changes

- **`packages/core`** is the current `src/engine/` + `src/ai/` moved verbatim.
  Its `src/index.ts` re-exports both existing barrels (`engine/index.ts` and
  `ai/index.ts`), so consumers do `import { createGame, pickMove } from '@tock/core'`.
  The **zero-Node-dependency rule still holds** — the CI/typecheck guard against
  `fs`/`process`/`node:` imports stays on this package.
- **The only mechanical edit** across the moved code is the import specifier in
  the terminal UI and the AI: relative `../engine` / `./engine` imports become
  `@tock/core`. No logic changes.
- **`apps/terminal`** keeps working (`pnpm --filter @tock/terminal dev` launches
  it); its tests keep `FORCE_COLOR=1`.
- **Root scripts** drive the workspace: `pnpm test` (all packages), `pnpm typecheck`
  (all), `pnpm --filter @tock/web dev` (the web app), `pnpm --filter @tock/terminal dev`
  (the TUI). Vitest runs per-package (workspace projects), so a failure names its
  package.

### 4.3 Isolation, preserved

The engine/UI boundary is now a **package boundary**: `apps/web` and
`apps/terminal` may only import from `@tock/core`, never from each other. The web
app adds **zero rules** — it consumes `getLegalMoves` / `applyMove` exactly as the
terminal does.

## 5. Rendering — SVG, wood theme

### 5.1 Why SVG

The board is a **cross** whose geometry is coordinate-based. SVG lets each cell
and marble sit at a computed `(x, y)` on a fixed `viewBox` and scale crisply to
any screen (retina, tablet, desktop) with no raster blur. It also animates
cleanly (a marble slide is a transition on `cx`/`cy`) and stays accessible
(each marble/cell is a real DOM node, tappable and labelable).

- **`apps/web` owns its SVG geometry** (`boardGeometry.ts`): a pure module mapping
  every `Position` (`home` nest slot, `track` index, `finish` index) to an
  `(x, y)` in the `viewBox`. This is the web analogue of the terminal's
  `src/ui/layout.ts` (which produces character-grid coordinates) — same idea,
  different coordinate space. It reads the board **topology** from `@tock/core`
  (`quadrantSize`, `startCell`, `laneMouth`, `finishSize`, `ringSize`) and never
  reaches into rules. The engine's `board.ts` stays pure topology, unaware of
  pixels.

### 5.2 Wood theme (chosen direction)

The look is **wood & marbles**, honoring the physical Tock board:

- **Board**: a warm wood-grain fill (SVG gradient/filter or a lightweight texture);
  track cells rendered as **drilled holes** (inner shadow); the center as a felt/
  wood hub.
- **Marbles**: circles with a **radial gradient** (highlight top-left → shadow
  bottom-right) for a 3D glossy sphere in each seat color (red/green/yellow/blue).
- **Cards**: cream card faces, red/black rank+suit, soft drop shadow.
- **Theme tokens** live in one place (`theme.ts` in `apps/web`), so colors/shadows
  are not scattered — the analogue of the terminal's `src/ui/theme.ts`.

### 5.3 Animation

Marble movement uses **CSS transitions** first (zero dependency): position changes
animate the marble sliding to its destination. A motion library
(`motion` / framer-motion) is deferred until a later polish pass — not needed for
M1/M2. Captures and lane entries reuse the same slide.

## 6. UX & interaction

### 6.1 Layout (portrait)

Top-to-bottom dock, with the board as the visual star and the hand in thumb reach:

1. **Status bar** — whose turn it is, draw/discard pile counts.
2. **Game log — 4 lines.** The most recent line sits at the bottom, fully legible;
   the three above **fade upward** via a `mask-image` gradient so history is
   present without cluttering the play area.
3. **Board** — the SVG wood cross, centered, filling the width.
4. **Hand — a fan.** The human's five cards fanned like a real hand (overlapping,
   slightly rotated), tappable; unplayable cards dimmed.

Roadmap note (not M1/M2): on larger screens and once richer animations land, the
log migrates to a **side panel** and the board takes the full height.

### 6.2 Game log behaviour

- **Touch-scrollable** — the player can drag to scroll the full match history
  within the 4-line window.
- **Auto-follow** — when a new line is appended, the log **snaps back to the
  bottom** so the latest move is always shown. (A later refinement may pause
  auto-follow while the user is scrolled up reading; the default is snap-to-bottom
  on every new line, as decided.)

### 6.3 Playing a move — ghost destinations (the core model)

Every turn, the UI reads `getLegalMoves(state, currentPlayer)` and drives a
**card-first, tap-the-landing-spot** flow:

1. The player **taps a card** in the fan.
2. The board shows a **ghost marble at every legal landing position** for that
   card — each ghost is one legal `Move` from the list, projected onto the board.
3. The player **taps a ghost** → the marble **slides** there; the UI calls
   `applyMove` with that move and re-renders.

The engine's rule that **each distinct outcome is a distinct `Move`** (terminal
spec §6.2) maps directly onto this: "advance 7 and enter the lane" vs "advance 7
and stay on the ring" are **two ghosts at two positions** — the player picks by
tapping, with **no dialog**. This is the whole reason the model is clean: the UI
never re-derives rules; it renders the move list spatially.

### 6.4 The 7 — progressive allocation

The `split7` move distributes 7 steps across the player's marbles (Σ = 7). On
touch this is the ghost model extended into a **spend-the-budget** interaction:

1. Tapping the 7 starts a **budget of 7 steps**.
2. The player taps one of their marbles; ghosts appear at its reachable landings
   (`+1 … +remaining`), each labeled with the step count.
3. Tapping a ghost **commits that allocation** — the marble slides there, the
   budget decreases.
4. The player continues with the **same or another** marble until the budget
   reaches 0. One marble may consume the whole 7, or it splits (e.g. 3 + 4,
   1 + 1 + 5, …).
5. An **Undo** resets the in-progress allocation; **Play** commits only at
   **0 remaining**.

Only the completed allocation is sent to the engine — a **single `split7` move**
whose `partList` matches one of the enumerated legal splits. The in-progress
allocation is **UI-local scratch state**; `applyMove` is called once, at the end,
so immutability and the move contract are untouched. The UI validates each
partial tap against the enumerated `split7` moves so the player can only build a
legal partition.

### 6.5 Other specials

Both fit the same ghost model, no extra dialogs:

- **5 — push an opponent.** Tapping the 5 shows **ghosts on the pushable opponent
  marbles' landing cells** (the 5 moves an opponent forward 5, ring-only — the
  project's push-5 rule). Tapping one commits the `push` move.
- **Jack — swap.** Tapping the Jack highlights the player's marbles and the valid
  swap targets; the player **taps two marbles** (own marble, then target) to
  commit the `swap` move.
- **Discard.** When `getLegalMoves` offers only discards (a forced-discard turn),
  the hand shows the discardable cards; tapping one commits the `discard`. (The
  bot's smart-discard logic is engine/AI-side and unaffected.)

### 6.6 Pass-and-play (M2)

Between two **human** turns, a full-screen interstitial — "Pass to {color} — tap
to reveal your hand" — hides the previous player's secret hand until the next
human confirms. **Bot turns chain without an interstitial** (a bot has no secret
to protect and no device to hand over). Solo vs bots (M1) therefore never shows
the interstitial; it appears only when the next seat is another human.

## 7. Game flow — reuse the engine

The web app has a **turn controller** — the web analogue of the terminal's
`useGameLoop` — that owns the identical flow (terminal spec, "Turn flow"):

1. Read `state`; compute `getLegalMoves(state, currentPlayer)`.
2. **Human seat** → render the hand + ghosts; capture the tap; build the chosen
   `Move`.
3. **Bot seat** → `pickMove(state, legalMoves, random)` picks from the same list
   (seeded RNG optional; defaults to `Math.random`).
4. `applyMove(state, move)` → new immutable state (continuous draw refills the
   hand automatically). Re-render.
5. Advance via `nextPlayer`; if the next seat is another human, show the M2
   interstitial first.

State lives in React (a single `GameState` in a store/reducer); because the state
is plain JSON, it serializes trivially (useful later for save/resume, and it is
the same property that would enable online play — explicitly out of scope here).
The **setup screen** (opponent count, board size 48/72) mirrors the terminal's
`Setup`, calling `createGame(kindList, ringSize)`.

## 8. Build & deploy

- **Dev**: `pnpm --filter @tock/web dev` runs Vite's dev server; the web app needs
  no TTY (unlike the Ink app).
- **Build**: `pnpm --filter @tock/web build` emits a static bundle.
- **Deploy**: any static host (Vercel / Netlify / GitHub Pages) → the shareable
  URL. No backend, no server — solo and pass-and-play both run fully client-side.
- **PWA (M3)** and **Capacitor wrap (M4)** attach to this same build later.

## 9. Testing strategy

- **Core tests reused verbatim.** The ~190 engine/AI tests move to
  `packages/core/tests/` and keep passing unchanged — the strongest guarantee the
  port introduces no rules drift.
- **Web UI tests** (`apps/web/tests/`) use **Vitest + React Testing Library** with
  jsdom: rendering from a given `GameState`, the ghost-destination selection
  (tapping a card shows the right ghosts; tapping a ghost calls `applyMove` with
  the expected move), the progressive 7-split (budget decrements, Play enabled only
  at 0, emits one `split7`), swap/push selection, the forced-discard hand, the log
  auto-follow/scroll, and the pass-and-play interstitial gating (shown before a
  human seat, skipped before a bot seat).
- **Pure UI helpers** (`boardGeometry.ts`, `theme.ts`, selection logic) are unit-
  tested directly, as the terminal's `layout.ts` / `selection.ts` are.
- **Determinism**: bot-driven flows inject a seeded RNG, mirroring the AI tests.

## 10. Documentation to update

- **`CLAUDE.md`**: document the pnpm-workspace layout (`packages/core`,
  `apps/terminal`, `apps/web`), the new commands (`pnpm --filter …`), and that the
  engine/UI separation is now a package boundary. Update the module-layout and
  commands sections; the "isomorphic, zero Node deps" rule now names
  `@tock/core`.
- **`README.md`**: add the web app — the shareable-link story, how to run/build it,
  and the milestone roadmap (M1–M4).
- This spec is paired with `docs/superpowers/plans/2026-07-20-tock-mobile-web.md`
  (M1 + M2), written next.

## 11. Decisions made (not open questions)

- **Approach**: B — React web reusing `@tock/core`. Not Godot, not React Native.
- **Repo**: pnpm workspace (`packages/core`, `apps/terminal`, `apps/web`).
- **Build**: Vite; test runner stays Vitest.
- **Rendering**: SVG, wood-&-marbles theme, CSS-transition slides.
- **Layout**: status bar → 4-line faded game log → SVG board → fanned hand.
- **Log**: touch-scrollable, snap-to-bottom on each new line.
- **Interaction**: card-first ghost destinations; progressive spend-the-budget for
  the 7; swap = tap two marbles; push = ghost on opponent marbles.
- **Pass-and-play (M2)**: "pass the phone" interstitial before a human seat only.
- **Plan scope**: M1 + M2.

## 12. Out of scope

- **Online multiplayer / any backend.** The JSON-serializable state would enable
  it, but it is a separate project; excluded here.
- **Godot / Unity / native rewrite.** Excluded (see §3).
- **PWA (M3) and Capacitor native wrap (M4)** — roadmap, their own specs later.
- **Richer animations / side-panel log layout** — a later polish pass; M1/M2 use
  CSS-transition slides and the 4-line faded log.
- **New game rules or a new bot difficulty.** The rules and the "Normal" bot are
  reused exactly; this work is renderer + UX only.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

**The engine, the "Normal" bot, the Ink terminal UI, and a Vite/React mobile
web UI are all built, tested, and merged.** The repo is a **pnpm workspace**:
`packages/core` (`@tock/core` — engine + ai + shared 2D grid geometry),
`apps/terminal` (`@tock/terminal` — the Ink TUI), `apps/web` (`@tock/web` — the
mobile web app). **263 passing tests** across the workspace (core 132,
terminal 65, web 66), `pnpm -r typecheck` clean. Both apps are **playable
end-to-end** — `pnpm dev:terminal` launches the terminal game, `pnpm dev`
launches the web app. Toolchain in place: TypeScript + Vitest + pnpm + tsx +
Vite + React + Ink.

Features shipped on top of the base rules: continuous draw (constant 5-card
hand), the 5 pushes an opponent, selectable board size (48 or 72), the board
rendered as a cross, and smart forced-discard in the bot. On top of that, the
web app ships M1 (solo vs. bots) and M2 (local pass-and-play): an SVG
wood-themed cross board, card-first ghost-destination touch interaction, a
progressive 7-split control, per-seat human/bot/inactive setup, and a "pass
the phone" interstitial between different humans' turns, deployable as a static
shareable link.

**The authoritative specs are `docs/superpowers/specs/2026-07-15-tock-terminal-design.md`**
(the game, English), **`docs/superpowers/specs/2026-07-16-tock-ai-design.md`**
(the bot), and **`docs/superpowers/specs/2026-07-20-tock-mobile-web-design.md`**
(the workspace restructure + the web UI); the engine was built from
`docs/superpowers/plans/2026-07-15-tock-engine.md`, the bot from
`docs/superpowers/plans/2026-07-16-tock-ai.md`, and the workspace/web app from
`docs/superpowers/plans/2026-07-20-tock-mobile-web.md`. Read the spec before
extending behaviour — it defines the data model, the move contract, and the
rules of the game in detail, and the sections below only summarize the parts
that shape architecture. Every feature added since (UI, continuous draw,
cross-board, push-5, smart discard, the pnpm workspace, the web UI) has its
own paired spec + plan under `docs/superpowers/specs/` and
`docs/superpowers/plans/`.

Code identifiers and comments are **English** (see Code Style below). Tock's domain
terms are French in origin; this glossary maps them so we share the vocabulary, but
the **English** term is what goes in code: `nid` = home, `anneau` = track/ring,
`couloir` = finish lane, `bouche` = lane mouth, `bille` = marble, `prise` =
capture, `case de départ` = start square.

## What is being built

**Tock** — a Ludo-style, card-driven board game. v1 (terminal): one human vs.
1–3 bots, 4-seat board, every seat for itself (no teams), playable in a
full-screen, colored terminal TUI. Single bot level ("Normal", greedy
heuristic with 1-ply lookahead). On top of that, a mobile web port
(`apps/web`) is underway as a shareable-link portfolio piece, reusing the same
engine and bot unchanged: M1 (solo vs. bots) and M2 (local pass-and-play) are
done; an installable PWA (M3) and a Capacitor native wrap (M4) are roadmap
items — see `docs/superpowers/specs/2026-07-20-tock-mobile-web-design.md` §2.

## Commands

Root scripts fan out across the workspace with `pnpm -r` / `pnpm --filter`;
there is no longer a single flat `src/`, so always run from the repo root
(or `cd` into the specific package) and target the package explicitly.

- `pnpm --filter @tock/web dev` (alias: `pnpm dev`) — launch the web app (Vite dev server, HMR)
- `pnpm --filter @tock/terminal dev` (alias: `pnpm dev:terminal`) — launch the terminal game (`tsx src/index.tsx`); needs a real TTY
- `pnpm --filter @tock/terminal dev:watch` — terminal game with reload on change (`tsx watch src/index.tsx`)
- `pnpm --filter @tock/web build` (alias: `pnpm build`) — production build of the web app → `apps/web/dist/`
- `pnpm --filter @tock/web preview` — serve the built `apps/web/dist/` locally to sanity-check the production bundle
- `pnpm -r test` (alias: `pnpm test`) — run every package's Vitest suite once
- `pnpm --filter <pkg> test <path>` — run a single file in one package, e.g.
  `pnpm --filter @tock/core test tests/engine/split7.test.ts`
- `pnpm --filter <pkg> exec vitest` — Vitest in watch mode for one package (no `test:watch` script is
  defined; `vitest` with no args watches by default, unlike the `test` script's `vitest run`)
- `pnpm -r typecheck` (alias: `pnpm typecheck`) — `tsc --noEmit` in every package

`pkg` is one of `@tock/core`, `@tock/terminal`, `@tock/web`.

## Toolchain (spec §10)

Set up:
- **TypeScript** (^5.5, strict), package manager **pnpm** as a **workspace**
  (`pnpm-workspace.yaml` lists `packages/*` + `apps/*`, `pnpm-lock.yaml`
  committed at the root, shared compiler options in root `tsconfig.base.json`)
- **Vitest** (^2.0, Jest-style API) — one config per package
  (`packages/core/vitest.config.ts`, `apps/terminal/vitest.config.ts`,
  `apps/web/vite.config.ts`); tests live in each package's own `tests/`
  directory (`packages/core/tests/{engine,ai}/`, `apps/terminal/tests/ui/`,
  `apps/web/tests/`)
- **tsx** — runs the terminal UI in dev without a build (`pnpm --filter
  @tock/terminal dev` / `dev:watch`)
- **Vite** (^5.4) + **@vitejs/plugin-react** — bundles and serves the web app
  (`apps/web/vite.config.ts` doubles as the Vitest config, `base: './'` so the
  build is path-agnostic for any static host)
- **React 19** — both UIs; **Ink 7** for the terminal (`ink-testing-library`
  for its UI tests), **jsdom + @testing-library/react** for the web UI tests

Not set up yet:
- **ESLint + Prettier** — optional; until a linter is wired up, the Code Style
  rules below (including max warnings 0) are enforced by convention and review,
  not tooling.

## Architecture — the non-negotiable constraints

The whole design hinges on **strict engine/UI separation**, now enforced as a
**package boundary**: `@tock/core` knows nothing about the terminal or the
browser, and every app under `apps/*` knows nothing about the rules — it only
imports `@tock/core`. They communicate only through pure data (state, list of
legal moves, chosen move). This is exactly what made the web port cheap: the
same engine now backs two front-ends unchanged.

- **`@tock/core`** (`packages/core/src`, covering `src/engine/` and `src/ai/`)
  is **isomorphic**: pure TypeScript, **zero Node dependencies** (no `fs`,
  `process`, etc.). Must run in a browser and on a server unchanged — and now
  does, in both `apps/terminal` (Node, via `tsx`) and `apps/web` (browser, via
  Vite).
- **`GameState` is 100% JSON-serializable**: plain data only — no classes with
  methods, no functions stored in state. Required for future network/web play.
- **Immutability**: `applyMove(state, move)` returns a *new* state; it never
  mutates its input.
- The engine exposes a **single public API** via `packages/core/src/index.ts`
  (the package's `exports` field points there). Every UI (`@tock/terminal`,
  `@tock/web`) imports exactly the same functions from `@tock/core` — never
  from a relative path into another app.

### Turn flow (both human and bot take the identical path)

1. `getLegalMoves(state, playerId): Move[]` — enumerates *all* legal moves.
2. Human turn → UI highlights those moves, captures the choice (keyboard in the
   terminal, tap in the web app).
3. Bot turn → `ai/bot.ts` picks a move *from that same list*.
4. `applyMove(state, move): GameState` — applies it (handles captures), returns a
   new immutable state.
5. UI re-renders from the new state.

Because both players choose only from `getLegalMoves`, illegal moves are
structurally impossible, and the engine is fully testable without any UI.

**Continuous draw**: there is no separate draw phase. Playing (or discarding) a
card sends it to the discard pile and `applyMove` immediately refills the hand
with one fresh card, so an active hand is always 5 cards (`handSize`) until the
piles run dry. The draw pile reshuffles the discard pile back in when empty
(`drawCard` in `state.ts`).

### Module layout

```
packages/core/src/engine/
├── types.ts    data model — Position, Card, Marble, the Move union, GameState (types only)
├── board.ts    ring geometry — startCell, laneMouth, ringDestinations, stepsToMouth
├── cards.ts    deck, shuffle, rank → steps mapping (moveSteps, canExit)
├── state.ts    createGame, drawCard, colorOf / marbleId helpers
└── moves.ts    the rules — getLegalMoves, applyMove, nextPlayer (+ 7-split enumeration)

packages/core/src/ai/
├── score.ts    scoreMove (before→after delta via applyMove) + WEIGHTS, advancement, exposureFor, cardKeepValue (smart-discard ranking) — all pure
└── bot.ts      pickMove (greedy 1-ply, best-score set, random tie-break; smart forced-discard) + pickRandomMove

packages/core/src/geometry/
└── board2d.ts  shared 2D grid geometry for BOTH UIs — Cell/Side types, sideOf, gridSize,
                ringCoord/finishCoord/cellOf (the ring walk itself is an internal,
                unexported buildRing, cached per ring size) — extracted from the
                terminal's layout math so the web app's SVG board reuses it verbatim

packages/core/src/index.ts   the single public API: `export * from './engine'` + `'./ai'` + `'./geometry/board2d'`
```

Note: there is **no `rules.ts`** — the rules live in `moves.ts`, superseding the
spec's §4 sketch. `types.ts` (absent from the §4 sketch) holds the
JSON-serializable data model.

`@tock/core`'s public surface (`packages/core/src/index.ts`, the package's only
`exports` entry) is the only thing UIs and AI import: `createGame(kindList,
ringSize?, random?)`, `getLegalMoves(state, playerId): Move[]`,
`applyMove(state, move, random?): GameState`, `nextPlayer`, the board helpers
(`quadrantSize(ringSize)`, `playerCount`, `finishSize`, `startCell(player, ringSize)`,
`laneMouth(player, ringSize)`, `DEFAULT_RING_SIZE`, `RING_SIZE_OPTIONS`), the
`board2d` grid helpers, plus `handSize` / `colorOf` / `marbleId` and all domain
types. **The ring size is a runtime choice, not a constant**: it lives on
`GameState.ringSize` (48 or 72, chosen at setup) and every geometry helper
takes it as an explicit trailing argument — there is no exported `ringSize`
constant. `getLegalMoves` / `applyMove` / `scoreMove` keep their signatures
because they read `state.ringSize` internally.

The bot's part of that surface is the only thing a UI imports to drive a seat:
`pickMove` / `pickRandomMove` (selection) and `scoreMove` / `WEIGHTS` /
`cardKeepValue` (the pure heuristic). Both `pick*` functions take an **optional
injected RNG** (`random: () => number`, defaulting to `Math.random`) so bot
play is deterministic under test — pass a seeded RNG rather than relying on
`Math.random`.

Both UIs import `@tock/core` unchanged and add nothing to the rules:

```
apps/terminal/src/ui/     React + Ink terminal UI
├── App.tsx         top-level: Setup → game loop → GameOver
├── Setup.tsx       opponent count + board-size choice
├── Board.tsx       renders the ring/lanes/homes as a cross (character grid)
├── Hand.tsx        the human's cards, unplayable ones dimmed
├── Status.tsx      whose turn, piles, per-seat progress
├── SplitPanel.tsx  interactive 7-split entry
├── GameLog.tsx     scrolling move history
├── GameOver.tsx    winner screen
├── format.ts · layout.ts · selection.ts · theme.ts   presentation helpers (pure;
│                   layout.ts re-exports @tock/core's board2d and adds
│                   Highlight/movePreviewCells/marbleCellsAfter)
└── hooks/          useGameLoop (drives bots + turn advance), useTurnInput (keyboard)
apps/terminal/src/index.tsx   renders <App /> into the terminal

apps/web/src/components/   Vite + React 19 web UI (SVG board, touch)
├── App.tsx           routing: Setup → GameScreen → GameOver, plus the pass-and-play handoff
│                     gate (PassInterstitial); owns useTockGame + useBotAutoplay + awaitingHandoff
├── GameScreen.tsx    the interaction state machine (pickCard | ghosts | swapTarget | split
│                     phases), wires Board/Hand/SplitControls together for one turn
├── Setup.tsx         per-seat human/bot/inactive cycling + board-size choice
├── GameOver.tsx       winner screen
├── PassInterstitial.tsx   "pass the phone" screen shown between two different humans' turns
├── Board.tsx · Marble.tsx · Ghost.tsx   the SVG cross board, marbles, tappable "ghost" destinations
├── Hand.tsx           the human's cards, unplayable ones dimmed
├── StatusBar.tsx       whose turn, piles, prompt
├── GameLog.tsx         scrolling move history
└── SplitControls.tsx   remaining/Play/Undo controls for the progressive 7-split
apps/web/src/   svgGeometry.ts (SVG coordinates over board2d) · moveSelection.ts (Ghost +
                legal-move → ghost mapping) · splitAllocation.ts (7-split draft state)
                · passAndPlay.ts (humanSeatIds/activeHumanSeat/needsHandoff — handoff logic)
                · theme.ts · format.ts   — all pure
apps/web/src/hooks/   useTockGame (owns GameState + commitMove, continuous draw is automatic
                      via applyMove) · useBotAutoplay (drives bot seats on a timer, isHumanSeat)
apps/web/src/main.tsx   renders <App /> into the DOM
apps/web/public/manifest.webmanifest   PWA metadata (name/theme color), no service worker yet — M3
```

Tests live in each package's own `tests/` directory — `packages/core/tests/{engine,ai}/`
plus `board2d.test.ts`, `apps/terminal/tests/ui/`, `apps/web/tests/` — one file
per feature, with shared rig helpers in each package's own `tests/support.ts`
(each imports from `@tock/core` rather than sharing one file across packages).

## Two modeling decisions that are easy to get wrong

- **Lane mouth (`bouche`)** — the finish-lane entrance is a **fixed position on
  the ring, just *behind* the start square** (`start - 1`). A marble enters its
  lane whenever its path *crosses that mouth moving **forward***. The engine does
  **not** track a "has completed a lap" flag; forward crossing of the fixed mouth
  is all it needs. A **backward 4 never enters the lane** — a marble cannot come
  home going backward, so it stays on the ring (there is no "4 trick"). See spec
  §5.2 — implemented in `board.ts` (`ringDestinations` gates lane entry on
  `direction === 1`; also `laneMouth`, `stepsToMouth`).
- **The `Move` union is the central contract** (spec §6.2, defined in `types.ts`):
  `exit`, `move` (with optional `enterLane`), `push` (the 5 — move an opponent
  forward 5, ring-only), `split7` (the 7 split across marbles, Σ=7), `swap`
  (Jack), `discard`. When several legal outcomes exist for one
  displacement (e.g. enter the lane *or* stay on the ring), the generator emits
  **one distinct `Move` per outcome** so the human/AI decides. `getLegalMoves`
  enumerates *all* combinations, including every valid 7-split partition
  (de-duplicated by a canonical order-independent key — see `enumerateSplits` in
  `moves.ts`).

## Testing priority (spec §11)

The engine (`@tock/core`) is the core testing effort: move generation (Ace/King
exit, backward 4 crossing the mouth, exhaustive 7-split, Jack swap, captures,
start-square protection, exact-count lane entry + entry choice) and `applyMove`
(immutability, captures, win condition). AI tests target `scoreMove` and its
parts (`advancement`, `exposureFor`) plus `pickMove` / `pickRandomMove` selection
via an injected seeded RNG for determinism, with a lockstep self-play integration
test (two seeded bots must stay in sync) — all in `packages/core/tests/`.

Each UI package tests itself with its own tooling, both importing rig helpers
from a per-package `tests/support.ts` (not shared across packages):
- **`apps/terminal/tests/ui/`** uses `ink-testing-library` (rendering, keyboard
  input, selection, layout, theme) — render assertions rely on `FORCE_COLOR=1`
  (set in `apps/terminal/vitest.config.ts`) so styled output keeps its ANSI
  codes off a TTY.
- **`apps/web/tests/`** uses `jsdom` + `@testing-library/react` (configured in
  `apps/web/vite.config.ts`, which doubles as the Vitest config) — rendering,
  tap/click interaction, ghost-destination selection, the split-allocation
  state machine, the pass-and-play handoff logic and interstitial
  (`passAndPlay.test.ts`, `handoff.test.tsx`, `passInterstitial.test.tsx`), and
  geometry math (`svgGeometry.test.ts`, `board2d.test.ts` in `@tock/core`).

## Code Style

- All code and code comments must be written in English, regardless of the language of the prompt
- No semicolons, no trailing commas
- ESLint uses max warnings: 0 — all warnings are treated as errors
- No `function` keyword; prefer const arrow functions for helpers and components
- **No non-null assertions (`!`) in production code — the only exception is unit tests.** Prefer a safe fallback on array/string/`Map` access (`list[i] ?? fallback`), a helper that finds-or-throws with a message, or type narrowing. A needed `!` usually signals a type that should be tighter — use an enum or `Record<Key, V>` instead of `string`, a tuple, or a discriminated union

### Naming Conventions

- **Components**: PascalCase (`PendingComponent.tsx`)
- **Hooks**: camelCase with `use` prefix (`useBasePath.ts`)
- **Types**: PascalCase with suffix (`PaginationSchema`)
- **Handlers**: `handle` prefix (`handleSubmitForm`)
- **Variables**: camelCase, clear (no one letter, name must reflect what it contains), NO PLURAL (`inputList`)

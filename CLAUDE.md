# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

**The engine and the "Normal" bot are built, tested, and merged** (`src/engine/`
+ `src/ai/`, 87 passing tests, `tsc --noEmit` clean). Toolchain in place:
TypeScript + Vitest + pnpm. **Not yet built: `src/ui/` (the Ink TUI) — that is the
next milestone**, along with the tooling it needs (`tsx`, React + Ink; see
Toolchain below).

**The authoritative specs are `docs/superpowers/specs/2026-07-15-tock-terminal-design.md`**
(the game, English) **and `docs/superpowers/specs/2026-07-16-tock-ai-design.md`**
(the bot); the engine was built from
`docs/superpowers/plans/2026-07-15-tock-engine.md` and the bot from
`docs/superpowers/plans/2026-07-16-tock-ai.md`. Read the spec before extending
behaviour — it defines the data model, the move contract, and the rules of the
game in detail, and the sections below only summarize the parts that shape
architecture.

Code identifiers and comments are **English** (see Code Style below). Tock's domain
terms are French in origin; this glossary maps them so we share the vocabulary, but
the **English** term is what goes in code: `nid` = home, `anneau` = track/ring,
`couloir` = finish lane, `bouche` = lane mouth, `bille` = marble, `prise` =
capture, `case de départ` = start square.

## What is being built

**Tock** — a Ludo-style, card-driven board game playable in a full-screen,
colored terminal TUI. v1: one human vs. 1–3 bots, 4-seat board, every seat for
itself (no teams). Single bot level ("Normal", greedy heuristic with 1-ply
lookahead).

## Commands

- `pnpm test` — run the full Vitest suite once (`vitest run`)
- `pnpm test <path>` — run a single file, e.g. `pnpm test tests/engine/split7.test.ts`
- `pnpm test:watch` — Vitest in watch mode
- `pnpm typecheck` — `tsc --noEmit`

There is **no `dev`/build script yet**: nothing is runnable until the Ink UI
(`src/index.tsx`) exists.

## Toolchain (spec §10)

Set up now:
- **TypeScript** (^5.5, strict), package manager **pnpm** (`pnpm-lock.yaml` committed)
- **Vitest** (^2.0, Jest-style API) — engine tests in `tests/engine/`

Not set up yet (add when the matching milestone starts):
- **tsx** — run the UI in dev without a build (`tsx watch src/index.tsx`)
- **React + Ink** — the terminal UI
- **ESLint + Prettier** — optional; until a linter is wired up, the Code Style
  rules below (including max warnings 0) are enforced by convention and review,
  not tooling.

## Architecture — the non-negotiable constraints

The whole design hinges on **strict engine/UI separation**: the engine knows
nothing about the terminal, the UI knows nothing about the rules. They
communicate only through pure data (state, list of legal moves, chosen move).
This exists so a future web UI can reuse the same engine.

- `src/engine/` (and `src/ai/`) is **isomorphic**: pure TypeScript, **zero Node
  dependencies** (no `fs`, `process`, etc.). Must run in a browser and on a
  server unchanged.
- **`GameState` is 100% JSON-serializable**: plain data only — no classes with
  methods, no functions stored in state. Required for future network/web play.
- **Immutability**: `applyMove(state, move)` returns a *new* state; it never
  mutates its input.
- The engine exposes a **single public API** via `src/engine/index.ts`. Every UI
  (Ink now, web later) imports exactly the same functions.

### Turn flow (both human and bot take the identical path)

1. `getLegalMoves(state, playerId): Move[]` — enumerates *all* legal moves.
2. Human turn → UI highlights those moves, captures the keyboard choice.
3. Bot turn → `ai/bot.ts` picks a move *from that same list*.
4. `applyMove(state, move): GameState` — applies it (handles captures), returns a
   new immutable state.
5. UI re-renders from the new state.

Because both players choose only from `getLegalMoves`, illegal moves are
structurally impossible, and the engine is fully testable without the UI.

### Module layout

Built:

```
src/engine/
├── types.ts    data model — Position, Card, Marble, the Move union, GameState (types only)
├── board.ts    ring geometry — startCell, laneMouth, ringDestinations, stepsToMouth
├── cards.ts    deck, shuffle, rank → steps mapping (moveSteps, canExit)
├── state.ts    createGame, drawCard, colorOf / marbleId helpers
├── moves.ts    the rules — getLegalMoves, applyMove, nextPlayer (+ 7-split enumeration)
└── index.ts    the single public API (re-exports the above)

src/ai/
├── score.ts    scoreMove (before→after delta via applyMove) + WEIGHTS, advancement, exposureFor — all pure
├── bot.ts      pickMove (greedy 1-ply, best-score set, random tie-break) + pickRandomMove
└── index.ts    the AI public API (re-exports scoreMove, WEIGHTS, pickMove, pickRandomMove)
```

Note: there is **no `rules.ts`** — the rules live in `moves.ts`, superseding the
spec's §4 sketch. `types.ts` (absent from the §4 sketch) holds the
JSON-serializable data model.

The engine's public surface (`src/engine/index.ts`) is the only thing UIs and AI
import: `createGame`, `getLegalMoves(state, playerId): Move[]`,
`applyMove(state, move, random?): GameState`, `nextPlayer`, the board helpers (`ringSize`,
`quadrantSize`, `playerCount`, `finishSize`, `startCell`, `laneMouth`), plus
`handSize` / `colorOf` / `marbleId` and all domain types.

The bot's public surface (`src/ai/index.ts`) is the only thing a UI imports to
drive a seat: `pickMove` / `pickRandomMove` (selection) and `scoreMove` /
`WEIGHTS` (the pure heuristic). Both `pick*` functions take an **optional injected
RNG** (`random: () => number`, defaulting to `Math.random`) so bot play is
deterministic under test — pass a seeded RNG rather than relying on `Math.random`.

Not built yet:

```
src/ui/       App.tsx · Board.tsx · Hand.tsx · Status.tsx · hooks/   (Ink)
src/index.tsx (launches the Ink app)
```

Engine tests live in `tests/engine/` (one file per feature) with shared helpers
in `tests/support.ts`.

## Two modeling decisions that are easy to get wrong

- **Lane mouth (`bouche`)** — the finish-lane entrance is a **fixed position on
  the ring, just *behind* the start square** (`start - 1`). A marble enters its
  lane whenever its path *crosses that mouth, in either direction*. The engine
  does **not** track a "has completed a lap" flag; the backward-4 entering the
  lane directly falls out of this geometry naturally. See spec §5.2 — implemented
  in `board.ts` (`laneMouth`, `ringDestinations`, `stepsToMouth`).
- **The `Move` union is the central contract** (spec §6.2, defined in `types.ts`):
  `exit`, `move` (with optional `enterLane`), `split7` (the 7 split across marbles,
  Σ=7), `swap` (Jack), `discard`. When several legal outcomes exist for one
  displacement (e.g. enter the lane *or* stay on the ring), the generator emits
  **one distinct `Move` per outcome** so the human/AI decides. `getLegalMoves`
  enumerates *all* combinations, including every valid 7-split partition
  (de-duplicated by a canonical order-independent key — see `enumerateSplits` in
  `moves.ts`).

## Testing priority (spec §11)

The engine is the core testing effort: move generation (Ace/King exit, backward
4 crossing the mouth, exhaustive 7-split, Jack swap, captures, start-square
protection, exact-count lane entry + entry choice) and `applyMove`
(immutability, captures, win condition). AI tests target `scoreMove` and its
parts (`advancement`, `exposureFor`) plus `pickMove` / `pickRandomMove` selection
via an injected seeded RNG for determinism, with a lockstep self-play integration
test (two seeded bots must stay in sync). UI is mostly manual in v1
(`ink-testing-library` optional).

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

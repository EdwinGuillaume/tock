# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Pre-implementation. The repository currently contains **only a validated design
document** — no source code, no `package.json`, no build tooling yet. The next
step is implementing the plan from the spec.

**The authoritative spec is `docs/superpowers/specs/2026-07-15-tock-terminal-design.md`**
(English). Read it before writing any code — it defines the data model, the move
contract, and the rules of the game in detail, and the sections below only
summarize the parts that shape architecture.

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

## Planned toolchain (per spec §10 — not yet set up)

- **TypeScript / Node.js LTS**, package manager **pnpm**
- **tsx** to run in dev without a build (`tsx watch`)
- **Vitest** for tests (Jest-style API), focused on `engine/` and `ai/`
- **React + Ink** for the terminal UI
- ESLint + Prettier optional

When scaffolding, expect commands to become roughly: `pnpm dev` (tsx watch on
`src/index.tsx`), `pnpm test` / `pnpm test <file>` (Vitest), `pnpm typecheck`
(`tsc --noEmit`). Verify against the real `package.json` once it exists.

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

### Planned module layout (spec §4)

```
src/
├── engine/   board.ts · state.ts · cards.ts · moves.ts · rules.ts · index.ts (public API)
├── ai/       bot.ts   (consumes getLegalMoves, scores each move — scoreMove is a pure fn)
├── ui/       App.tsx · Board.tsx · Hand.tsx · Status.tsx · hooks/   (Ink)
└── index.tsx (launches the Ink app)
tests/        engine + AI tests (Vitest)
```

## Two modeling decisions that are easy to get wrong

- **Lane mouth (`bouche`)** — the finish-lane entrance is a **fixed position on
  the ring, just *behind* the start square** (`start - 1`). A marble enters its
  lane whenever its path *crosses that mouth, in either direction*. The engine
  does **not** track a "has completed a lap" flag; the backward-4 entering the
  lane directly falls out of this geometry naturally. See spec §5.2.
- **The `Move` union is the central contract** (spec §6.2): `exit`, `move`,
  `split7` (the 7 split across marbles, Σ=7), `swap` (Jack), `discard`. When
  several legal outcomes exist for one displacement (e.g. enter the lane *or*
  stay on the ring), the generator emits **one distinct `Move` per outcome** so
  the human/AI decides. `getLegalMoves` must enumerate *all* combinations,
  including every valid 7-split partition.

## Testing priority (spec §11)

The engine is the core testing effort: move generation (Ace/King exit, backward
4 crossing the mouth, exhaustive 7-split, Jack swap, captures, start-square
protection, exact-count lane entry + entry choice) and `applyMove`
(immutability, captures, win condition). AI tests target `scoreMove`. UI is
mostly manual in v1 (`ink-testing-library` optional).

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

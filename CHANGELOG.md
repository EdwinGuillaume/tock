# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-28

First public release of **Tock** — a Ludo-style, card-driven race game with a
shared rules engine and two front-ends, shipped as a pnpm workspace. One human
plays against up to three bots on a four-seat cross board; you race your four
marbles out of the nest, around the ring, and home into your finish lane — but
instead of rolling dice, you play cards.

### Game engine — `@tock/core`

- Pure, headless, isomorphic rules engine: zero Node dependencies, 100%
  JSON-serialisable `GameState`, immutable `applyMove`. Runs unchanged in a
  browser and on a server.
- Single public contract shared by every front-end and the bot:
  `getLegalMoves` → chosen `Move` → `applyMove`, so illegal moves are
  structurally impossible.
- Full card rules for the 13 ranks, including Ace/King exit, backward 4,
  exact-count finish-lane entry with an explicit entry choice, and
  start-square protection.
- Special moves: the **5 pushes** an opponent forward instead of self-advancing,
  the **Jack swap**, and the exhaustive **7-split** across marbles (every valid
  partition enumerated, de-duplicated by a canonical key).
- **Continuous draw**: no separate draw phase — playing or discarding a card
  refills the hand to a constant 5, with automatic reshuffle of the discard
  pile when the draw pile runs dry.
- **Selectable board size** — 48 or 72 cells — as a runtime choice carried on
  `GameState.ringSize`.
- Shared 2D grid geometry (`board2d`) reused verbatim by both UIs.

### AI — the "Normal" bot

- Greedy 1-ply heuristic that captures, races, and manages exposure via a pure
  `scoreMove`.
- **Smart forced-discard**: keeps the strongest cards when a discard is
  unavoidable.
- Deterministic under test through an injectable seeded RNG.

### Terminal app — `@tock/terminal`

- Full-screen, coloured React + Ink TUI: setup (opponent count + board size),
  the board rendered as a cross, the hand with unplayable cards dimmed, a
  status panel, an interactive 7-split entry, a scrolling game log, and a
  winner screen.
- Keyboard-driven turn input; bots and turn advancement driven from the same
  engine contract as the human.

### Web app — `@tock/web`

- Vite + React 19 mobile web app deployed as a **shareable static link** — open
  it on a phone, no backend required.
- **Modes:** solo vs. bots (M1) and local pass-and-play (M2) with a "pass the
  phone" handoff between different humans' turns.
- **"Feutrine & or"** (warm felt & gold) visual and UX design: a felt-channel
  SVG cross board with carved sockets, glossy marbles that glide between cells
  and glow when selected, suited fanned cards, echo (ripple) destination
  markers, a discreet non-reflowing hint chip, a one-line game log with an
  expandable history, confetti on the game-over screen, and Framer-Motion
  screen transitions — all honouring `prefers-reduced-motion`.
- Touch-first, card-first interaction: pick a card, see ghost destinations, tap
  to play; a progressive on-board 7-split control and explicit source-marble
  selection for the Jack swap.
- Card-first **rules overlay** reachable from Home, Setup, and in-game
  (goal, the 13 card ranks with French letters K→R / Q→D / J→V, special moves,
  and the implicit general rules).
- **Installable, offline PWA (M3):** generated icon set, service-worker
  caching, an in-app update banner, and an install affordance (with an iOS
  Share-sheet hint fallback).
- **Sound effects and a music bed** (Howler): dosed move, capture, push, swap,
  lane-entry, and win cues plus a looping ambient track — lazy-loaded on first
  gesture, install-gated, with a persistent mute toggle and tab-visibility
  pause, all honouring the first-gesture audio unlock.

### Project & tooling

- Licensed under **PolyForm Noncommercial 1.0.0** (see `LICENSE`) — free for
  non-commercial use; every workspace package declares the matching `license`
  field.
- pnpm workspace with a shared `tsconfig.base.json`: `packages/core`,
  `apps/terminal`, `apps/web`.
- TypeScript (strict) + Vitest across all three packages; `tsx` for the
  terminal dev loop; Vite + `@vitejs/plugin-react` for the web app.
- 437 passing tests covering the engine (132), AI, terminal UI (65), and web
  UI (240), with `tsc --noEmit` clean workspace-wide.

[1.0.0]: https://github.com/EdwinGuillaume/tock/releases/tag/v1.0.0

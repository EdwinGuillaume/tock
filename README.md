# Tock

> A Ludo-style, card-driven race game — playable in your terminal, and as a
> shareable mobile web link.
> One human against up to three bots, played out on a colourful cross-shaped board.

You drive your four marbles out of their nest, all the way around a shared ring,
and home into your finish lane — but instead of rolling dice, **you play cards**.
Get all four marbles home first and you win.

Tock ships as a **pnpm workspace** with one shared rules engine and two
front-ends:

- **[`@tock/core`](./packages/core)** — the pure, headless game engine and bot.
  Zero Node dependencies, 100% JSON-serialisable state, runs unchanged in a
  browser or on a server.
- **[`@tock/terminal`](./apps/terminal)** — a React + Ink full-screen coloured
  TUI. The original front-end.
- **[`@tock/web`](./apps/web)** — a Vite + React 19 mobile web app with a
  polished **"Feutrine & or"** (warm felt & gold) look: a welcome screen, a
  felt-channel SVG cross board with glossy marbles, touch-first
  ghost-destination interaction, dosed animations (all respecting
  `prefers-reduced-motion`), and a **shareable link** — open it on a phone, no
  install, no backend. The portfolio piece.

Both front-ends talk to `@tock/core` through the exact same contract
(`getLegalMoves` → chosen `Move` → `applyMove`) and add nothing to the rules
themselves — see [Architecture](#architecture) below. `@tock/core` also ships
**a "Normal" bot** (greedy 1-ply heuristic that captures, races, and discards
intelligently), reused unchanged by both UIs.

**286 passing tests** across the engine, AI, terminal UI, and web UI; `tsc --noEmit`
clean workspace-wide.

```
                  yellow
                    │
          green ──  ✦  ── blue
                    │
                   red  ← YOU
```
*Conceptual only. The real board is a plus/cross: the ring wraps the outside, each
seat sits on one arm (you're always at the bottom in red), every finish lane threads
inward toward the centre `✦`, and each nest sits in a corner.*

---

## The game

- **Board:** a four-seat cross. The ring (the shared track) runs around the outside;
  each seat owns one quadrant with its own start cell, a private 4-cell finish lane,
  and a nest.
- **Players:** you (seat 0, **red**, always at the bottom) plus **1–3 bots**. Empty
  seats stay inactive — they keep their quadrant but have no marbles.
- **Marbles:** every active player has **4**.
- **Object:** be the **first** player to bring **all four marbles into your finish
  lane**. The game ends the instant someone does.

Marbles live in one of three zones: `home` (the nest, waiting to come out), `track`
(the shared ring), and `finish` (your private 4-cell home stretch).

---

## Quick start

**Requirements:** Node (the repo pins **v24** via `.nvmrc`) and **pnpm**.

```bash
pnpm install     # install dependencies, once, from the repo root
```

### Play in the terminal

```bash
pnpm dev:terminal   # pnpm --filter @tock/terminal dev
```

Needs a real terminal with raw-mode keyboard support (a normal TTY — not a
piped/redirected shell). Runs the Ink app through `tsx` with no build step;
`pnpm --filter @tock/terminal dev:watch` reloads on file changes while hacking
on the UI.

### Play in a browser

```bash
pnpm dev            # pnpm --filter @tock/web dev
```

Opens a Vite dev server — follow the printed `localhost` URL, or the LAN URL
to try it on a phone on the same network. `pnpm build` produces the static
`apps/web/dist/` bundle that gets deployed as the shareable link (see
[`apps/web/README.md`](./apps/web/README.md) for deploy notes — no backend
required).

---

## How to play

The rules below are shared by both front-ends; the walkthrough describes the
**terminal** controls specifically (arrow keys). See
[Playing on the web](#playing-on-the-web) for the touch equivalent.

### 1. Setup

The setup screen has two choices:

| Field | Options | Notes |
|-------|---------|-------|
| **Opponents** | 1, 2, or 3 bots | You are always seat 0; bots fill the rest |
| **Board size** | **48** (default) or **72** ring cells | 48 = classic and compact; 72 = larger, sparser board |

Use **↑/↓** to move between the fields, **←/→** to change the highlighted value, and
**Enter** to start.

### 2. Taking a turn

On your turn you play (or discard) **exactly one** card, then immediately draw a
replacement, so your hand is always **5 cards**. The whole turn is arrow-key driven —
the UI only ever lets you choose from genuinely legal moves, so you can't make an
illegal one.

| Key | Action |
|-----|--------|
| **← / →** | Move the highlight (card, marble, destination, or 7-split amount) |
| **Enter** | Confirm the current choice |
| **Esc / Backspace** | Step back one choice |

A typical turn is **pick a card → pick a marble → (pick where to land, if there's a
choice) → done**. The board previews your selected marble and highlights the squares
it could land on. Special cards branch a little:

- **Jack (swap):** pick your marble, then pick the opponent marble to swap with.
- **5 (push):** pick the *opponent* marble you want to shove forward 5.
- **7 (split):** a dedicated panel opens (see below).
- **Forced discard:** if you have no legal play at all, the prompt switches to
  "choose a card to discard" and Enter throws the highlighted card.

### 3. The 7-split panel

A `7` moves a total of **exactly 7 steps**, and you may spread those steps across any
of your marbles. The split panel lists your eligible marbles; **←/→** adjusts the
steps for the focused marble (only through amounts that keep a legal total possible),
**Enter** locks it and moves on, and the header tracks how many of the 7 steps remain.
If a partition can either enter the finish or stay on the ring, you get a quick
"enter lane / stay on ring?" prompt to resolve it.

### 4. Game over

When someone gets all four marbles home you see a `🏆 <colour> wins!` screen.
Press **`r`** to play again (back to setup) or **`q`** (or Ctrl-C) to quit.

### Playing on the web

The web app plays by the same rules through a touch-first interaction, with no
arrow keys: tap a playable card in your hand and its legal destinations light
up as **"ghost" markers** on the board — tap a ghost to play there. A Jack
walks you from your marble to the opponent marble you're swapping with the
same way; a 5 highlights the opponent marbles you can push. A 7 opens a
step-by-step split control (allocate steps to a marble, undo, tap **Play**
once all 7 are spent) instead of a modal panel. There's no separate "game
over" screen transition to learn — it's the same win screen, tap to restart.

**Setup and pass-and-play.** Seat 0 is always you; each of the other three
seats has a button that cycles **human → bot → inactive**, so you can mix any
number of local humans and bots (or a full four-human table). When play passes
from one human to a *different* human, a **"Pass to \<colour\>"** interstitial
covers the board first — the next player taps *"reveal your hand"* to take
over, so nobody sees the previous player's cards. Bot turns in between never
trigger it, and a solo-vs-bots game (one human) never shows it at all.

---

## The cards

A standard 52-card deck. Forward movement is around the ring toward your own finish.

| Card | What it does |
|------|--------------|
| **Ace** | Bring a marble out of the nest onto your start cell, **or** move forward **1** |
| **King** | Bring a marble out, **or** move forward **13** |
| **Queen** | Move forward **12** |
| **Jack** | **Swap** one of your ring marbles with an opponent's ring marble |
| **10 / 9 / 8 / 6 / 3 / 2** | Move forward by the pip value |
| **7** | Move a total of **exactly 7**, splittable across several of your marbles |
| **5** | **Push** one *opponent* marble forward exactly **5** — never your own |
| **4** | Move **backward 4** on the ring |

Only the **Ace** and **King** bring a marble out of the nest, and only onto your own
start cell (blocked if one of your marbles already sits there).

---

## Rules worth knowing

These are the ones that surprise people:

- **Coming home takes a full lap.** Your finish lane's entrance ("the mouth") is a
  fixed spot just *behind* your start cell. A marble only turns into the lane when a
  **forward** move carries it across that mouth — so it has to travel almost all the
  way around the ring first.
- **A backward 4 never comes home.** Even though the mouth sits right behind your
  start, a backward move always stays on the ring. There's no shortcut into the
  finish. (A backward 4 can still capture, though.)
- **Lane entry is exact — no overshoot.** You must land on a finish cell precisely,
  can't jump past a marble already parked in your lane, and can't move backward once
  inside.
- **Entering is your choice.** When a forward move could either enter the lane or keep
  going on the ring, both options are offered — you decide.
- **Captures send marbles home.** Land *exactly* on an opponent's marble and it goes
  back to its nest. Captures happen only on the ring; finish lanes are private.
- **Your start cell is a safe square (for defence).** A marble sitting on its own
  start can't be captured, passed, swapped away, or pushed by opponents. You can still
  choose to move or swap it yourself.

---

## The bot — "Normal"

There's one difficulty. The bot is a **greedy, one-move-ahead** player:

1. It looks at every legal move.
2. It scores each one by simulating it and measuring the result.
3. It keeps all the top-scoring moves and picks between ties at random, so it doesn't
   play the same game every time.

The scoring prioritises, in order: **getting a marble into the finish → capturing an
opponent → getting a marble out of the nest → general forward progress**, while
subtracting points for leaving its own marbles exposed to capture and for pushing an
opponent forward for free (a `5` that shoves an opponent *past* their own start,
costing them nearly a lap, is instead rewarded).

When the bot has nothing legal to play and must discard, it doesn't throw a card at
random — it **keeps its strongest cards** and dumps the least useful, roughly in the
order `4 > 7 > J > A > K > 5 > Q > 10 > 9 > 8 > 6 > 3 > 2`.

---

## Features at a glance

- Human vs. 1–3 bots on a 4-seat, free-for-all board (no teams)
- **Local pass-and-play on the web** — mix humans and bots across the four seats,
  with a "pass the phone" screen that hides the previous player's hand
- Selectable board size: **48** or **72** ring cells
- Continuous draw — your hand is always 5 cards, no round-based redeal
- The full card set: exits, backward-4, the Jack swap, the 5-push, and splittable 7s
- The `5` pushes an opponent rather than advancing you
- Cross-shaped board rendering with nests in the corners and the human always at the bottom
- A greedy heuristic bot with smart forced-discard
- Live move log, in-turn previews, and a guided 7-split editor

Colour is the sole cue that tells players apart (red / green / yellow / blue), which
means the board isn't distinguishable on a no-colour terminal or under red/green
colour-vision deficiency — a known v1 tradeoff.

---

## Web app roadmap

The web app ([`@tock/web`](./apps/web)) is delivered in milestones, on top of
the same `@tock/core` engine:

- **M1 — Web, solo vs. bots. Done.** The Vite + React app in this repo today:
  a welcome screen and a felt-channel SVG cross board (the "Feutrine & or"
  redesign), the card-first ghost-destination touch interaction (including the
  progressive 7-split, where you tap the marble on the board to choose it),
  deployed as a static site — the shareable link. The portfolio centerpiece.
- **M2 — Local pass-and-play. Done.** Any mix of human and bot seats on one
  device: a chairs-based setup adds/removes opponents and picks human/bot, and a
  "pass the phone" interstitial hides the previous player's hand between
  different humans' turns (bot turns in between don't trigger it). A UI-only
  addition — the engine
  already supported multiple `human` seats.
- **M3 — PWA (roadmap).** Installable, offline-capable, an app icon, a splash
  screen — turning the manifest metadata already in `apps/web/public/` into a
  full install prompt.
- **M4 — Native wrap (roadmap).** Capacitor wraps the same static build for
  the iOS/Android home screen and, if wanted, the app stores — no logic
  rewrite, since the web build is already the whole app.

See `docs/superpowers/specs/2026-07-20-tock-mobile-web-design.md` for the full
design rationale (why web-first, why a pnpm workspace, why Vite).

---

## For contributors

### Architecture

The project is built on a **strict engine / UI separation**, now enforced as a
**package boundary**: every app under `apps/*` depends on `@tock/core` and
nothing else touches the rules.

- **`packages/core` (`@tock/core`)** is *isomorphic* — pure TypeScript with **zero
  Node dependencies**. It runs unchanged in a browser or on a server.
- **`GameState` is 100% JSON-serialisable** — plain data, no methods, no stored
  functions. Ready for networked or replay play later.
- **`applyMove` is immutable** — it returns a new state, never mutating its input.
- Every UI (`@tock/terminal`, `@tock/web`) talks to the game through one small
  contract: **`getLegalMoves` → choose a move → `applyMove`**. Because both
  humans and bots choose only from `getLegalMoves`, illegal moves are
  structurally impossible, and `@tock/core` never imports from an app.

### Project layout

```
packages/core/            @tock/core — the rules + bot, pure and headless
├── src/engine/           types.ts · board.ts · cards.ts · state.ts · moves.ts · index.ts
├── src/ai/               score.ts (scoreMove, WEIGHTS, cardKeepValue) · bot.ts (pickMove / pickRandomMove) · index.ts
├── src/geometry/         board2d.ts — shared 2D grid geometry (Cell/Side, ring layout) used by both UIs
├── src/index.ts          the single public API: re-exports engine + ai + board2d
└── tests/                engine/ · ai/ · board2d.test.ts (support.ts = shared helpers)

apps/terminal/            @tock/terminal — React + Ink terminal UI
├── src/ui/               App.tsx · Setup.tsx · Board.tsx · Hand.tsx · Status.tsx
│                         SplitPanel.tsx · GameLog.tsx · GameOver.tsx
│                         format.ts · layout.ts · selection.ts · theme.ts (pure presentation helpers)
│                         hooks/  useGameLoop (drives bots + turns), useTurnInput (keyboard)
├── src/index.tsx         renders <App /> into the terminal
└── tests/ui/             one file per feature

apps/web/                 @tock/web — Vite + React 19 mobile web UI ("Feutrine & or" theme)
├── src/components/       App.tsx (routing) · Home.tsx (welcome) · GameScreen.tsx (interaction state machine)
│                         Setup.tsx · GameOver.tsx · Confetti.tsx · PassInterstitial.tsx · ScreenTransition.tsx
│                         Board.tsx · Marble.tsx · Ghost.tsx · Hand.tsx · StatusBar.tsx · GameLog.tsx · SplitControls.tsx
├── src/hooks/            useTockGame (state + commitMove) · useBotAutoplay (drives bot seats)
├── src/                  svgGeometry.ts · moveSelection.ts · splitAllocation.ts · passAndPlay.ts · theme.ts · motion.ts · format.ts
├── src/main.tsx          renders <App /> into the DOM
├── public/               manifest.webmanifest (PWA metadata, no service worker yet — M3)
└── tests/                one file per feature

docs/superpowers/         design specs and implementation plans, one pair per feature
```

### Commands

```bash
pnpm --filter @tock/web dev          # launch the web app (alias: pnpm dev)
pnpm --filter @tock/terminal dev     # launch the terminal app (alias: pnpm dev:terminal)
pnpm --filter @tock/web build        # production build → apps/web/dist/ (alias: pnpm build)
pnpm -r test                         # run every package's Vitest suite once (alias: pnpm test)
pnpm -r typecheck                    # tsc --noEmit in every package (alias: pnpm typecheck)
pnpm --filter <pkg> test <path>      # run a single test file in one package,
                                      # e.g. pnpm --filter @tock/core test tests/engine/split7.test.ts
```

### Code style

- All code and comments in **English**.
- No semicolons, no trailing commas; `const` arrow functions, not the `function` keyword.
- **No non-null assertions (`!`) in production code** — prefer safe fallbacks, narrowing,
  or a tighter type. (Unit tests are the only exception.)
- Warnings are errors (max-warnings: 0).

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture notes and conventions, and
[`docs/superpowers/`](./docs/superpowers/) for the design specs behind every feature.

---

## Not in v1

Networked multiplayer (only same-device play — solo vs. bots or local
pass-and-play), team play (2v2), a "Hard" multi-ply bot, an "Easy" bot in the
menu, more than four players, undo/history, and animations beyond the
between-turn pause.

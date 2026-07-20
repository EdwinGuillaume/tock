# Tock

> A Ludo-style, card-driven race game that runs entirely in your terminal.
> One human against up to three bots, played out on a colourful cross-shaped board.

Tock is played in a full-screen, coloured TUI. You drive your four marbles out of
their nest, all the way around a shared ring, and home into your finish lane — but
instead of rolling dice, **you play cards**. Get all four marbles home first and you win.

- **Pure, headless game engine** — TypeScript, zero Node dependencies, 100% JSON-serialisable state
- **A "Normal" bot** — greedy 1-ply heuristic that captures, races, and discards intelligently
- **A React + Ink terminal UI** — setup screen, live board, hand, move log, guided 7-splits
- **191 passing tests** across engine, AI, and UI; `tsc --noEmit` clean

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

**Requirements:** Node (the repo pins **v24** via `.nvmrc`) and **pnpm**. The UI needs
a real terminal with raw-mode keyboard support (a normal TTY — not a piped/redirected
shell).

```bash
pnpm install     # install dependencies
pnpm dev         # launch the game
```

`pnpm dev` runs the Ink app through `tsx` with no build step. Use `pnpm dev:watch`
to reload on file changes while hacking on the UI.

---

## How to play

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

## For contributors

### Architecture

The project is built on a **strict engine / UI separation**, so the same engine could
later back a web UI:

- **`src/engine/`** and **`src/ai/`** are *isomorphic* — pure TypeScript with **zero
  Node dependencies**. They run unchanged in a browser or on a server.
- **`GameState` is 100% JSON-serialisable** — plain data, no methods, no stored
  functions. Ready for networked or replay play later.
- **`applyMove` is immutable** — it returns a new state, never mutating its input.
- Every UI talks to the game through one small contract: **`getLegalMoves` → choose a
  move → `applyMove`**. Because both humans and bots choose only from
  `getLegalMoves`, illegal moves are structurally impossible.

### Project layout

```
src/
├── engine/     the rules — pure, headless, JSON-serialisable
│   ├── types.ts    data model: Position, Card, Marble, the Move union, GameState
│   ├── board.ts    ring geometry: startCell, laneMouth, ringDestinations
│   ├── cards.ts    deck, shuffle, rank → steps mapping
│   ├── state.ts    createGame, drawCard, colour/id helpers
│   ├── moves.ts    getLegalMoves, applyMove, 7-split enumeration
│   └── index.ts    the single public API
├── ai/         the "Normal" bot — pure heuristic
│   ├── score.ts    scoreMove, WEIGHTS, cardKeepValue
│   ├── bot.ts      pickMove / pickRandomMove
│   └── index.ts    the AI public API
├── ui/         React + Ink terminal UI (the only place with Node/React deps)
│   ├── App.tsx · Setup.tsx · Board.tsx · Hand.tsx · Status.tsx
│   ├── SplitPanel.tsx · GameLog.tsx · GameOver.tsx
│   ├── format.ts · layout.ts · selection.ts · theme.ts   (pure presentation helpers)
│   └── hooks/  useGameLoop (drives bots + turns), useTurnInput (keyboard)
└── index.tsx   renders <App /> into the terminal

tests/          engine/ · ai/ · ui/ — one file per feature (support.ts = shared helpers)
docs/superpowers/   design specs and implementation plans, one pair per feature
```

### Commands

```bash
pnpm dev            # launch the game
pnpm dev:watch      # launch with reload on change
pnpm test           # run the full Vitest suite once
pnpm test <path>    # run a single file, e.g. pnpm test tests/engine/split7.test.ts
pnpm test:watch     # Vitest in watch mode
pnpm typecheck      # tsc --noEmit
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

Networked/web multiplayer, team play (2v2), a "Hard" multi-ply bot, an "Easy" bot in the
menu, more than four players, undo/history, and animations beyond the between-turn pause.

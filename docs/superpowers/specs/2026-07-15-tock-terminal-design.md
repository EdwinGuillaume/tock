# Tock in the terminal — Design document

- **Date**: 2026-07-15
- **Status**: approved (brainstorming), ready for the implementation plan
- **Author**: eguillaume

## 1. Context & goal

Build the board game **Tock** (a card-driven, Ludo-style game) playable in a
**terminal**, rendered with characters (full-screen, colored TUI).

The author is proficient in **web front-end** technologies; the stack is therefore
chosen to reuse those skills as much as possible: **TypeScript / Node.js**, with
**Ink** (React for the terminal) for the display layer.

Cross-cutting goal, stated up front: being able to **plug in another UI later**
(e.g. a hosted web version) on top of the same engine. This mandates a strict
separation between logic and display (see §4).

## 2. Scope of v1

**Included:**
- **4-seat board** (cross with 4 quadrants), **free-for-all** (no teams).
- **1 human player** against **1 to 3 bots** (AI): the number of active players
  (2 to 4) is chosen at launch. Unfilled seats are inactive (no marbles), but the
  board always keeps its 4 quadrants.
- **Full Tock rules**: leaving home on Ace/King, 4 moves backward, splittable 7,
  Jack swaps two marbles, captures, start-square protection, home stretch.
- **Full-screen TUI**, keyboard-driven (Ink).
- A single bot level: **Normal** (greedy heuristic).

**Out of scope for v1 (future work):**
- Networked multiplayer / hosted web version (but the engine is designed for it).
- Team play (2 v 2).
- A "Hard" bot with multi-turn lookahead.
- An "Easy" difficulty exposed in the menu (the random pick exists internally as a
  building block and for tests, but is not offered).
- 6 players.

## 3. Technical constraints

- The `engine/` folder (and `ai/`) is **isomorphic**: pure TypeScript, **no Node
  dependencies** (no `fs`, `process`, etc.). It must be able to run in a browser
  as well as on a server.
- `GameState` is **100% JSON-serializable**: data only, no classes with methods
  and no functions in the state. Essential for a future networked/web version
  (sending over the wire, storage, replay).
- The engine exposes a **single public API** via `engine/index.ts`. Any UI (Ink
  today, web tomorrow) imports exactly the same functions.
- **Immutable** state: `applyMove` returns a new state and does not mutate its
  input.

## 4. Architecture & module structure

Guiding principle: **the engine knows nothing about the terminal, the UI knows
nothing about the rules.** They communicate solely through pure data (state, list
of legal moves, chosen move).

```
tock/
├── src/
│   ├── engine/           ← pure logic, zero I/O, 100% testable
│   │   ├── board.ts        logical board geometry (cells, positions)
│   │   ├── state.ts        GameState type + creating a game
│   │   ├── cards.ts        deck, dealing, card values
│   │   ├── moves.ts        legal-move generation + applying a move
│   │   ├── rules.ts        special rules (split 7, Jack, 4 backward, captures…)
│   │   └── index.ts        public engine API
│   ├── ai/               ← consumes the engine's legal moves
│   │   └── bot.ts          picks a move using a heuristic
│   ├── ui/               ← Ink (React terminal), display + keyboard capture
│   │   ├── App.tsx         root component, game loop
│   │   ├── Board.tsx       renders the board in colored characters
│   │   ├── Hand.tsx        the human player's hand
│   │   ├── Status.tsx      current turn, last move played
│   │   └── hooks/          useInput, card/marble/target selection
│   └── index.tsx         entry point (launches the Ink app)
├── tests/                ← engine + AI tests (Vitest)
├── docs/superpowers/specs/
├── package.json
└── tsconfig.json
```

**Flow of a turn:**
1. `getLegalMoves(state, playerId)` → array of legal moves.
2. Human's turn → the UI shows/highlights those moves, captures the choice from
   the keyboard.
3. Bot's turn → `ai/bot.ts` picks a move from that same list.
4. `applyMove(state, move)` → **new** immutable state (handles captures).
5. The UI re-renders from the new state.

Benefits: the engine is testable without launching the display; human and AI
follow the **same** path (no illegal move possible); the game can be developed and
tested before the UI is even finished.

## 5. Data model

### 5.1 Board (logical geometry)

Three zones per player:
- **Home / nest (`home`)**: 0 to 4 marbles waiting to come out.
- **Ring (`track`)**: a circle of cells `0..ringSize-1`, the shared circuit. Each
  player has a fixed **start cell** (`startCell[playerId]`), evenly spaced
  (`ringSize / 4` apart).
- **Home stretch (`finish`)**: 4 private cells `0..3`, inaccessible to opponents.

**Ring size**: `ringSize = 48` (**12 cells per side**). A single constant, chosen
for a comfortable render in an ~80×24 terminal. Changeable with no impact on the
logic.

**A marble's position** — a union of three cases:

```ts
type Position =
  | { zone: 'home' }                    // in the nest
  | { zone: 'track', index: number }    // 0..ringSize-1 on the ring
  | { zone: 'finish', index: number }   // 0..3 in its home stretch
```

### 5.2 Home-stretch mouth (key modeling point)

The mouth of the home stretch is a **fixed position on the ring, just *behind* the
start cell** (at `start - 1` in the direction of travel). A marble diverts into its
home stretch as soon as **its path crosses this mouth, in either direction**:

- **From the front** (normal travel): from its start cell, the marble moves away
  from the mouth and must travel almost all the way around the ring to reach it
  from the other side → the classic "full loop".
- **From behind** (the 4 trick): the mouth is right behind the start cell; a
  backward 4 crosses it and threads the remaining steps into the home stretch →
  the marble comes home almost directly, **without having looped the ring**.

> Consequence: the engine does **not** track a "has looped" flag. It only knows the
> fixed position of the mouth, and any movement (forward or backward) that crosses
> it diverts into the home stretch. The scenario "leave home, then play a 4 to come
> home directly" falls out of this model naturally.

### 5.3 Game state

`GameState` (pure data, JSON-serializable) contains at minimum:
- the list of players (id, color, human/bot);
- for each marble: its `id`, owner, and `Position`;
- the draw pile, the discard pile, and **each player's hand**;
- the player whose turn it is;
- the end-of-game state (winner, if any).

## 6. Cards & move format

### 6.1 Cards (52-card deck) and effects

| Card | Effect |
|------|--------|
| Ace | Bring a marble out of the nest **or** move 1 |
| King | Bring a marble out of the nest **or** move 13 |
| Queen | Move 12 |
| Jack | **Swap** one of your marbles with an opponent's marble |
| 10, 9, 8, 6, 5, 3, 2 | Move by the value |
| 7 | Move 7, **splittable** across several marbles (total = 7) |
| 4 | Move **backward** 4 |

**Flow**: a hand of **5 cards** per player. On their turn, a player plays **one**
card and performs the move; if they have no legal move, they **discard** a card
(without moving). Either way they then **draw one card**, so the hand always
stays at five (continuous draw — no round-based redeal). The played card enters
the discard pile **before** the draw; when the draw pile is empty it is
reshuffled from the discard pile (the just-played card included) before drawing.

### 6.2 Move format — the central contract

```ts
type Move =
  | { type: 'exit', card, marbleId }                            // leave the nest (Ace/King)
  | { type: 'move', card, marbleId, steps }                     // move forward / backward
  | { type: 'split7', card, partList: { marbleId, steps }[] }   // split 7 (Σ = 7)
  | { type: 'swap', card, marbleId, targetMarbleId }            // Jack
  | { type: 'discard', card }                                   // no move possible
```

When several outcomes are legal for the same movement (enter the home stretch *or*
stay on the ring, see §7), the generator produces **one distinct `Move` per
outcome**, so that the player/AI decides.

### 6.3 Public engine API

- `getLegalMoves(state, playerId): Move[]` — enumerates **all** legal moves,
  including **every** split combination of the 7 and both home-stretch-entry
  outcomes when they apply.
- `applyMove(state, move, random = Math.random): GameState` — applies the move,
  handles **captures** (a marble landing on an opponent's marble → sent back to
  the nest), draws the actor's replacement card (reshuffling the discard pile
  into an empty draw pile via `random`), and returns a **new** immutable state.

## 7. Detailed rules

**Captures & occupancy:**
- Landing *exactly* on an opponent's marble **sends it back to its nest**.
- You **cannot** land on one of your own marbles (illegal move).
- Passing *over* marbles is allowed, **except** for the protection below.

**Start-square protection:**
- A marble sitting on **its own start cell** is **protected**: it can be neither
  captured, nor passed over, nor swapped (Jack) until it has moved.

**Home stretch:**
- Entry is governed by the geometry of the **mouth** (§5.2), crossable in both
  directions.
- **Player's choice to enter**: when a path can enter the home stretch *and* an
  equivalent path on the ring remains legal, the generator offers **both** moves;
  the human/AI decides. (A marble may decline to enter and loop again: legal but
  pointless; the AI won't do it.)
- Entry requires an **exact count**: no overshooting the last home-stretch cell,
  no jumping over one of your own marbles already parked there.
- A marble in the home stretch is permanently safe from opponents.

**Special cards:**
- **Split 7**: total distance moved is **exactly 7**, distributed across your
  marbles; each sub-move must be legal on its own (captures included). If no
  distribution consumes the full 7, the card is only playable as a discard.
- **Jack (swap)**: swap one of your marbles with an opponent's marble, **only on
  the ring** (neither nest nor home stretch); a marble protected on its start cell
  cannot be swapped.
- **4 backward**: moves back 4 on the ring (can capture while moving backward, can
  enter the home stretch via the mouth, see §5.2).

**End of game:** the **first** player to park their **4 marbles** in their home
stretch wins; the game ends.

## 8. Artificial intelligence ("Normal" bot)

The bot receives `getLegalMoves(state, botId)` and **returns a move from the
list** (impossible to cheat or play illegally).

**Greedy bot, 1-move lookahead.** For each legal move, it simulates `applyMove`
then scores the resulting state:

```ts
scoreMove(state, move): number   // higher = better
```

Weighted criteria (a **pure** function, hence unit-testable):
- **+++** park a marble in the home stretch / bring it closer to the finish;
- **++** capture an opponent's marble;
- **+** bring a marble out of the nest when few marbles are in play;
- **−** leave one of your marbles exposed just in front of an opponent.

The bot picks the best score, with a **random tie-break** on equality (less
repetitive play).

A "random move" pick exists internally (building block + tests) but is not exposed
as a difficulty level in v1.

## 9. Ink rendering & interaction

**Layout**: a square ring drawn with characters, **human player always at the
bottom**, each opponent on a side with its color (red / green / yellow / blue).
Nests on the outside, home stretches pointing toward the center. The render shows
every cell, the marbles (colored `●`) at their positions, and **highlights the
legal choices**.

Components: `<Board>`, `<Hand>` (the player's hand), `<Status>` (current turn,
last move).

**Keyboard interaction** (`useInput`), a turn in 2–3 steps:
1. Choose a card from your hand (`←/→` or a number key), `Enter` to confirm.
2. The game highlights the playable marbles/moves; the player chooses.
3. Special cases — the **split 7** and the **Jack** chain a 2nd selection
   (distribute the steps / choose the target).

## 10. Tooling

- **Node.js LTS + TypeScript**
- **tsx** to run in dev without a build (`tsx watch`)
- **Vitest** for tests (Jest-like API), mainly on `engine/` and `ai/`
- **React + Ink** for the UI
- Package manager: **pnpm**
- ESLint + Prettier (optional)

## 11. Testing strategy

- **Engine (`engine/`)**: the core testing effort. Unit cases on move generation
  (Ace/King exit, backward 4 crossing the mouth, exhaustive split 7, Jack,
  captures, start-square protection, exact-count home-stretch entry + the entry
  choice), and on `applyMove` (immutability, captures, win conditions).
- **AI (`ai/`)**: tests on `scoreMove` ("in this position, prefer the capture /
  the home-stretch entry").
- **UI (`ui/`)**: mostly manual in v1; `ink-testing-library` possible for a few
  cases if needed, without making it a priority.

## 12. Anticipated future work

- Hosted web UI reusing `engine/` (already isomorphic and serializable).
- Networked multiplayer.
- Team play 2 v 2.
- A "Hard" bot (multi-turn lookahead).
- Extracting `engine/` into its own package (monorepo).

# Tock AI — "Normal" bot design

## 1. Context & goal

The engine is built, tested, and merged (`src/engine/`). It exposes a single
public API (`getLegalMoves`, `applyMove`, `createGame`, board helpers, all
domain types) through `src/engine/index.ts`. This document designs the second
milestone: the **bot** (`src/ai/`), a greedy, one-move-lookahead player that
picks a move from the engine's legal-move list.

The bot must satisfy the same architectural constraints as the engine
(spec §3): **isomorphic** (pure TypeScript, zero Node dependencies), consuming
the engine only through its public barrel. It exposes a **pure, deterministic**
scoring function so the heuristic is unit-testable without any randomness, and
isolates the one non-deterministic step (tie-break) behind an injectable RNG,
exactly as the engine's `shuffle` does.

This is the single "Normal" difficulty of v1. A "Hard" bot with multi-turn
lookahead is explicitly future work (§7 and terminal spec §12).

## 2. Scope

In scope:
- A pure `scoreMove(state, move): number` heuristic (higher = better).
- A `pickMove(state, random?): Move` selector: greedy best score, random
  tie-break.
- A `pickRandomMove(moveList, random?): Move` building block (terminal spec §8:
  "a random-move pick exists internally").
- Unit tests on the heuristic and the selector.

Out of scope (deferred, §7):
- Multi-ply / "Hard" bot.
- Smart discard selection (keeping high-value cards).
- Path-clearance inside the exposure estimate.
- Modelling opponents' hidden hands.

## 3. Module layout

The AI mirrors the engine's separation of concerns: the **pure heuristic** is
isolated from the **selection + randomness**.

```
src/ai/
├── score.ts    scoreMove (pure, deterministic) + advancement/exposure helpers + WEIGHTS
├── bot.ts      pickMove + pickRandomMove (selection, injected randomness)
└── index.ts    the single public AI API (barrel)
```

`src/ai/` is **isomorphic**: pure TypeScript, no `fs`/`process`/Node globals.
It imports the engine **only** through `src/engine/index.ts` — the same surface
every UI uses. It never reaches into engine internals.

## 4. Public API

```ts
// score.ts
export const scoreMove = (state: GameState, move: Move): number => { /* ... */ }

// bot.ts
export const pickMove = (state: GameState, random: () => number = Math.random): Move => { /* ... */ }
export const pickRandomMove = (moveList: Move[], random: () => number = Math.random): Move => { /* ... */ }
```

- `scoreMove` is **pure and deterministic**: same `(state, move)` always yields
  the same number. It never mutates its input (it calls the engine's immutable
  `applyMove` on a copy-returning basis).
- The **mover** is `state.currentPlayer`. `scoreMove` captures
  `botId = state.currentPlayer` **before** simulating `applyMove` (which advances
  the turn via `nextPlayer`), so the evaluation is always from the mover's point
  of view — never the next player's.
- The RNG is **injected** with a `Math.random` default, mirroring the engine's
  `shuffle(list, random = Math.random)`. This keeps `pickMove` testable with a
  stub RNG.
- **`scoreMove` value-purity.** `scoreMove`'s returned number is deterministic
  and it never mutates its inputs. It calls the engine's `applyMove`, which now
  draws a replacement card each turn; `scoreMove` passes a **fixed** RNG
  (`applyMove(state, move, () => 0)`) for its throwaway simulations, so it never
  reads the global `Math.random`. The drawn card is irrelevant to the score
  (`scoreMove` reads marble positions only, never hands or piles), so the
  heuristic is both value-deterministic and side-effect-free with respect to the
  global RNG stream — safe for a future seeded-replay / networked mode.

## 5. The scoring function (transition / delta model)

All candidate moves are scored by simulating the transition and reading the
before → after difference. Simulation is necessary because the final positions
of `enterLane`, `split7`, and `swap` moves cannot be read from the `Move` object
alone.

```
score =  W_PROGRESS  · ownAdvancementDelta        // general forward progress (per cell)
       + W_FINISH    · ownMarblesEnteringFinish    // +++ parking in the home stretch
       + W_CAPTURE   · opponentsCapturedThisMove    // ++
       + W_EXIT      · exitUrgency                  // +  (exit moves only)
       − W_EXPOSURE  · exposureAfter                // −  danger of the resulting own positions
```

### 5.1 Advancement scalar

A single monotonic scalar per marble, increasing as the marble nears winning, so
the delta is meaningful. For a marble owned by player `owner` at `position`:

- `home` → `0`
- `track` at `index` → `1 + ((index − startCell(owner) + ringSize) % ringSize)`,
  ranging `1..48` — distance travelled from the owner's start square. Because the
  lane mouth sits one cell *behind* the start (`startCell − 1`, terminal spec
  §5.2), this value rises across the whole loop toward the mouth.
- `finish` at `index` → `49 + index`, ranging `49..52` — any finish slot beats
  any track cell, and a deeper slot beats a shallower one.

All terms use **integer** arithmetic, so equal moves tie **exactly** — no
floating-point epsilon is required for the tie-break.

### 5.2 Terms

- `ownAdvancementDelta` = Σ over the bot's own marbles of
  `advancement(after) − advancement(before)`. Captured opponents are **not** in
  this sum (it is own-marbles only); their setback is the `CAPTURE` term.
- `opponentsCapturedThisMove` = count of opponent marbles whose position became
  `home` as a result of the move. Captures are **track-only** in the engine, so
  this is well defined.
- `ownMarblesEnteringFinish` = count of the bot's marbles whose position went
  from `track`/`home` to `finish` this move (rewards the act of parking, on top
  of the advancement jump).
- `exitUrgency` = the number of the bot's marbles still in `home` **before** the
  move (only non-zero for `exit` moves). This encodes "bring a marble out of the
  nest **when few marbles are in play**": more marbles stuck at home ⇒ a higher
  reward for getting one out.
- `exposureAfter` = Σ over the bot's own **track** marbles that are **not on the
  bot's own start square** (a marble on its start is protected and cannot be
  captured; home and finish marbles are off the track) of the **strongest
  threat** against that marble in the resulting state. A threat is an opponent
  marble within `[1..13]` cells **behind** (reachable by some forward card, max
  King = 13) or within `[1..4]` cells **ahead** (the backward-4). The weight
  grows as the threat gets closer (closer = worse); default formula:
  `14 − distanceBehind` for a behind-threat and `5 − distanceAhead` for an
  ahead-threat, so an adjacent opponent (distance 1) contributes the most. Per
  marble, only the single strongest threat is counted. Path-clearance is **ignored** — a deliberate
  heuristic approximation, honest about the fact that opponents' hands are hidden.

### 5.3 Weights

Weights live in an **exported `WEIGHTS` constant** (a named object), so tests pin
the intended behaviour and the values are trivial to tune. The **ordering is the
contract**, reflecting the terminal spec's tiers **+++ > ++ > + and − as a
counterweight**:

```
FINISH (parking, +++)  >  CAPTURE (++)  >  EXIT (+, scaled by urgency)  >  PROGRESS (per cell)
EXPOSURE (−) sized so a clearly dangerous landing outweighs a small advance
```

Starting defaults (to be refined against the comparative tests):
`PROGRESS = 1`, `FINISH = 60`, `CAPTURE = 50`, `EXIT = 5` (× urgency),
`EXPOSURE = 3` (× threat closeness). The exact constants may move during
implementation; the tests assert the **orderings**, not the raw numbers.

## 6. Selection & edge cases

`pickMove`:
1. `moveList = getLegalMoves(state, state.currentPlayer)`.
2. Score every move with `scoreMove`.
3. Take the maximum score; collect **all** moves tied at that maximum (exact
   integer equality).
4. Return one of the tied moves via `pickRandomMove(tiedList, random)`.

Edge cases:
- **Empty move list** — `pickMove` throws a clear error if asked to choose with
  no legal moves (defensive). In **normal cadence this never happens**: every
  active hand stays at five because `applyMove` draws one replacement card in the
  same step it plays one (continuous draw). So at the start of every turn the
  current player holds five cards, and `getLegalMoves` returns at least a
  `discard` (`getLegalMoves` returns `[]` only for a genuinely empty hand). The
  empty case is therefore reachable only for a **non-normal** state — e.g. a
  deserialized mid-round game with uneven hands — and a robust game loop may
  guard against it by skipping such a player (advance `nextPlayer`) rather than
  calling `pickMove`. The self-play integration test asserts this
  invariant directly (`getLegalMoves(...).length > 0` on every turn), and the
  defensive throw is unit-tested in `bot.test.ts`.
- **Forced discards** — when the hand is non-empty but nothing else is playable,
  `getLegalMoves` offers `discard` moves; they all score ≈ 0 (no progress, no
  capture, no exposure change on already-safe boards), so the random tie-break
  picks among them. (Smart discard is deferred, §7.)

## 7. Deferred / future work

- **"Hard" bot** — multi-turn lookahead (minimax / expectimax over the hidden
  deck). Would reuse `getLegalMoves`/`applyMove` and a state-evaluation variant.
- **Smart discard** — prefer dumping filler over 7 / Jack / Ace / King.
- **Path-clearance in exposure** — check whether an opponent's capturing path is
  actually clear (blocked by protected start squares), rather than pure proximity.
- **Opponent-hand modelling** — reason about which captures are actually
  reachable given the cards opponents could hold.

## 8. Testing strategy

Tests live in `tests/ai/`, reusing the shared helpers in `tests/support.ts`
(`place`, `setHand`, `findMarble`, `card`).

- **`score.test.ts`** (the heuristic):
  - advancement ordering: `home < track < finish`, and a deeper finish slot
    scores above a shallower one;
  - a capturing move scores higher than an otherwise-equivalent non-capturing
    move;
  - entering the finish scores higher than staying on the ring for the same
    displacement;
  - a move that ends with an own marble exposed scores below a move that ends
    safe;
  - an `exit` is rewarded, and more so when more marbles are still at home;
  - a `discard` scores ≈ 0.
- **`bot.test.ts`** (the selector):
  - `pickMove` returns the maximum-scoring move;
  - with several moves tied at the top, the random tie-break selects among them
    deterministically under a **stub RNG**;
  - an empty move list makes `pickMove` throw;
  - `pickRandomMove` honours the injected RNG.

UI-level integration (bot-vs-bot self-play) is exercised later, when the game
loop exists; the terminal spec already notes a robustness check that plays many
moves without throwing.

# Tock Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, headless Tock game engine — data model, board geometry, cards, legal-move generation and move application — fully unit-tested, with no terminal/UI code.

**Architecture:** A single isomorphic module `src/engine/` with zero Node/DOM dependencies. State is plain JSON-serializable data; `applyMove` returns a new state and never mutates. All rules are reachable through one public API (`src/engine/index.ts`): `createGame`, `getLegalMoves`, `applyMove`. Later plans (AI, Ink UI) consume this API unchanged.

**Tech Stack:** TypeScript, Vitest (tests), pnpm (package manager). No React/Ink in this plan.

## Global Constraints

Copied verbatim from the spec (`docs/superpowers/specs/2026-07-15-tock-terminal-design.md`) and `CLAUDE.md`. Every task's requirements implicitly include these.

- **Isomorphic engine:** `src/engine/` is pure TypeScript, **zero Node dependencies** (no `fs`, `process`, etc.). Must run unchanged in a browser and on a server.
- **JSON-serializable state:** `GameState` is plain data only — no classes with methods, no functions stored in state.
- **Immutability:** `applyMove(state, move)` returns a *new* state; it never mutates its input.
- **Single public API:** the engine is consumed only through `src/engine/index.ts`.
- **Code style:** All code and comments in **English**. **No semicolons, no trailing commas.** No `function` keyword — use `const` arrow functions. **No non-null assertions (`!`) in production code — only unit tests may use `!`;** elsewhere use a fallback (`list[i] ?? fallback`), a find-or-throw helper, or a tighter type (enum / `Record<Key, V>` / tuple / discriminated union). Variables camelCase, **no single-letter names** (`marble`, not `m`; `player`, not `p`), **no plural identifiers** (`moveList`, not `moves`). Components PascalCase, hooks `useX`, handlers `handleX` (UI plan only).
- **Board:** ring of `ringSize = 48` cells, `playerCount = 4`, `quadrantSize = 12`, `finishSize = 4`. `startCell(player) = player * 12`. Lane mouth is at `startCell(player) - 1`; a marble enters its lane whenever its path crosses that mouth **in either direction** (no "has looped" flag). Full model: spec §5.
- **Move contract (spec §6.2):** `exit`, `move`, `split7`, `swap`, `discard`. When several legal outcomes exist for one displacement (enter the lane *or* stay on the ring), the generator emits **one distinct `Move` per outcome**. `getLegalMoves` enumerates *all* combinations, including every valid 7-split partition.
- **Rules (spec §7):** land exactly on an opponent → sends it home; cannot land on your own marble; passing over is allowed *except* a marble protected on its own start cell (cannot be passed, captured, or swapped). Lane entry is the player's choice, exact-count only (no overshoot, no jumping your own parked marbles). Split 7 must total exactly 7. Jack swaps one own ring-marble with one opponent ring-marble. First player with all 4 marbles in their lane wins.

---

### Task 1: Project scaffolding + core types

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/engine/types.ts`
- Test: `tests/engine/types.test.ts`

**Interfaces:**
- Produces: all shared types — `PlayerId`, `Color`, `MarbleId`, `Position`, `Rank`, `Suit`, `Card`, `Marble`, `Move`, `Player`, `GameState`. Every later task imports from `src/engine/types.ts`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tock",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts']
  }
})
```

- [ ] **Step 4: Create `src/engine/types.ts`**

```ts
export type PlayerId = 0 | 1 | 2 | 3
export type Color = 'red' | 'green' | 'yellow' | 'blue'
export type MarbleId = string

export type Position =
  | { zone: 'home' }
  | { zone: 'track', index: number }
  | { zone: 'finish', index: number }

export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'
export type Card = { rank: Rank, suit: Suit }

export type Marble = { id: MarbleId, owner: PlayerId, position: Position }

export type Move =
  | { type: 'exit', card: Card, marbleId: MarbleId }
  | { type: 'move', card: Card, marbleId: MarbleId, steps: number, enterLane?: boolean }
  | { type: 'split7', card: Card, partList: { marbleId: MarbleId, steps: number, enterLane?: boolean }[] }
  | { type: 'swap', card: Card, marbleId: MarbleId, targetMarbleId: MarbleId }
  | { type: 'discard', card: Card }

export type PlayerKind = 'human' | 'bot' | 'inactive'

export type Player = {
  id: PlayerId
  color: Color
  kind: PlayerKind
  hand: Card[]
}

export type GameState = {
  playerList: Player[]
  marbleList: Marble[]
  drawPile: Card[]
  discardPile: Card[]
  currentPlayer: PlayerId
  winner: PlayerId | null
}
```

> Note: the `Move` union already carries `enterLane?` (Tasks 7–8) and the split-part shape (Task 8). They are defined up front so the type never churns; the logic that uses them is added in the later tasks.

- [ ] **Step 5: Write the type smoke test `tests/engine/types.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import type { Position, Move, Card } from '../../src/engine/types'

describe('core types', () => {
  it('constructs a track position', () => {
    const position: Position = { zone: 'track', index: 5 }
    expect(position.index).toBe(5)
  })

  it('constructs a discard move', () => {
    const playedCard: Card = { rank: 'A', suit: 'hearts' }
    const move: Move = { type: 'discard', card: playedCard }
    expect(move.type).toBe('discard')
  })
})
```

- [ ] **Step 6: Install and verify the toolchain**

Run: `pnpm install`
Then: `pnpm test tests/engine/types.test.ts`
Expected: 2 tests PASS.
Then: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src/engine/types.ts tests/engine/types.test.ts pnpm-lock.yaml
git commit -m "feat(engine): scaffold project and core types"
```

---

### Task 2: Board geometry

**Files:**
- Create: `src/engine/board.ts`
- Test: `tests/engine/board.test.ts`

**Interfaces:**
- Consumes: `PlayerId`, `Position` from `types.ts`.
- Produces:
  - `ringSize: 48`, `quadrantSize: 12`, `playerCount: 4`, `finishSize: 4` (constants)
  - `startCell(player: PlayerId): number`
  - `laneMouth(player: PlayerId): number`
  - `type RingMove = { ring: { zone: 'track', index: number }, lane: { zone: 'finish', index: number } | null }`
  - `ringDestinations(player, fromIndex, steps): RingMove` — geometric landings for a marble on the ring, ignoring occupancy. `ring` (always present) is the stay-on-ring landing; `lane` is the finish landing when the path crosses the mouth with an exact count, else `null`. Returning a struct (not an array) means callers never index/`find` with a `!`.

- [ ] **Step 1: Write the failing test `tests/engine/board.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { startCell, laneMouth, ringDestinations } from '../../src/engine/board'

describe('board geometry', () => {
  it('places start cells one quadrant apart', () => {
    expect(startCell(0)).toBe(0)
    expect(startCell(1)).toBe(12)
    expect(startCell(3)).toBe(36)
  })

  it('places the lane mouth just behind the start cell', () => {
    expect(laneMouth(0)).toBe(47)
    expect(laneMouth(1)).toBe(11)
  })

  it('moves forward on the ring without reaching the mouth', () => {
    const reach = ringDestinations(0, 5, 3)
    expect(reach.ring).toEqual({ zone: 'track', index: 8 })
    expect(reach.lane).toBeNull()
  })

  it('wraps forward around the ring', () => {
    expect(ringDestinations(1, 46, 5).ring).toEqual({ zone: 'track', index: 3 })
  })

  it('offers a lane landing when a forward path crosses the mouth', () => {
    // player 0, mouth at 47. From 45 forward 5: crosses 47 at step 2,
    // remaining 3 -> finish index 2. Ring-stay lands on 2.
    const reach = ringDestinations(0, 45, 5)
    expect(reach.ring).toEqual({ zone: 'track', index: 2 })
    expect(reach.lane).toEqual({ zone: 'finish', index: 2 })
  })

  it('enters the lane on a backward 4 from the start cell (the 4-trick)', () => {
    // player 0 on its start (0), backward 4: crosses mouth 47 after 1 step,
    // remaining 3 -> finish index 2. Ring-stay lands on 44.
    const reach = ringDestinations(0, 0, -4)
    expect(reach.ring).toEqual({ zone: 'track', index: 44 })
    expect(reach.lane).toEqual({ zone: 'finish', index: 2 })
  })

  it('rejects overshooting the lane', () => {
    // player 0 from 45 forward 8 would be finish index 5 -> no lane landing
    expect(ringDestinations(0, 45, 8).lane).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/engine/board.test.ts`
Expected: FAIL — `board.ts` does not exist / imports undefined.

- [ ] **Step 3: Create `src/engine/board.ts`**

```ts
import type { PlayerId } from './types'

export const ringSize = 48
export const playerCount = 4
export const quadrantSize = ringSize / playerCount // 12
export const finishSize = 4

export const startCell = (player: PlayerId): number => player * quadrantSize

export const laneMouth = (player: PlayerId): number =>
  (startCell(player) - 1 + ringSize) % ringSize

export type RingMove = {
  ring: { zone: 'track', index: number }
  lane: { zone: 'finish', index: number } | null
}

// Geometric landings for a marble of `player` currently on the ring at
// `fromIndex`, moving `steps` (>0 forward, <0 backward). Occupancy is ignored
// here — legality (captures, own-marble, protection) is applied in moves.ts.
export const ringDestinations = (player: PlayerId, fromIndex: number, steps: number): RingMove => {
  const direction = steps >= 0 ? 1 : -1
  const distance = Math.abs(steps)

  const ringIndex = (((fromIndex + direction * distance) % ringSize) + ringSize) % ringSize
  const ring = { zone: 'track', index: ringIndex } as const

  const mouth = laneMouth(player)
  const stepsToMouth = direction === 1
    ? (mouth - fromIndex + ringSize) % ringSize
    : (fromIndex - mouth + ringSize) % ringSize
  const laneIndex = distance - stepsToMouth - 1
  const lane = laneIndex >= 0 && laneIndex < finishSize
    ? ({ zone: 'finish', index: laneIndex } as const)
    : null

  return { ring, lane }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/engine/board.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/board.ts tests/engine/board.test.ts
git commit -m "feat(engine): board geometry and ring/lane movement"
```

---

### Task 3: Cards

**Files:**
- Create: `src/engine/cards.ts`
- Test: `tests/engine/cards.test.ts`

**Interfaces:**
- Consumes: `Card`, `Rank`, `Suit` from `types.ts`.
- Produces:
  - `ranks: Rank[]`, `suits: Suit[]`
  - `moveSteps(rank: Rank): number | null` — linear step count (`A`=1, `K`=13, `Q`=12, `4`=-4, numbers = value); `null` for `J` and `7` (handled specially elsewhere).
  - `canExit(rank: Rank): boolean` — true for `A` and `K`.
  - `createDeck(): Card[]` — 52 cards.
  - `shuffle<Item>(list: Item[], random?: () => number): Item[]` — returns a new shuffled array; `random` injectable for deterministic tests (default `Math.random`).

- [ ] **Step 1: Write the failing test `tests/engine/cards.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createDeck, moveSteps, canExit, shuffle } from '../../src/engine/cards'

describe('cards', () => {
  it('builds a 52-card deck with no duplicates', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)
    const keyList = deck.map(deckCard => `${deckCard.rank}-${deckCard.suit}`)
    expect(new Set(keyList).size).toBe(52)
  })

  it('maps ranks to step counts', () => {
    expect(moveSteps('A')).toBe(1)
    expect(moveSteps('K')).toBe(13)
    expect(moveSteps('Q')).toBe(12)
    expect(moveSteps('4')).toBe(-4)
    expect(moveSteps('10')).toBe(10)
    expect(moveSteps('J')).toBeNull()
    expect(moveSteps('7')).toBeNull()
  })

  it('knows which ranks can exit a marble', () => {
    expect(canExit('A')).toBe(true)
    expect(canExit('K')).toBe(true)
    expect(canExit('Q')).toBe(false)
  })

  it('shuffles into a new array with an injected rng', () => {
    const rng = () => 0
    const deck = createDeck()
    const shuffled = shuffle(deck, rng)
    expect(shuffled).toHaveLength(52)
    expect(shuffled).not.toBe(deck) // new array, input untouched
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/engine/cards.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `src/engine/cards.ts`**

```ts
import type { Card, Rank, Suit } from './types'

export const ranks: Rank[] =
  ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

export const moveSteps = (rank: Rank): number | null => {
  switch (rank) {
    case 'A': return 1
    case 'K': return 13
    case 'Q': return 12
    case '4': return -4
    case 'J': return null
    case '7': return null
    default: return Number(rank)
  }
}

export const canExit = (rank: Rank): boolean => rank === 'A' || rank === 'K'

export const createDeck = (): Card[] => {
  const deck: Card[] = []
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

// Fisher-Yates by removal: pick a random remaining element each round. Avoids
// index-swap temporaries (and the non-null assertions they would need).
export const shuffle = <Item>(list: Item[], random: () => number = Math.random): Item[] => {
  const source = [...list]
  const result: Item[] = []
  while (source.length > 0) {
    const index = Math.floor(random() * source.length)
    const [picked] = source.splice(index, 1)
    if (picked !== undefined) result.push(picked)
  }
  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/engine/cards.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cards.ts tests/engine/cards.test.ts
git commit -m "feat(engine): card deck, values and shuffle"
```

---

### Task 4: Game state creation + test support helpers

**Files:**
- Create: `src/engine/state.ts`
- Create: `tests/support.ts`
- Test: `tests/engine/state.test.ts`

**Interfaces:**
- Consumes: `board.ts`, `cards.ts`, all types.
- Produces:
  - `handSize = 5` (constant)
  - `colorOf(player: PlayerId): Color` — backed by a `Record<PlayerId, Color>` (`0:red, 1:green, 2:yellow, 3:blue`), so no undefined and no fallback needed.
  - `marbleId(player: PlayerId, index: number): MarbleId` → `` `p${player}m${index}` ``
  - `createGame(kindList: PlayerKind[], random?: () => number): GameState` — `kindList` is indexed by seat (0..3); a missing or `'inactive'` seat gets no marbles and no hand. Active seats get 4 marbles in `home` and a dealt hand of `handSize`. `currentPlayer` is the first active seat (fallback `0`); `winner` is `null`.
  - From `tests/support.ts`: `place(state, marbleId, position): GameState`, `setHand(state, player, cardList): GameState`, `findMarble(state, marbleId): Marble`, `card(rank, suit?): Card`.

- [ ] **Step 1: Write the failing test `tests/engine/state.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'

describe('createGame', () => {
  it('creates 4 marbles in home per active player and none for inactive seats', () => {
    const state = createGame(['human', 'bot', 'bot', 'inactive'])
    expect(state.marbleList.filter(marble => marble.owner === 0)).toHaveLength(4)
    expect(state.marbleList.filter(marble => marble.owner === 3)).toHaveLength(0)
    expect(state.marbleList.every(marble => marble.position.zone === 'home')).toBe(true)
  })

  it('deals a hand of 5 to each active player only', () => {
    const state = createGame(['human', 'bot', 'inactive', 'inactive'])
    expect(state.playerList[0]!.hand).toHaveLength(5)
    expect(state.playerList[1]!.hand).toHaveLength(5)
    expect(state.playerList[2]!.hand).toHaveLength(0)
  })

  it('starts on the first active player with no winner', () => {
    const state = createGame(['inactive', 'bot', 'bot', 'human'])
    expect(state.currentPlayer).toBe(1)
    expect(state.winner).toBeNull()
  })

  it('leaves the draw pile with the undealt remainder', () => {
    const state = createGame(['human', 'bot', 'bot', 'bot'])
    // 52 - (4 players * 5 cards) = 32
    expect(state.drawPile).toHaveLength(32)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/engine/state.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `src/engine/state.ts`**

```ts
import type { Card, Color, GameState, Marble, MarbleId, Player, PlayerId, PlayerKind } from './types'
import { createDeck, shuffle } from './cards'

export const handSize = 5

const playerOrder: PlayerId[] = [0, 1, 2, 3]
const colorByPlayer: Record<PlayerId, Color> = { 0: 'red', 1: 'green', 2: 'yellow', 3: 'blue' }

export const colorOf = (player: PlayerId): Color => colorByPlayer[player]

export const marbleId = (player: PlayerId, index: number): MarbleId => `p${player}m${index}`

export const createGame = (
  kindList: PlayerKind[],
  random: () => number = Math.random
): GameState => {
  const drawPile = shuffle(createDeck(), random)
  const marbleList: Marble[] = []
  const playerList: Player[] = []

  for (const seat of playerOrder) {
    const kind = kindList[seat] ?? 'inactive'
    const hand = kind === 'inactive' ? [] : drawPile.splice(0, handSize)
    playerList.push({ id: seat, color: colorByPlayer[seat], kind, hand })
    if (kind !== 'inactive') {
      for (let index = 0; index < 4; index++) {
        marbleList.push({ id: marbleId(seat, index), owner: seat, position: { zone: 'home' } })
      }
    }
  }

  const firstActive = playerList.find(player => player.kind !== 'inactive')
  return {
    playerList,
    marbleList,
    drawPile,
    discardPile: [],
    currentPlayer: firstActive?.id ?? 0,
    winner: null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/engine/state.test.ts`
Expected: all PASS.

- [ ] **Step 5: Create `tests/support.ts`**

```ts
import type { Card, GameState, Marble, MarbleId, PlayerId, Position, Rank, Suit } from '../src/engine/types'

export const card = (rank: Rank, suit: Suit = 'hearts'): Card => ({ rank, suit })

export const findMarble = (state: GameState, id: MarbleId): Marble => {
  const marble = state.marbleList.find(candidate => candidate.id === id)
  if (!marble) throw new Error(`marble ${id} not found`)
  return marble
}

export const place = (state: GameState, id: MarbleId, position: Position): GameState => ({
  ...state,
  marbleList: state.marbleList.map(marble => (marble.id === id ? { ...marble, position } : marble))
})

export const setHand = (state: GameState, player: PlayerId, cardList: Card[]): GameState => ({
  ...state,
  playerList: state.playerList.map(entry => (entry.id === player ? { ...entry, hand: cardList } : entry))
})
```

- [ ] **Step 6: Commit**

```bash
git add src/engine/state.ts tests/support.ts tests/engine/state.test.ts
git commit -m "feat(engine): game state creation and test helpers"
```

---

### Task 5: Apply moves — exit, move, captures, turn advance

**Files:**
- Create: `src/engine/moves.ts`
- Test: `tests/engine/apply-move.test.ts`

**Interfaces:**
- Consumes: `board.ts` (`startCell`, `ringDestinations`), types, `state.ts`.
- Produces:
  - `nextPlayer(state: GameState): PlayerId` — the next **active** seat after `currentPlayer` (skips inactive).
  - `applyMove(state: GameState, move: Move): GameState` — pure. Handles `exit`, `move`, `discard` in this task (`split7`, `swap` added later). Relocates the moving marble; any opponent marble on the destination **ring** cell is sent to `home` (a capture). Removes the played card from the current player's hand into `discardPile`, then advances `currentPlayer` to `nextPlayer`.

Note: this task supports `move` for a **track**-origin marble landing on the ring. Finish landings and finish-origin movement arrive in Task 7.

- [ ] **Step 1: Write the failing test `tests/engine/apply-move.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { applyMove, nextPlayer } from '../../src/engine/moves'
import { place, setHand, findMarble, card } from '../../tests/support'

const fourPlayers = () => createGame(['human', 'bot', 'bot', 'bot'], () => 0)

describe('applyMove: exit', () => {
  it('moves a home marble onto its start cell', () => {
    let state = fourPlayers()
    state = setHand(state, 0, [card('A')])
    const next = applyMove(state, { type: 'exit', card: card('A'), marbleId: 'p0m0' })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'track', index: 0 })
  })

  it('does not mutate the input state', () => {
    let state = fourPlayers()
    state = setHand(state, 0, [card('A')])
    const before = findMarble(state, 'p0m0').position
    applyMove(state, { type: 'exit', card: card('A'), marbleId: 'p0m0' })
    expect(findMarble(state, 'p0m0').position).toEqual(before)
    expect(before).toEqual({ zone: 'home' })
  })
})

describe('applyMove: move + capture', () => {
  it('advances a marble along the ring', () => {
    let state = fourPlayers()
    state = setHand(state, 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 3 })
    const next = applyMove(state, { type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5 })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'track', index: 8 })
  })

  it('sends an opponent marble home when landing on it', () => {
    let state = fourPlayers()
    state = setHand(state, 0, [card('3')])
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p1m0', { zone: 'track', index: 8 })
    const next = applyMove(state, { type: 'move', card: card('3'), marbleId: 'p0m0', steps: 3 })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'track', index: 8 })
    expect(findMarble(next, 'p1m0').position).toEqual({ zone: 'home' })
  })
})

describe('applyMove: bookkeeping', () => {
  it('discards the played card and advances the turn', () => {
    let state = fourPlayers()
    state = setHand(state, 0, [card('A'), card('K')])
    const next = applyMove(state, { type: 'exit', card: card('A'), marbleId: 'p0m0' })
    expect(next.playerList[0]!.hand).toEqual([card('K')])
    expect(next.discardPile).toContainEqual(card('A'))
    expect(next.currentPlayer).toBe(1)
  })

  it('nextPlayer skips inactive seats', () => {
    const state = createGame(['human', 'inactive', 'bot', 'inactive'], () => 0)
    expect(nextPlayer({ ...state, currentPlayer: 0 })).toBe(2)
    expect(nextPlayer({ ...state, currentPlayer: 2 })).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/engine/apply-move.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `src/engine/moves.ts`**

```ts
import type { Card, GameState, Marble, MarbleId, Move, Player, PlayerId, Position } from './types'
import { ringDestinations, startCell } from './board'

const playerById = (state: GameState, id: PlayerId): Player => {
  const found = state.playerList.find(player => player.id === id)
  if (!found) throw new Error(`player ${id} not found`)
  return found
}

const findMarble = (state: GameState, id: MarbleId): Marble => {
  const found = state.marbleList.find(marble => marble.id === id)
  if (!found) throw new Error(`marble ${id} not found`)
  return found
}

const removeCard = (hand: Card[], target: Card): Card[] => {
  const index = hand.findIndex(handCard => handCard.rank === target.rank && handCard.suit === target.suit)
  if (index < 0) return hand
  return [...hand.slice(0, index), ...hand.slice(index + 1)]
}

const samePosition = (left: Position, right: Position): boolean => {
  if (left.zone !== right.zone) return false
  if (left.zone === 'home' || right.zone === 'home') return true
  return left.index === right.index
}

const activeSeatList = (state: GameState): PlayerId[] =>
  state.playerList.filter(player => player.kind !== 'inactive').map(player => player.id)

export const nextPlayer = (state: GameState): PlayerId => {
  const seatList = activeSeatList(state)
  const currentIndex = seatList.indexOf(state.currentPlayer)
  return seatList[(currentIndex + 1) % seatList.length] ?? state.currentPlayer
}

// Relocate one marble to `to`, sending any opponent already on that ring cell
// back home. Finish cells are private per owner, so captures apply to `track` only.
const relocate = (marbleList: Marble[], mover: Marble, to: Position): Marble[] =>
  marbleList.map(marble => {
    if (marble.id === mover.id) return { ...marble, position: to }
    if (marble.owner !== mover.owner && to.zone === 'track' && samePosition(marble.position, to)) {
      return { ...marble, position: { zone: 'home' } }
    }
    return marble
  })

const withTurnDone = (state: GameState, actor: Player, move: Move, marbleList: Marble[]): GameState => ({
  ...state,
  marbleList,
  playerList: state.playerList.map(player =>
    player.id === actor.id ? { ...player, hand: removeCard(player.hand, move.card) } : player
  ),
  discardPile: [...state.discardPile, move.card],
  currentPlayer: nextPlayer({ ...state, marbleList })
})

// Task 5 supports marbles moving on the ring (track origin). Lane landings and
// finish-origin movement are added in Task 7.
const resolveTrackMove = (mover: Marble, steps: number): Position => {
  if (mover.position.zone !== 'track') {
    throw new Error('resolveTrackMove expects a track origin')
  }
  return ringDestinations(mover.owner, mover.position.index, steps).ring
}

export const applyMove = (state: GameState, move: Move): GameState => {
  const actor = playerById(state, state.currentPlayer)

  if (move.type === 'discard') {
    return withTurnDone(state, actor, move, state.marbleList)
  }

  if (move.type === 'exit') {
    const mover = findMarble(state, move.marbleId)
    const to: Position = { zone: 'track', index: startCell(actor.id) }
    return withTurnDone(state, actor, move, relocate(state.marbleList, mover, to))
  }

  if (move.type === 'move') {
    const mover = findMarble(state, move.marbleId)
    const to = resolveTrackMove(mover, move.steps)
    return withTurnDone(state, actor, move, relocate(state.marbleList, mover, to))
  }

  throw new Error(`move type ${move.type} not supported yet`)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/engine/apply-move.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/moves.ts tests/engine/apply-move.test.ts
git commit -m "feat(engine): applyMove for exit/move/discard with captures"
```

---

### Task 6: Legal-move generation — exits and linear moves

**Files:**
- Modify: `src/engine/moves.ts`
- Test: `tests/engine/legal-moves.test.ts`

**Interfaces:**
- Produces: `getLegalMoves(state: GameState, player: PlayerId): Move[]` — for this task it enumerates `exit` moves (ranks that can exit, when a home marble exists and the start cell is not blocked by an own marble) and linear `move` moves for ranks with a non-null `moveSteps` **except** `4` (backward — added in Task 7 with lane handling), i.e. `A, 2, 3, 5, 6, 8, 9, 10, Q, K`. Landing on an own marble is rejected; landing on an opponent is allowed (capture). Finish landings and blocking-by-protection arrive in later tasks. Duplicate cards in hand produce duplicate moves (correct — each is playable).

- [ ] **Step 1: Write the failing test `tests/engine/legal-moves.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { getLegalMoves } from '../../src/engine/moves'
import { place, setHand, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], () => 0)

describe('getLegalMoves: exits', () => {
  it('offers an exit for each home marble on an Ace', () => {
    const state = setHand(game(), 0, [card('A')])
    const moveList = getLegalMoves(state, 0)
    expect(moveList.filter(move => move.type === 'exit')).toHaveLength(4)
  })

  it('does not offer an exit when the start cell holds an own marble', () => {
    let state = setHand(game(), 0, [card('K')])
    state = place(state, 'p0m0', { zone: 'track', index: 0 }) // start cell blocked
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'exit')).toBe(false)
  })
})

describe('getLegalMoves: linear moves', () => {
  it('offers a forward move for a marble on the ring', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    const moveList = getLegalMoves(state, 0)
    expect(moveList).toContainEqual({ type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5 })
  })

  it('rejects a move that lands on an own marble', () => {
    let state = setHand(game(), 0, [card('2')])
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    state = place(state, 'p0m1', { zone: 'track', index: 12 })
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'move' && move.marbleId === 'p0m0')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/engine/legal-moves.test.ts`
Expected: FAIL — `getLegalMoves` not exported.

- [ ] **Step 3: Add generation to `src/engine/moves.ts`**

Merge these into the existing imports:

```ts
import { canExit, moveSteps } from './cards'
```

Append to `src/engine/moves.ts`:

```ts
const ownMarbleList = (state: GameState, player: PlayerId): Marble[] =>
  state.marbleList.filter(marble => marble.owner === player)

// Is landing on `to` legal for `mover`? Only ring cells can be contested — a
// finish cell is private to its owner (own-lane blocking is handled by
// finishPathClear). An own marble blocks; an opponent is a capture. Protection
// is layered on in Task 10.
const canLandOn = (state: GameState, mover: Marble, to: Position): boolean => {
  if (to.zone !== 'track') return true
  const occupant = state.marbleList.find(
    marble => marble.position.zone === 'track' && marble.position.index === to.index
  )
  if (!occupant) return true
  return occupant.owner !== mover.owner
}

export const getLegalMoves = (state: GameState, player: PlayerId): Move[] => {
  const hand = playerById(state, player).hand
  const marbleList = ownMarbleList(state, player)
  const result: Move[] = []

  for (const playedCard of hand) {
    const { rank } = playedCard

    if (canExit(rank)) {
      const startIndex = startCell(player)
      const startBlockedByOwn = marbleList.some(
        marble => marble.position.zone === 'track' && marble.position.index === startIndex
      )
      if (!startBlockedByOwn) {
        for (const marble of marbleList) {
          if (marble.position.zone === 'home') {
            result.push({ type: 'exit', card: playedCard, marbleId: marble.id })
          }
        }
      }
    }

    const steps = moveSteps(rank)
    if (steps !== null && rank !== '4') {
      for (const marble of marbleList) {
        if (marble.position.zone !== 'track') continue
        const reach = ringDestinations(player, marble.position.index, steps)
        if (canLandOn(state, marble, reach.ring)) {
          result.push({ type: 'move', card: playedCard, marbleId: marble.id, steps })
        }
      }
    }
  }

  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/engine/legal-moves.test.ts`
Then: `pnpm test`
Expected: all PASS (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/engine/moves.ts tests/engine/legal-moves.test.ts
git commit -m "feat(engine): legal-move generation for exits and linear moves"
```

---

### Task 7: Lane entry — choice, exact count, backward 4, finish origin, win

**Files:**
- Modify: `src/engine/moves.ts`
- Test: `tests/engine/lane.test.ts`

**Interfaces:**
- The `move` variant already carries `enterLane?: boolean` (defined in Task 1). Entering the lane is a **choice**: a displacement that offers both a ring landing and a lane landing emits **two** `move` moves — one plain, one with `enterLane: true`.
- Produces:
  - `getLegalMoves` now also: emits the `4` card (backward); for a track-origin displacement whose geometry offers a lane landing, emits a second move with `enterLane: true`; supports finish-origin marbles moving deeper into the lane (forward only, exact count, no jumping own parked marbles).
  - `applyMove` resolves the destination via a shared `resolveDestination`, and sets `winner` when a player has all 4 marbles in `finish`.

- [ ] **Step 1: Write the failing test `tests/engine/lane.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { getLegalMoves, applyMove } from '../../src/engine/moves'
import { place, setHand, findMarble, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], () => 0)

describe('lane entry choice', () => {
  it('offers both stay-on-ring and enter-lane for a crossing displacement', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 45 }) // player 0 mouth = 47
    const moveList = getLegalMoves(state, 0).filter(move => move.type === 'move' && move.marbleId === 'p0m0')
    expect(moveList).toContainEqual({ type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5 })
    expect(moveList).toContainEqual({ type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5, enterLane: true })
  })

  it('applies the enter-lane choice into the finish', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 45 })
    const next = applyMove(state, { type: 'move', card: card('5'), marbleId: 'p0m0', steps: 5, enterLane: true })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'finish', index: 2 })
  })

  it('enters the lane directly with the backward-4 trick', () => {
    let state = setHand(game(), 0, [card('4')])
    state = place(state, 'p0m0', { zone: 'track', index: 0 }) // on its start cell
    const moveList = getLegalMoves(state, 0)
    expect(moveList).toContainEqual({ type: 'move', card: card('4'), marbleId: 'p0m0', steps: -4, enterLane: true })
  })

  it('moves a marble deeper inside the finish with exact count', () => {
    let state = setHand(game(), 0, [card('2')])
    state = place(state, 'p0m0', { zone: 'finish', index: 0 })
    const next = applyMove(state, { type: 'move', card: card('2'), marbleId: 'p0m0', steps: 2 })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'finish', index: 2 })
  })

  it('rejects overshooting the last finish cell', () => {
    let state = setHand(game(), 0, [card('6')])
    state = place(state, 'p0m0', { zone: 'finish', index: 1 }) // 1 + 6 = 7 > 3
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'move' && move.marbleId === 'p0m0')).toBe(false)
  })

  it('declares a winner when all four marbles reach the finish', () => {
    // three marbles parked deepest-first (3,2,1); the last enters finish 0
    let state = setHand(game(), 0, [card('2')])
    state = place(state, 'p0m0', { zone: 'finish', index: 3 })
    state = place(state, 'p0m1', { zone: 'finish', index: 2 })
    state = place(state, 'p0m2', { zone: 'finish', index: 1 })
    state = place(state, 'p0m3', { zone: 'track', index: 46 }) // mouth 47: +2 enters finish 0
    const next = applyMove(state, { type: 'move', card: card('2'), marbleId: 'p0m3', steps: 2, enterLane: true })
    expect(findMarble(next, 'p0m3').position).toEqual({ zone: 'finish', index: 0 })
    expect(next.winner).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/engine/lane.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rework resolution in `moves.ts`**

Replace `resolveTrackMove` with a general resolver plus finish helpers:

```ts
// Resolve the destination for a 'move' given the mover's origin and the chosen
// outcome (enterLane). Returns null if the move is not geometrically legal.
const resolveDestination = (
  state: GameState,
  mover: Marble,
  steps: number,
  enterLane: boolean
): Position | null => {
  if (mover.position.zone === 'track') {
    const reach = ringDestinations(mover.owner, mover.position.index, steps)
    const wanted = enterLane ? reach.lane : reach.ring
    if (!wanted) return null
    if (wanted.zone === 'finish' && !finishPathClear(state, mover, wanted.index)) return null
    return canLandOn(state, mover, wanted) ? wanted : null
  }

  if (mover.position.zone === 'finish') {
    if (steps <= 0) return null // no backward movement inside the lane
    const target = mover.position.index + steps
    if (target >= 4) return null // exact count, no overshoot
    if (!finishPathClear(state, mover, target)) return null
    return { zone: 'finish', index: target }
  }

  return null // home marbles move only via 'exit'
}

// No own marble may sit on any finish cell strictly between the mover and
// `target`, nor on `target` itself (cannot jump over or land on a parked marble).
const finishPathClear = (state: GameState, mover: Marble, target: number): boolean => {
  const from = mover.position.zone === 'finish' ? mover.position.index : -1
  return !state.marbleList.some(
    marble => marble.owner === mover.owner &&
      marble.id !== mover.id &&
      marble.position.zone === 'finish' &&
      marble.position.index > from &&
      marble.position.index <= target
  )
}

const allInFinish = (state: GameState, player: PlayerId): boolean =>
  state.marbleList
    .filter(marble => marble.owner === player)
    .every(marble => marble.position.zone === 'finish')
```

Update `applyMove`'s `move` branch to use `resolveDestination` and set the winner:

```ts
  if (move.type === 'move') {
    const mover = findMarble(state, move.marbleId)
    const to = resolveDestination(state, mover, move.steps, move.enterLane ?? false)
    if (!to) throw new Error('illegal move passed to applyMove')
    const doneState = withTurnDone(state, actor, move, relocate(state.marbleList, mover, to))
    const winner = allInFinish(doneState, actor.id) ? actor.id : doneState.winner
    return { ...doneState, winner }
  }
```

Replace the linear-move block in `getLegalMoves` (the `if (steps !== null && rank !== '4')` block) with one that includes `4`, emits the enter-lane variant, and covers finish origins:

```ts
    if (steps !== null) {
      for (const marble of marbleList) {
        if (marble.position.zone === 'home') continue
        // enterLane only matters for a ring origin; a finish-origin move has one outcome
        const laneOptionList = marble.position.zone === 'track' ? [false, true] : [false]
        for (const enterLane of laneOptionList) {
          const to = resolveDestination(state, marble, steps, enterLane)
          if (!to) continue
          const move: Move = enterLane
            ? { type: 'move', card: playedCard, marbleId: marble.id, steps, enterLane: true }
            : { type: 'move', card: playedCard, marbleId: marble.id, steps }
          result.push(move)
        }
      }
    }
```

Rank `7` and `J` still have `moveSteps === null` and are handled in Tasks 8–9.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/engine/lane.test.ts`
Then: `pnpm test`
Expected: all PASS (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/engine/moves.ts tests/engine/lane.test.ts
git commit -m "feat(engine): lane entry choice, backward-4, finish moves and win"
```

---

### Task 8: Split 7

**Files:**
- Modify: `src/engine/moves.ts`
- Test: `tests/engine/split7.test.ts`

**Interfaces:**
- The `split7` variant already carries `partList: { marbleId, steps, enterLane? }[]` (defined in Task 1). For a `7` card, `getLegalMoves` emits `split7` moves. A split distributes exactly 7 steps across the player's own moveable marbles (each part ≥ 1). Every part must be individually legal, applied **in sequence** (an earlier part may capture and free a cell for a later one). Each legal distribution over the marbles in order produces one `split7` move (including the trivial single-marble part of 7). `applyMove` applies each part via the shared destination resolver, sequentially.

- [ ] **Step 1: Write the failing test `tests/engine/split7.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import type { Move } from '../../src/engine/types'
import { createGame } from '../../src/engine/state'
import { getLegalMoves, applyMove } from '../../src/engine/moves'
import { place, setHand, findMarble, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], () => 0)
const isSplit = (move: Move): move is Extract<Move, { type: 'split7' }> => move.type === 'split7'

describe('split 7', () => {
  it('offers a single-marble full 7', () => {
    let state = setHand(game(), 0, [card('7')])
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    const splitList = getLegalMoves(state, 0).filter(isSplit)
    expect(splitList).toContainEqual({
      type: 'split7', card: card('7'),
      partList: [{ marbleId: 'p0m0', steps: 7 }]
    })
  })

  it('offers a two-marble split totalling 7', () => {
    let state = setHand(game(), 0, [card('7')])
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    state = place(state, 'p0m1', { zone: 'track', index: 20 })
    const splitList = getLegalMoves(state, 0).filter(isSplit)
    const totalList = splitList.map(move => move.partList.reduce((sum, part) => sum + part.steps, 0))
    expect(totalList.every(total => total === 7)).toBe(true)
    expect(splitList.some(move => move.partList.length === 2)).toBe(true)
  })

  it('applies a split sequentially', () => {
    let state = setHand(game(), 0, [card('7')])
    state = place(state, 'p0m0', { zone: 'track', index: 10 })
    state = place(state, 'p0m1', { zone: 'track', index: 20 })
    const next = applyMove(state, {
      type: 'split7', card: card('7'),
      partList: [{ marbleId: 'p0m0', steps: 3 }, { marbleId: 'p0m1', steps: 4 }]
    })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'track', index: 13 })
    expect(findMarble(next, 'p0m1').position).toEqual({ zone: 'track', index: 24 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/engine/split7.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add split logic to `moves.ts`**

Append to `src/engine/moves.ts`:

```ts
type SplitPart = { marbleId: MarbleId, steps: number, enterLane?: boolean }

// Apply one part on a working state (reuses the single-move resolver).
const applyPart = (state: GameState, mover: Marble, part: SplitPart): GameState | null => {
  const to = resolveDestination(state, mover, part.steps, part.enterLane ?? false)
  if (!to) return null
  return { ...state, marbleList: relocate(state.marbleList, mover, to) }
}

// Enumerate every legal distribution of exactly 7 across own moveable marbles.
const enumerateSplits = (state: GameState, player: PlayerId): SplitPart[][] => {
  const moveable = ownMarbleList(state, player).filter(marble => marble.position.zone !== 'home')
  const result: SplitPart[][] = []

  const recurse = (working: GameState, index: number, remaining: number, chosen: SplitPart[]): void => {
    if (remaining === 0) {
      if (chosen.length > 0) result.push(chosen)
      return
    }
    if (index >= moveable.length) return
    const marble = moveable[index]
    if (!marble) return
    // Option A — skip this marble
    recurse(working, index + 1, remaining, chosen)
    // Option B — assign 1..remaining steps to this marble
    const current = findMarble(working, marble.id)
    const laneList = current.position.zone === 'track' ? [false, true] : [false]
    for (let steps = 1; steps <= remaining; steps++) {
      for (const enterLane of laneList) {
        const part: SplitPart = enterLane
          ? { marbleId: marble.id, steps, enterLane: true }
          : { marbleId: marble.id, steps }
        const advanced = applyPart(working, current, part)
        if (!advanced) continue
        recurse(advanced, index + 1, remaining - steps, [...chosen, part])
      }
    }
  }

  recurse(state, 0, 7, [])
  return result
}

export const applySplit = (state: GameState, actor: Player, move: Extract<Move, { type: 'split7' }>): GameState => {
  let working: GameState = state
  for (const part of move.partList) {
    const mover = findMarble(working, part.marbleId)
    const advanced = applyPart(working, mover, part)
    if (!advanced) throw new Error('illegal split part passed to applyMove')
    working = advanced
  }
  const doneState = withTurnDone(state, actor, move, working.marbleList)
  const winner = allInFinish(doneState, actor.id) ? actor.id : doneState.winner
  return { ...doneState, winner }
}
```

Add the `7` branch in `getLegalMoves` (inside the card loop, after the linear block):

```ts
    if (rank === '7') {
      for (const partList of enumerateSplits(state, player)) {
        result.push({ type: 'split7', card: playedCard, partList })
      }
    }
```

Add the `split7` branch in `applyMove` (before the final `throw`):

```ts
  if (move.type === 'split7') {
    return applySplit(state, actor, move)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/engine/split7.test.ts`
Then: `pnpm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/moves.ts tests/engine/split7.test.ts
git commit -m "feat(engine): split-7 enumeration and application"
```

---

### Task 9: Jack swap

**Files:**
- Modify: `src/engine/moves.ts`
- Test: `tests/engine/swap.test.ts`

**Interfaces:**
- Produces: for a `J` card, `getLegalMoves` emits `swap` moves pairing one own marble on the **ring** with one opponent marble on the **ring** (never home, never finish). `applyMove` exchanges the two marbles' positions. (Protection exclusion is added in Task 10.)

- [ ] **Step 1: Write the failing test `tests/engine/swap.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { getLegalMoves, applyMove } from '../../src/engine/moves'
import { place, setHand, findMarble, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], () => 0)

describe('jack swap', () => {
  it('offers a swap between own and opponent ring marbles', () => {
    let state = setHand(game(), 0, [card('J')])
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p1m0', { zone: 'track', index: 20 })
    const moveList = getLegalMoves(state, 0)
    expect(moveList).toContainEqual({ type: 'swap', card: card('J'), marbleId: 'p0m0', targetMarbleId: 'p1m0' })
  })

  it('does not swap with home or finish marbles', () => {
    let state = setHand(game(), 0, [card('J')])
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p1m0', { zone: 'finish', index: 0 })
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'swap')).toBe(false)
  })

  it('exchanges positions when applied', () => {
    let state = setHand(game(), 0, [card('J')])
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p1m0', { zone: 'track', index: 20 })
    const next = applyMove(state, { type: 'swap', card: card('J'), marbleId: 'p0m0', targetMarbleId: 'p1m0' })
    expect(findMarble(next, 'p0m0').position).toEqual({ zone: 'track', index: 20 })
    expect(findMarble(next, 'p1m0').position).toEqual({ zone: 'track', index: 5 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/engine/swap.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add swap logic to `moves.ts`**

Add the `J` branch in `getLegalMoves` (inside the card loop):

```ts
    if (rank === 'J') {
      const ownRingList = marbleList.filter(marble => marble.position.zone === 'track')
      const enemyRingList = state.marbleList.filter(
        marble => marble.owner !== player && marble.position.zone === 'track'
      )
      for (const own of ownRingList) {
        for (const enemy of enemyRingList) {
          result.push({ type: 'swap', card: playedCard, marbleId: own.id, targetMarbleId: enemy.id })
        }
      }
    }
```

Add the `swap` branch in `applyMove` (before the final `throw`):

```ts
  if (move.type === 'swap') {
    const own = findMarble(state, move.marbleId)
    const enemy = findMarble(state, move.targetMarbleId)
    const marbleList = state.marbleList.map(marble => {
      if (marble.id === own.id) return { ...marble, position: enemy.position }
      if (marble.id === enemy.id) return { ...marble, position: own.position }
      return marble
    })
    return withTurnDone(state, actor, move, marbleList)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/engine/swap.test.ts`
Then: `pnpm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/moves.ts tests/engine/swap.test.ts
git commit -m "feat(engine): jack swap generation and application"
```

---

### Task 10: Start-square protection

**Files:**
- Modify: `src/engine/moves.ts`
- Test: `tests/engine/protection.test.ts`

**Interfaces:**
- A marble on **its own start cell** is protected. Three effects, all added here:
  1. It cannot be **landed on** (capture rejected).
  2. It cannot be **passed over** — a path whose ring cells strictly between origin and destination include a protected cell is illegal.
  3. It cannot be **swapped** (excluded as a Jack target).
- Produces: `isProtected(marble): boolean`, `pathClear(state, mover, steps): boolean`, both integrated into `canLandOn`, `resolveDestination` (track origin), and the Jack target filter.

- [ ] **Step 1: Write the failing test `tests/engine/protection.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { getLegalMoves } from '../../src/engine/moves'
import { place, setHand, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], () => 0)

describe('start-square protection', () => {
  it('cannot land on an opponent protected on its start cell', () => {
    let state = setHand(game(), 0, [card('3')])
    state = place(state, 'p0m0', { zone: 'track', index: 9 })
    state = place(state, 'p1m0', { zone: 'track', index: 12 }) // player 1 start = 12
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'move' && move.marbleId === 'p0m0')).toBe(false)
  })

  it('cannot pass over a protected marble', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 9 })
    state = place(state, 'p1m0', { zone: 'track', index: 12 }) // sits between 9 and 14
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'move' && move.marbleId === 'p0m0')).toBe(false)
  })

  it('is not protected once off its own start cell', () => {
    let state = setHand(game(), 0, [card('5')])
    state = place(state, 'p0m0', { zone: 'track', index: 9 })
    state = place(state, 'p1m0', { zone: 'track', index: 13 }) // off its start (12) -> not protected
    const moveList = getLegalMoves(state, 0)
    // p0m0 + 5 -> lands on 14, passing over 13 (unprotected) is allowed
    expect(moveList.some(move => move.type === 'move' && move.marbleId === 'p0m0')).toBe(true)
  })

  it('excludes a protected marble as a jack target', () => {
    let state = setHand(game(), 0, [card('J')])
    state = place(state, 'p0m0', { zone: 'track', index: 5 })
    state = place(state, 'p1m0', { zone: 'track', index: 12 }) // protected on its start
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'swap')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/engine/protection.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add protection to `moves.ts`**

Merge `ringSize` into the existing `./board` import:

```ts
import { ringDestinations, ringSize, startCell } from './board'
```

Add near the other helpers:

```ts
const isProtected = (marble: Marble): boolean =>
  marble.position.zone === 'track' && marble.position.index === startCell(marble.owner)

// Ring cells strictly between origin and destination must hold no protected marble.
const pathClear = (state: GameState, mover: Marble, steps: number): boolean => {
  if (mover.position.zone !== 'track') return true
  const direction = steps >= 0 ? 1 : -1
  const distance = Math.abs(steps)
  for (let step = 1; step < distance; step++) {
    const index = (((mover.position.index + direction * step) % ringSize) + ringSize) % ringSize
    const occupant = state.marbleList.find(
      marble => marble.position.zone === 'track' && marble.position.index === index
    )
    if (occupant && isProtected(occupant)) return false
  }
  return true
}
```

Replace `canLandOn` (the Task 6 version) with the protection-aware version:

```ts
const canLandOn = (state: GameState, mover: Marble, to: Position): boolean => {
  if (to.zone !== 'track') return true
  const occupant = state.marbleList.find(
    marble => marble.position.zone === 'track' && marble.position.index === to.index
  )
  if (!occupant) return true
  if (occupant.owner === mover.owner) return false
  return !isProtected(occupant)
}
```

In `resolveDestination`, guard the track origin with `pathClear` — add the first line:

```ts
  if (mover.position.zone === 'track') {
    if (!pathClear(state, mover, steps)) return null
    const reach = ringDestinations(mover.owner, mover.position.index, steps)
    // ...unchanged...
  }
```

In `getLegalMoves`, filter protected marbles out of the Jack target list:

```ts
      const enemyRingList = state.marbleList.filter(
        marble => marble.owner !== player && marble.position.zone === 'track' && !isProtected(marble)
      )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/engine/protection.test.ts`
Then: `pnpm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/moves.ts tests/engine/protection.test.ts
git commit -m "feat(engine): start-square protection (land, pass, swap)"
```

---

### Task 11: Discard, round management and reshuffle

**Files:**
- Modify: `src/engine/moves.ts`
- Modify: `src/engine/state.ts`
- Test: `tests/engine/rounds.test.ts`

**Interfaces:**
- Produces:
  - `getLegalMoves` returns one `discard` move per **distinct** rank in hand when there is no other legal move. When other moves exist, no discard is offered.
  - `redealIfNeeded(state, random?): GameState` (in `state.ts`): when all active hands are empty, deal a fresh `handSize` to each active player from `drawPile`; when `drawPile` runs short, reshuffle `discardPile` into it first.
  - `applyMove` becomes a thin wrapper `redealIfNeeded(applyMoveInner(...))`.

- [ ] **Step 1: Write the failing test `tests/engine/rounds.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/engine/state'
import { getLegalMoves, applyMove } from '../../src/engine/moves'
import { setHand, card } from '../../tests/support'

const game = () => createGame(['human', 'bot', 'bot', 'bot'], () => 0)

describe('discard', () => {
  it('offers a discard per distinct rank when nothing is playable', () => {
    // all marbles in home, hand has no exit card -> must discard
    const state = setHand(game(), 0, [card('5'), card('5'), card('9')])
    const moveList = getLegalMoves(state, 0)
    expect(moveList.every(move => move.type === 'discard')).toBe(true)
    const rankSet = new Set(moveList.map(move => move.card.rank))
    expect(rankSet).toEqual(new Set(['5', '9']))
  })

  it('offers no discard when a real move exists', () => {
    const state = setHand(game(), 0, [card('A')]) // can exit
    const moveList = getLegalMoves(state, 0)
    expect(moveList.some(move => move.type === 'discard')).toBe(false)
  })
})

describe('redeal', () => {
  it('deals fresh hands once every active hand is empty', () => {
    let state = game()
    for (const seat of [0, 1, 2, 3] as const) {
      state = setHand(state, seat, [card('9')]) // home marbles, 9 cannot exit -> discard
    }
    // four discards, one per player, empties all hands then redeals
    state = applyMove(state, { type: 'discard', card: card('9') })
    state = applyMove(state, { type: 'discard', card: card('9') })
    state = applyMove(state, { type: 'discard', card: card('9') })
    state = applyMove(state, { type: 'discard', card: card('9') })
    expect(state.playerList[0]!.hand).toHaveLength(5)
    expect(state.playerList[3]!.hand).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/engine/rounds.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add `redealIfNeeded` to `state.ts`**

Add `Card` to the existing type import in `state.ts` (`shuffle` is already imported from `./cards`):

```ts
import type { Card } from './types'   // merge Card into the existing type import
```

Append to `src/engine/state.ts`:

```ts
export const redealIfNeeded = (state: GameState, random: () => number = Math.random): GameState => {
  const activeList = state.playerList.filter(player => player.kind !== 'inactive')
  const allEmpty = activeList.every(player => player.hand.length === 0)
  if (!allEmpty) return state

  let drawPile = [...state.drawPile]
  let discardPile = [...state.discardPile]
  const playerList = state.playerList.map(player => {
    if (player.kind === 'inactive') return player
    const hand: Card[] = []
    for (let slot = 0; slot < handSize; slot++) {
      if (drawPile.length === 0) {
        drawPile = shuffle(discardPile, random)
        discardPile = []
      }
      const drawn = drawPile.shift()
      if (drawn) hand.push(drawn)
    }
    return { ...player, hand }
  })

  return { ...state, playerList, drawPile, discardPile }
}
```

- [ ] **Step 4: Add discard generation and wire redeal into `applyMove`**

In `getLegalMoves`, append the discard fallback just before `return result`:

```ts
  if (result.length === 0) {
    const seenRankSet = new Set<string>()
    for (const playedCard of hand) {
      if (seenRankSet.has(playedCard.rank)) continue
      seenRankSet.add(playedCard.rank)
      result.push({ type: 'discard', card: playedCard })
    }
  }
```

In `moves.ts`, import `redealIfNeeded`:

```ts
import { redealIfNeeded } from './state'
```

Rename the existing `export const applyMove = ...` to `const applyMoveInner = ...` (remove `export`), and add the wrapper:

```ts
export const applyMove = (state: GameState, move: Move): GameState =>
  redealIfNeeded(applyMoveInner(state, move))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/engine/rounds.test.ts`
Then: `pnpm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/moves.ts src/engine/state.ts tests/engine/rounds.test.ts
git commit -m "feat(engine): discard fallback, redeal and reshuffle"
```

---

### Task 12: Public API + integration test

**Files:**
- Create: `src/engine/index.ts`
- Test: `tests/engine/integration.test.ts`

**Interfaces:**
- Produces: `src/engine/index.ts` — the single public entry point re-exporting `createGame`, `getLegalMoves`, `applyMove`, board constants, helpers, and all types. Consumers (AI, UI plans) import only from `src/engine`.

- [ ] **Step 1: Write the failing integration test `tests/engine/integration.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createGame, getLegalMoves, applyMove } from '../../src/engine'

describe('engine integration', () => {
  it('plays legal moves without throwing and always offers at least one move', () => {
    // deterministic shuffle; bots always take the first legal move
    let state = createGame(['bot', 'bot', 'bot', 'bot'], () => 0)
    for (let ply = 0; ply < 2000 && state.winner === null; ply++) {
      const moveList = getLegalMoves(state, state.currentPlayer)
      expect(moveList.length).toBeGreaterThan(0) // at worst a discard is available
      state = applyMove(state, moveList[0]!)
    }
    // reached here without throwing; state is still a valid 4-seat game
    expect(state.playerList).toHaveLength(4)
  })

  it('re-exports the public functions', async () => {
    const engine = await import('../../src/engine')
    expect(typeof engine.createGame).toBe('function')
    expect(typeof engine.getLegalMoves).toBe('function')
    expect(typeof engine.applyMove).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/engine/integration.test.ts`
Expected: FAIL — `src/engine/index.ts` missing.

- [ ] **Step 3: Create `src/engine/index.ts`**

```ts
export type {
  PlayerId, Color, MarbleId, Position, Rank, Suit, Card,
  Marble, Move, Player, PlayerKind, GameState
} from './types'
export { createGame, redealIfNeeded, handSize, colorOf, marbleId } from './state'
export { getLegalMoves, applyMove, nextPlayer } from './moves'
export { ringSize, quadrantSize, playerCount, finishSize, startCell, laneMouth } from './board'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/engine/integration.test.ts`
Then: `pnpm test`
Then: `pnpm typecheck`
Expected: all PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/index.ts tests/engine/integration.test.ts
git commit -m "feat(engine): public API and integration test"
```

---

## Self-Review

**Spec coverage:**
- §5.1 board zones/geometry → Task 2. §5.2 lane mouth (both directions, no "has looped" flag) → Task 2 + Task 7. §5.3 `GameState` shape → Task 1 + Task 4.
- §6.1 cards/values/hand of 5/redeal/reshuffle → Task 3, Task 4, Task 11. §6.2 `Move` union → Task 1. §6.3 `getLegalMoves`/`applyMove`/immutability → Tasks 5–12.
- §7 captures → Task 5; own-marble block → Task 6; lane choice + exact count + no jump-over → Task 7; split 7 → Task 8; Jack → Task 9; start protection (land/pass/swap) → Task 10; win condition → Task 7; no-move discard → Task 11.
- §11 testing priority → each task is TDD; integration in Task 12.
- Out of scope for this plan (correct): AI (§8) and Ink UI (§9) — deferred to their own plans.

**Placeholder scan:** No TBD/TODO. Every code step shows full code. The one intentional deferral (`applyMove` throwing for `split7`/`swap` in Task 5) is resolved in Tasks 8–9 and stated explicitly.

**Type consistency:** `getLegalMoves(state, player)` and `applyMove(state, move)` signatures are stable from first appearance. The `Move` union (with `enterLane?` and the split-part shape) is defined once in Task 1, so no later type churn. The shared `resolveDestination` is used by single moves (Task 7) and split parts (Task 8), keeping semantics identical. `marbleId` (`p{n}m{n}`) matches the ids used throughout tests.

**Style compliance (per `CLAUDE.md`):** no `function` keyword, no semicolons/trailing commas, no single-letter identifiers, no plural identifiers. **No `!` in production code** — `ringDestinations` returns a `{ ring, lane }` struct (no `find(...)!`), `nextPlayer`/`createGame` use `?? fallback`, `colorOf` uses a `Record<PlayerId, Color>` (total map, no undefined), and `playerById`/`findMarble` are find-or-throw helpers. `!` appears only in unit tests (e.g. `moveList[0]!`, `state.playerList[0]!.hand`), which the guideline permits.

**Note on `enterLane` encoding:** rather than emitting two structurally identical moves, the enter-lane outcome is disambiguated by the optional `enterLane` flag — this keeps `Move` JSON-simple (Global Constraints) while satisfying "one distinct Move per outcome" (spec §6.2).

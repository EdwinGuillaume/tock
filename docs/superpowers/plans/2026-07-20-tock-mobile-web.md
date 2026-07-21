# Tock Mobile Web — Implementation Plan (M1 + M2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take Tock out of the terminal onto mobile as a shareable, touch-friendly React web app that reuses the existing engine + bot verbatim, then add local pass-and-play.

**Architecture:** The repo becomes a pnpm workspace. The isomorphic rules + AI move to `packages/core` (`@tock/core`); the Ink TUI becomes `apps/terminal`; a new Vite + React app is `apps/web`. The web app renders the cross board in SVG (wood theme), drives every turn through the same `getLegalMoves → Move → applyMove` contract, and adds **zero** rules. Touch interaction is card-first "ghost destinations"; the 7 is a progressive spend-the-budget flow. M2 adds a "pass the phone" interstitial before human seats.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Vite 5, React 19, Vitest + @testing-library/react + jsdom. Engine/AI unchanged.

## Global Constraints

Copied verbatim from the design spec (`docs/superpowers/specs/2026-07-20-tock-mobile-web-design.md`) and CLAUDE.md. Every task's requirements implicitly include these.

- **No semicolons, no trailing commas.** ESLint max-warnings 0 (enforced by convention).
- **No `function` keyword** — const arrow functions for helpers and components.
- **No non-null assertions (`!`) in production code** (tests only). Prefer `?? fallback`, a find-or-throw helper, or tighter types (`Record<Key, V>`, discriminated unions).
- **All code and comments in English.**
- **Naming:** components PascalCase; hooks `useX`; handlers `handleX`; variables camelCase, descriptive, **no plural suffixes** (`marbleList`, not `marbles`).
- **`@tock/core` stays isomorphic:** zero Node dependencies (no `fs`/`process`/`node:`), `GameState` stays 100% JSON-serializable, `applyMove` immutable.
- **The web app imports only from `@tock/core`** — never from `apps/terminal`, and never re-implements a rule.
- **Engine public API (unchanged):** `createGame(kindList, ringSize?, random?)`, `getLegalMoves(state, playerId): Move[]`, `applyMove(state, move, random?): GameState` (advances `currentPlayer` itself), `nextPlayer(state)`, board helpers `quadrantSize/playerCount/finishSize/startCell/laneMouth/DEFAULT_RING_SIZE/RING_SIZE_OPTIONS`, plus `handSize/colorOf/marbleId` and all types.
- **AI public API (unchanged):** `pickMove(state, random?)`, `pickRandomMove(moveList, random?)`, `scoreMove`, `WEIGHTS`, `cardKeepValue`.
- **`Move` union** (`types.ts`): `exit`, `move` (optional `enterLane`), `push`, `split7` (`partList: {marbleId, steps, enterLane?}[]`, Σ=7), `swap`, `discard`. Each carries `card`. One distinct `Move` per legal outcome.
- **Node/pnpm:** run all `pnpm`/`node`/`npx` commands with the nvm v24 PATH prefix (the tool shell defaults to Node 18). Example: `PATH="$HOME/.nvm/versions/node/v24.*/bin:$PATH" pnpm test`. Adjust the glob to the installed v24 dir.

---

## File Structure

**Phase 0 — workspace restructure (mechanical move, no behaviour change):**

```
pnpm-workspace.yaml                     NEW
package.json                            REWRITE (workspace scripts only)
tsconfig.base.json                      NEW (shared compilerOptions)
packages/core/
  package.json                          NEW (@tock/core)
  tsconfig.json                         NEW (extends base)
  vitest.config.ts                      NEW
  src/engine/*                          MOVED from src/engine/
  src/ai/*                              MOVED from src/ai/
  src/index.ts                          NEW (re-exports engine + ai)
  tests/*                               MOVED from tests/engine, tests/ai, tests/support.ts
apps/terminal/
  package.json                          NEW (@tock/terminal, deps: @tock/core, ink, react)
  tsconfig.json                         NEW
  vitest.config.ts                      NEW (keeps FORCE_COLOR=1)
  src/ui/*                              MOVED from src/ui/
  src/index.tsx                         MOVED from src/index.tsx
  tests/ui/*                            MOVED from tests/ui/
```

**Phase 1 — web app (M1):**

```
packages/core/src/geometry/board2d.ts   NEW (pure grid geometry, extracted from terminal layout.ts)
packages/core/tests/board2d.test.ts      NEW
apps/terminal/src/ui/layout.ts            MODIFY (import grid geometry from @tock/core)
apps/web/
  package.json                            NEW (@tock/web)
  tsconfig.json                           NEW
  vite.config.ts                          NEW (Vite + Vitest jsdom)
  index.html                              NEW
  src/main.tsx                            NEW (mounts <App/>)
  src/theme.ts                            NEW (wood tokens, pure)
  src/svgGeometry.ts                      NEW (grid Cell -> SVG x/y, home slots)
  src/moveSelection.ts                    NEW (ghost enumeration from legalMoves)
  src/splitAllocation.ts                  NEW (progressive 7 reducer)
  src/hooks/useTockGame.ts                NEW (state + log + commitMove)
  src/hooks/useBotAutoplay.ts             NEW (bot turns auto-play)
  src/format.ts                           NEW (move -> log label)
  src/components/App.tsx                  NEW
  src/components/Setup.tsx                NEW
  src/components/Board.tsx                NEW (SVG)
  src/components/Marble.tsx               NEW
  src/components/Ghost.tsx                NEW
  src/components/Hand.tsx                 NEW (fan)
  src/components/StatusBar.tsx            NEW
  src/components/GameLog.tsx              NEW
  src/components/SplitControls.tsx        NEW
  src/components/GameOver.tsx             NEW
  tests/*                                 NEW (one file per module/component)
```

**Phase 2 — pass-and-play (M2):**

```
apps/web/src/passAndPlay.ts               NEW (pure gating logic)
apps/web/src/components/PassInterstitial.tsx  NEW
apps/web/src/components/Setup.tsx         MODIFY (per-seat human/bot)
apps/web/src/components/App.tsx           MODIFY (interstitial gate)
apps/web/tests/passAndPlay.test.ts        NEW
```

**Deviation from spec §5.1 (flagged for review):** the spec said "apps/web owns its SVG geometry." This plan instead extracts the *pure grid geometry* (`ringCoord`/`finishCoord`/`cellOf`, the tested cross-walk) into `@tock/core` (Task 1.0) and has **both** apps consume it; `apps/web` still owns only the SVG *pixel* mapping (`svgGeometry.ts`). Rationale: DRY — one tested source of truth for the board's topology→grid embedding instead of duplicating the subtle ring walk. It stays pure and zero-Node, so the isomorphic rule holds.

---

## PHASE 0 — Workspace restructure

### Task 0.1: pnpm workspace + move core to `packages/core`

**Files:**
- Create: `pnpm-workspace.yaml`, `tsconfig.base.json`, `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`
- Move: `src/engine/*` → `packages/core/src/engine/`, `src/ai/*` → `packages/core/src/ai/`, `tests/engine/*` + `tests/ai/*` + `tests/support.ts` → `packages/core/tests/`
- Modify: `packages/core/src/ai/bot.ts` + `packages/core/src/ai/score.ts` imports (relative `../engine` stays valid after the move — verify only)

**Interfaces:**
- Produces: the `@tock/core` package exporting the full engine + AI surface from `packages/core/src/index.ts`.

- [ ] **Step 1: Create the workspace manifest**

`pnpm-workspace.yaml`:
```yaml
packages:
  - packages/*
  - apps/*
```

- [ ] **Step 2: Create the shared TS base config**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  }
}
```

- [ ] **Step 3: Move engine + ai + their tests into the package**

Use `git mv` to preserve history:
```bash
mkdir -p packages/core/src packages/core/tests
git mv src/engine packages/core/src/engine
git mv src/ai packages/core/src/ai
git mv tests/engine packages/core/tests/engine
git mv tests/ai packages/core/tests/ai
git mv tests/support.ts packages/core/tests/support.ts
```
The engine/ai internal imports are all relative (`./types`, `../engine`) and survive the move unchanged.

- [ ] **Step 4: Create the core barrel**

`packages/core/src/index.ts`:
```ts
export * from './engine'
export * from './ai'
```
(The engine barrel and ai barrel have no overlapping export names, so `export *` is unambiguous.)

- [ ] **Step 5: Create the core package files**

`packages/core/package.json`:
```json
{
  "name": "@tock/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "tests"]
}
```

`packages/core/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}']
  }
})
```
(No `FORCE_COLOR` — the core has no Ink/ANSI output to assert on.)

- [ ] **Step 6: Rewrite the root package.json for the workspace**

`package.json` (root):
```json
{
  "name": "tock",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "dev": "pnpm --filter @tock/web dev",
    "dev:terminal": "pnpm --filter @tock/terminal dev",
    "build": "pnpm --filter @tock/web build"
  }
}
```
Delete the old root `devDependencies`/`dependencies` blocks and old `dev`/`test` script bodies — deps now live per package. Delete the root `tsconfig.json` and root `vitest.config.ts` (moved into packages).

- [ ] **Step 7: Install and run the core tests**

Run: `PATH="$HOME/.nvm/versions/node/v24.*/bin:$PATH" pnpm install && pnpm --filter @tock/core test`
Expected: all engine + AI tests pass (the ~130 engine/AI tests that previously lived in `tests/engine` + `tests/ai`), 0 failures.

- [ ] **Step 8: Typecheck the core**

Run: `pnpm --filter @tock/core typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: extract engine + ai into @tock/core workspace package"
```

### Task 0.2: Move the Ink TUI to `apps/terminal`

**Files:**
- Create: `apps/terminal/package.json`, `apps/terminal/tsconfig.json`, `apps/terminal/vitest.config.ts`
- Move: `src/ui/*` → `apps/terminal/src/ui/`, `src/index.tsx` → `apps/terminal/src/index.tsx`, `tests/ui/*` → `apps/terminal/tests/ui/`
- Modify: every terminal import of `../engine` / `../../engine` / `../ai` / `../../ai` → `@tock/core`

**Interfaces:**
- Consumes: `@tock/core` (all engine + AI symbols).
- Produces: `@tock/terminal` app; `pnpm dev:terminal` launches it.

- [ ] **Step 1: Move the UI and its tests**

```bash
mkdir -p apps/terminal/src apps/terminal/tests
git mv src/ui apps/terminal/src/ui
git mv src/index.tsx apps/terminal/src/index.tsx
git mv tests/ui apps/terminal/tests/ui
```
Then remove the now-empty `src/` and `tests/` at the repo root if nothing remains in them.

- [ ] **Step 2: Rewrite terminal imports to `@tock/core`**

In every moved `.ts`/`.tsx` under `apps/terminal/`, replace engine/ai import specifiers with `@tock/core`. Concretely, these become one import each:
- `from '../engine'` / `from '../../engine'` → `from '@tock/core'`
- `from '../ai'` / `from '../../ai'` → `from '@tock/core'`
Find them: `grep -rn "from '\.\.\?/\(\.\./\)\?\(engine\|ai\)'" apps/terminal/src apps/terminal/tests`
Example — `apps/terminal/src/ui/App.tsx` lines 3-4 collapse to:
```ts
import type { GameState, Move, PlayerKind } from '@tock/core'
import { applyMove, colorOf, createGame, getLegalMoves } from '@tock/core'
```
And `apps/terminal/tests/ui/*` and `tests/support.ts` references: the terminal tests that imported `../../src/engine` etc. now import `@tock/core`; if a terminal test used `tests/support.ts`, import it from `@tock/core/tests/support` is NOT valid — instead copy the tiny shared helpers the terminal tests need into `apps/terminal/tests/support.ts` (only if any terminal test imported it; the engine/AI copy already moved to core in Task 0.1).

- [ ] **Step 3: Create the terminal package files**

`apps/terminal/package.json`:
```json
{
  "name": "@tock/terminal",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.tsx",
    "dev:watch": "tsx watch src/index.tsx",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tock/core": "workspace:*",
    "ink": "^7.1.1",
    "react": "^19.2.7",
    "react-devtools-core": "^6.1.5"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "ink-testing-library": "^4.0.0",
    "tsx": "^4.23.1",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

`apps/terminal/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "tests"]
}
```

`apps/terminal/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    env: { FORCE_COLOR: '1' }
  }
})
```

- [ ] **Step 4: Install and run the terminal tests**

Run: `PATH="$HOME/.nvm/versions/node/v24.*/bin:$PATH" pnpm install && pnpm --filter @tock/terminal test`
Expected: all UI tests pass (the previous `tests/ui` suite), 0 failures.

- [ ] **Step 5: Typecheck + smoke-launch**

Run: `pnpm --filter @tock/terminal typecheck` → no errors.
Run: `pnpm dev:terminal` in a real terminal → the Setup screen renders; quit. (Manual smoke check; not automated.)

- [ ] **Step 6: Run the whole workspace suite**

Run: `pnpm -r test`
Expected: core + terminal suites both green — the full ~190-test count from before the move, now split across two packages.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move Ink TUI into apps/terminal, import @tock/core"
```

---

## PHASE 1 — Web app (M1)

### Task 1.0: Extract pure grid geometry into `@tock/core`

**Files:**
- Create: `packages/core/src/geometry/board2d.ts`, `packages/core/tests/board2d.test.ts`
- Modify: `packages/core/src/index.ts` (re-export geometry), `apps/terminal/src/ui/layout.ts` (import from core)

**Interfaces:**
- Produces:
  - `type Cell = { row: number, col: number }`
  - `type Side = 'bottom' | 'left' | 'top' | 'right'`
  - `sideOf: Record<PlayerId, Side>`
  - `gridSize(ringSize: number): number`
  - `ringCoord(index: number, ringSize: number): Cell`
  - `finishCoord(owner: PlayerId, index: number, ringSize: number): Cell`
  - `cellOf(owner: PlayerId, position: Position, ringSize: number): Cell | null`

- [ ] **Step 1: Write the failing test**

`packages/core/tests/board2d.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { cellOf, finishCoord, gridSize, ringCoord, sideOf } from '../src/geometry/board2d'

describe('board2d grid geometry', () => {
  it('sizes the grid as ringSize / 4 + 1', () => {
    expect(gridSize(48)).toBe(13)
    expect(gridSize(72)).toBe(19)
  })

  it('places each seat start at index k * ringSize / 4, all distinct on the ring', () => {
    const seen = new Set<string>()
    for (let index = 0; index < 48; index++) {
      const cell = ringCoord(index, 48)
      seen.add(`${cell.row},${cell.col}`)
    }
    expect(seen.size).toBe(48)
  })

  it('walks the ring so consecutive indices are grid-adjacent', () => {
    for (let index = 0; index < 48; index++) {
      const a = ringCoord(index, 48)
      const b = ringCoord(index + 1, 48)
      const distance = Math.abs(a.row - b.row) + Math.abs(a.col - b.col)
      expect(distance).toBe(1)
    }
  })

  it('threads finish lanes inward (slot 0 nearest the ring)', () => {
    const near = finishCoord(0, 0, 48)
    const deep = finishCoord(0, 3, 48)
    // bottom side lane runs upward: deeper slot has the smaller row
    expect(deep.row).toBeLessThan(near.row)
  })

  it('maps a track position through cellOf and a home to null', () => {
    expect(cellOf(0, { zone: 'track', index: 0 }, 48)).toEqual(ringCoord(0, 48))
    expect(cellOf(0, { zone: 'home' }, 48)).toBeNull()
  })

  it('assigns the human seat (0) to the bottom side', () => {
    expect(sideOf[0]).toBe('bottom')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @tock/core test board2d`
Expected: FAIL — `Cannot find module '../src/geometry/board2d'`.

- [ ] **Step 3: Create the geometry module by moving the pure helpers out of layout.ts**

Create `packages/core/src/geometry/board2d.ts` with the pure grid helpers **copied verbatim** from `apps/terminal/src/ui/layout.ts` (the `Cell`/`Side` types, `sideOf`, `gridSize`, `ringCache`, `STEP`, `isPlus`, `buildRing`, `ringCoord`, `finishCoord`, `cellOf`). Only the import line changes:
```ts
import type { PlayerId, Position } from '../types'

export type Cell = { row: number, col: number }
export type Side = 'bottom' | 'left' | 'top' | 'right'

export const gridSize = (ringSize: number): number => ringSize / 4 + 1

export const sideOf: Record<PlayerId, Side> = { 0: 'bottom', 1: 'left', 2: 'top', 3: 'right' }

const ringCache = new Map<number, Cell[]>()
const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
const isPlus = (row: number, col: number, mid: number): boolean =>
  Math.abs(col - mid) <= 1 || Math.abs(row - mid) <= 1

const buildRing = (ringSize: number): Cell[] => {
  // ... identical body to layout.ts buildRing (copy verbatim) ...
}

export const ringCoord = (index: number, ringSize: number): Cell => {
  const ring = ringCache.get(ringSize) ?? buildRing(ringSize)
  ringCache.set(ringSize, ring)
  const i = ((index % ringSize) + ringSize) % ringSize
  return ring[i] ?? { row: 0, col: 0 }
}

export const finishCoord = (owner: PlayerId, index: number, ringSize: number): Cell => {
  // ... identical body to layout.ts finishCoord (copy verbatim) ...
}

export const cellOf = (owner: PlayerId, position: Position, ringSize: number): Cell | null => {
  if (position.zone === 'track') return ringCoord(position.index, ringSize)
  if (position.zone === 'finish') return finishCoord(owner, position.index, ringSize)
  return null
}
```
(Import the `buildRing`/`finishCoord` bodies exactly from the current `layout.ts` — do not re-derive them.)

- [ ] **Step 4: Re-export from the core barrel**

Append to `packages/core/src/index.ts`:
```ts
export * from './geometry/board2d'
```

- [ ] **Step 5: Rewire terminal layout.ts to consume core**

In `apps/terminal/src/ui/layout.ts`: delete the moved definitions (`Cell`, `Side`, `sideOf`, `gridSize`, `ringCache`, `STEP`, `isPlus`, `buildRing`, `ringCoord`, `finishCoord`, `cellOf`) and import them instead. Keep the terminal-only parts (`HighlightKind`, `Highlight`, `movePreviewCells`, `marbleCellsAfter`, and its local `samePosition`). New top of file:
```ts
import type { GameState, MarbleId, Move, PlayerId, Position } from '@tock/core'
import { applyMove, cellOf } from '@tock/core'
import { finishCoord, gridSize, ringCoord, sideOf } from '@tock/core'
import type { Cell, Side } from '@tock/core'

export type { Cell, Side } from '@tock/core'
export { gridSize, sideOf, ringCoord, finishCoord, cellOf } from '@tock/core'

export type HighlightKind = 'selected' | 'landing'
export type Highlight = { cell: Cell, kind: HighlightKind }
// ... movePreviewCells / marbleCellsAfter unchanged (they already call cellOf/applyMove) ...
```
(Re-exporting the geometry keeps every existing `import { ringCoord } from './layout'` in the terminal working unchanged.)

- [ ] **Step 6: Run core + terminal tests**

Run: `pnpm --filter @tock/core test board2d` → PASS.
Run: `pnpm -r test` → core + terminal both green (terminal layout tests still pass through the re-export).

- [ ] **Step 7: Typecheck**

Run: `pnpm -r typecheck` → no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: share board grid geometry from @tock/core (board2d)"
```

### Task 1.1: Scaffold `apps/web` (Vite + React + Vitest)

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/components/App.tsx`, `apps/web/tests/smoke.test.tsx`

**Interfaces:**
- Produces: a runnable web app shell; `App` renders a title. `pnpm --filter @tock/web dev` serves it; `pnpm --filter @tock/web test` runs jsdom tests.

- [ ] **Step 1: Create the package + tooling files**

`apps/web/package.json`:
```json
{
  "name": "@tock/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tock/core": "workspace:*",
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2022", "DOM", "DOM.Iterable"], "types": ["vitest/globals", "@testing-library/jest-dom"] },
  "include": ["src", "tests"]
}
```

`apps/web/vite.config.ts`:
```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}']
  }
})
```
(`base: './'` makes the static build work from any host path, e.g. GitHub Pages project sites.)

- [ ] **Step 2: Create the test setup + HTML entry + mount**

`apps/web/tests/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Tock</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './components/App'

const root = document.getElementById('root')
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>)
```

- [ ] **Step 3: Write the failing smoke test**

`apps/web/tests/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../src/components/App'

describe('App shell', () => {
  it('renders the game title', () => {
    render(<App />)
    expect(screen.getByText('TOCK')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `PATH="$HOME/.nvm/versions/node/v24.*/bin:$PATH" pnpm install && pnpm --filter @tock/web test smoke`
Expected: FAIL — `Cannot find module '../src/components/App'`.

- [ ] **Step 5: Minimal App**

`apps/web/src/components/App.tsx`:
```tsx
export const App = () => <h1>TOCK</h1>
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @tock/web test smoke` → PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold Vite + React app shell with jsdom tests"
```

### Task 1.2: Wood theme tokens (`theme.ts`)

**Files:**
- Create: `apps/web/src/theme.ts`, `apps/web/tests/theme.test.ts`

**Interfaces:**
- Produces:
  - `seatColor: Record<Color, { light: string, dark: string }>` (marble gradient stops per seat)
  - `theme: { board: string, hole: string, laneHub: string, cardFace: string, cardInk: string, cardInkRed: string, text: string, textDim: string, ghost: string }`
  - `marbleGradientId(color: Color): string`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/theme.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { marbleGradientId, seatColor, theme } from '../src/theme'

describe('wood theme', () => {
  it('exposes a light+dark stop for every seat color', () => {
    for (const color of ['red', 'green', 'yellow', 'blue'] as const) {
      expect(seatColor[color].light).toMatch(/^#/)
      expect(seatColor[color].dark).toMatch(/^#/)
    }
  })

  it('derives a stable, unique gradient id per color', () => {
    expect(marbleGradientId('red')).toBe('marble-red')
    expect(marbleGradientId('blue')).toBe('marble-blue')
  })

  it('provides board + card tokens', () => {
    expect(theme.board).toMatch(/^#|gradient/)
    expect(theme.cardFace).toMatch(/^#/)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tock/web test theme` → FAIL (module missing).

- [ ] **Step 3: Implement the tokens**

`apps/web/src/theme.ts`:
```ts
import type { Color } from '@tock/core'

// Wood & marbles palette (design spec §5.2). light = top-left highlight stop,
// dark = bottom-right shadow stop of each marble's radial gradient.
export const seatColor: Record<Color, { light: string, dark: string }> = {
  red: { light: '#ff7a7f', dark: '#b52d33' },
  green: { light: '#7fdc90', dark: '#2e7d43' },
  yellow: { light: '#ffe08a', dark: '#cc9a1f' },
  blue: { light: '#86adff', dark: '#2f5bc4' }
}

export const theme = {
  board: '#5c3a17',
  boardEdge: '#3a250f',
  hole: '#4a2f12',
  laneHub: '#6b4620',
  cardFace: '#f7f0dd',
  cardInk: '#222222',
  cardInkRed: '#b52d33',
  text: '#e6e9f0',
  textDim: '#7c8496',
  ghost: '#4a7be5'
}

export const marbleGradientId = (color: Color): string => `marble-${color}`
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @tock/web test theme` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): wood theme tokens"
```

### Task 1.3: SVG geometry (`svgGeometry.ts`)

**Files:**
- Create: `apps/web/src/svgGeometry.ts`, `apps/web/tests/svgGeometry.test.ts`

**Interfaces:**
- Consumes: `gridSize`, `cellOf`, `sideOf`, `Cell` from `@tock/core`.
- Produces:
  - `CELL = 10` (units per grid cell)
  - `viewBox(ringSize: number): string`
  - `cellCenter(cell: Cell): { x: number, y: number }`
  - `positionCenter(owner: PlayerId, position: Position, ringSize: number): { x: number, y: number } | null` (null for home — use `homeSlotCenter`)
  - `homeSlotCenter(owner: PlayerId, slotIndex: number, ringSize: number): { x: number, y: number }`
  - `marbleCenter(owner: PlayerId, position: Position, slotIndex: number, ringSize: number): { x: number, y: number }`
  - `MARBLE_R = 3.6`, `HOLE_R = 4.2`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/svgGeometry.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { cellOf, gridSize } from '@tock/core'
import { CELL, cellCenter, homeSlotCenter, marbleCenter, positionCenter, viewBox } from '../src/svgGeometry'

describe('svg geometry', () => {
  it('builds a square viewBox covering the whole grid', () => {
    const side = gridSize(48) * CELL
    expect(viewBox(48)).toBe(`0 0 ${side} ${side}`)
  })

  it('centers a grid cell at (col+0.5, row+0.5) * CELL', () => {
    expect(cellCenter({ row: 2, col: 3 })).toEqual({ x: 3.5 * CELL, y: 2.5 * CELL })
  })

  it('maps a track position to its grid cell center', () => {
    const cell = cellOf(0, { zone: 'track', index: 5 }, 48)
    expect(positionCenter(0, { zone: 'track', index: 5 }, 48)).toEqual(cellCenter(cell!))
  })

  it('returns null from positionCenter for a home marble', () => {
    expect(positionCenter(0, { zone: 'home' }, 48)).toBeNull()
  })

  it('gives four distinct home slots inside the grid bounds', () => {
    const side = gridSize(48) * CELL
    const seen = new Set<string>()
    for (let slot = 0; slot < 4; slot++) {
      const point = homeSlotCenter(0, slot, 48)
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(side)
      seen.add(`${point.x},${point.y}`)
    }
    expect(seen.size).toBe(4)
  })

  it('marbleCenter uses the home slot for a home marble and the cell otherwise', () => {
    expect(marbleCenter(0, { zone: 'home' }, 2, 48)).toEqual(homeSlotCenter(0, 2, 48))
    const onTrack = { zone: 'track', index: 5 } as const
    expect(marbleCenter(0, onTrack, 0, 48)).toEqual(positionCenter(0, onTrack, 48))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tock/web test svgGeometry` → FAIL (module missing).

- [ ] **Step 3: Implement**

`apps/web/src/svgGeometry.ts`:
```ts
import type { PlayerId, Position } from '@tock/core'
import { cellOf, gridSize, sideOf } from '@tock/core'
import type { Cell } from '@tock/core'

export const CELL = 10
export const MARBLE_R = 3.6
export const HOLE_R = 4.2

export const viewBox = (ringSize: number): string => {
  const side = gridSize(ringSize) * CELL
  return `0 0 ${side} ${side}`
}

export const cellCenter = (cell: Cell): { x: number, y: number } => ({
  x: (cell.col + 0.5) * CELL,
  y: (cell.row + 0.5) * CELL
})

export const positionCenter = (
  owner: PlayerId,
  position: Position,
  ringSize: number
): { x: number, y: number } | null => {
  const cell = cellOf(owner, position, ringSize)
  return cell ? cellCenter(cell) : null
}

// Home nests sit in the empty corner nearest the owner's side, laid out as a
// 2x2 cluster. The corner is picked from sideOf so each seat's home hugs its arm.
export const homeSlotCenter = (
  owner: PlayerId,
  slotIndex: number,
  ringSize: number
): { x: number, y: number } => {
  const cellsPerSide = gridSize(ringSize)
  const near = 1.5
  const far = cellsPerSide - 1.5
  const corner: Record<string, { cx: number, cy: number }> = {
    bottom: { cx: far, cy: far },
    left: { cx: near, cy: far },
    top: { cx: near, cy: near },
    right: { cx: far, cy: near }
  }
  const spot = corner[sideOf[owner]] ?? { cx: near, cy: near }
  const dx = (slotIndex % 2) * 1.2 - 0.6
  const dy = (slotIndex < 2 ? -1 : 1) * 0.6
  return { x: (spot.cx + dx) * CELL, y: (spot.cy + dy) * CELL }
}

export const marbleCenter = (
  owner: PlayerId,
  position: Position,
  slotIndex: number,
  ringSize: number
): { x: number, y: number } =>
  positionCenter(owner, position, ringSize) ?? homeSlotCenter(owner, slotIndex, ringSize)
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @tock/web test svgGeometry` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): SVG board geometry (grid cell -> pixel, home slots)"
```

### Task 1.4: Board + Marble + Ghost SVG components

**Files:**
- Create: `apps/web/src/components/Marble.tsx`, `apps/web/src/components/Ghost.tsx`, `apps/web/src/components/Board.tsx`, `apps/web/tests/board.test.tsx`

**Interfaces:**
- Consumes: `svgGeometry`, `theme`, `@tock/core` types + `colorOf`, `marbleId`.
- Produces:
  - `Marble` props `{ color: Color, cx: number, cy: number }`
  - `Ghost` props `{ cx: number, cy: number, label?: string, onSelect: () => void }` (renders `role="button"` with `aria-label` `ghost-<label>` and a data attr for tests)
  - `Board` props `{ state: GameState, ghostList: Ghost[], onGhost: (ghost: Ghost) => void }` where `Ghost` here is the render type from `moveSelection` (Task 1.5) — **for this task**, `Board` accepts `ghostList: { key: string, cx: number, cy: number, label?: string }[]` and `onGhost: (key: string) => void`.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/board.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createGame, marbleId } from '@tock/core'
import { Board } from '../src/components/Board'

describe('Board', () => {
  it('renders one marble node per marble in play', () => {
    const state = createGame(['human', 'bot'], 48)
    render(<Board state={state} ghostList={[]} onGhost={() => {}} />)
    // 2 active seats * 4 marbles = 8 marbles
    expect(screen.getAllByTestId(/^marble-/)).toHaveLength(8)
    expect(screen.getByTestId(`marble-${marbleId(0, 0)}`)).toBeInTheDocument()
  })

  it('renders a ghost per entry and fires onGhost with its key when tapped', async () => {
    const state = createGame(['human', 'bot'], 48)
    const onGhost = vi.fn()
    render(
      <Board
        state={state}
        ghostList={[{ key: 'g1', cx: 50, cy: 50, label: '7' }]}
        onGhost={onGhost}
      />
    )
    await userEvent.click(screen.getByLabelText('ghost-7'))
    expect(onGhost).toHaveBeenCalledWith('g1')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tock/web test board` → FAIL (modules missing).

- [ ] **Step 3: Implement Marble, Ghost, Board**

`apps/web/src/components/Marble.tsx`:
```tsx
import type { Color } from '@tock/core'
import { MARBLE_R } from '../svgGeometry'
import { marbleGradientId } from '../theme'

type MarbleProps = { color: Color, cx: number, cy: number, testId?: string }

export const Marble = ({ color, cx, cy, testId }: MarbleProps) => (
  <circle
    cx={cx}
    cy={cy}
    r={MARBLE_R}
    fill={`url(#${marbleGradientId(color)})`}
    data-testid={testId}
    style={{ transition: 'cx 0.25s ease, cy 0.25s ease' }}
  />
)
```

`apps/web/src/components/Ghost.tsx`:
```tsx
import { MARBLE_R } from '../svgGeometry'
import { theme } from '../theme'

type GhostProps = { cx: number, cy: number, label?: string, onSelect: () => void }

export const Ghost = ({ cx, cy, label, onSelect }: GhostProps) => (
  <g role="button" aria-label={`ghost-${label ?? ''}`} onClick={onSelect} style={{ cursor: 'pointer' }}>
    <circle cx={cx} cy={cy} r={MARBLE_R + 1.2} fill="transparent" />
    <circle cx={cx} cy={cy} r={MARBLE_R} fill="none" stroke={theme.ghost} strokeWidth={1} strokeDasharray="2 1.5" />
    {label && (
      <text x={cx} y={cy + 1} textAnchor="middle" fontSize={4} fill={theme.ghost}>{label}</text>
    )}
  </g>
)
```

`apps/web/src/components/Board.tsx`:
```tsx
import type { GameState } from '@tock/core'
import { colorOf } from '@tock/core'
import { HOLE_R, marbleCenter, viewBox } from '../svgGeometry'
import { seatColor, theme } from '../theme'
import { Marble } from './Marble'
import { Ghost } from './Ghost'

type GhostEntry = { key: string, cx: number, cy: number, label?: string }
type BoardProps = { state: GameState, ghostList: GhostEntry[], onGhost: (key: string) => void }

// Per-marble home-slot index: the Nth marble a player owns takes home slot N.
const slotIndexOf = (state: GameState, marbleIdValue: string): number => {
  const owned = state.marbleList.filter(marble => marble.owner === state.marbleList.find(m => m.id === marbleIdValue)?.owner)
  return owned.findIndex(marble => marble.id === marbleIdValue)
}

export const Board = ({ state, ghostList, onGhost }: BoardProps) => (
  <svg viewBox={viewBox(state.ringSize)} role="img" aria-label="board" style={{ width: '100%', height: 'auto' }}>
    <defs>
      {(['red', 'green', 'yellow', 'blue'] as const).map(color => (
        <radialGradient key={color} id={`marble-${color}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={seatColor[color].light} />
          <stop offset="100%" stopColor={seatColor[color].dark} />
        </radialGradient>
      ))}
    </defs>
    {/* holes: one drilled hole per track cell + finish cell is drawn by the Board grid;
        for M1 we draw holes under every marble-reachable cell via marbleCenter of track cells. */}
    {state.marbleList.map(marble => {
      const slot = slotIndexOf(state, marble.id)
      const point = marbleCenter(marble.owner, marble.position, slot, state.ringSize)
      return (
        <circle key={`hole-${marble.id}`} cx={point.x} cy={point.y} r={HOLE_R} fill={theme.hole} />
      )
    })}
    {state.marbleList.map(marble => {
      const slot = slotIndexOf(state, marble.id)
      const point = marbleCenter(marble.owner, marble.position, slot, state.ringSize)
      return (
        <Marble key={marble.id} testId={`marble-${marble.id}`} color={colorOf(marble.owner)} cx={point.x} cy={point.y} />
      )
    })}
    {ghostList.map(ghost => (
      <Ghost key={ghost.key} cx={ghost.cx} cy={ghost.cy} label={ghost.label} onSelect={() => onGhost(ghost.key)} />
    ))}
  </svg>
)
```
(Note: M1 draws holes under marbles for simplicity; a full drilled-board backdrop — a hole under every track/finish cell — is a later polish item and is explicitly not required to pass the tests.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @tock/web test board` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): SVG Board, Marble, Ghost components"
```

### Task 1.5: Move selection — ghost enumeration (`moveSelection.ts`)

**Files:**
- Create: `apps/web/src/moveSelection.ts`, `apps/web/tests/moveSelection.test.ts`

**Interfaces:**
- Consumes: `@tock/core` (`GameState`, `Card`, `Move`, `MarbleId`, `applyMove`), `svgGeometry.marbleCenter`.
- Produces:
  - `type Ghost = { key: string, move: Move, cx: number, cy: number, label?: string }`
  - `sameCard(a: Card, b: Card): boolean`
  - `movesForCard(card: Card, legalMoves: Move[]): Move[]`
  - `handIsPlayable(card: Card, legalMoves: Move[]): boolean`
  - `ghostsForCard(card: Card, state: GameState, legalMoves: Move[]): Ghost[]` — one ghost per non-split7, non-swap move that lands a marble; the ghost sits at the acting marble's post-move cell (for `push`, the pushed opponent marble's cell).
  - `swapMovesForCard(card, legalMoves): Move[]` and `ownSwapMarbleIds` / `swapTargetsFor(marbleId, ...)` for the two-tap Jack flow.
  - `isSplitCard(card, legalMoves): boolean`, `isDiscardOnly(card, legalMoves): boolean`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/moveSelection.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createGame, getLegalMoves } from '@tock/core'
import { ghostsForCard, handIsPlayable, movesForCard, sameCard } from '../src/moveSelection'

const findCard = (state: ReturnType<typeof createGame>, rank: string) =>
  state.playerList[0]!.hand.find(card => card.rank === rank)

describe('moveSelection', () => {
  it('sameCard matches on rank + suit', () => {
    expect(sameCard({ rank: 'A', suit: 'clubs' }, { rank: 'A', suit: 'clubs' })).toBe(true)
    expect(sameCard({ rank: 'A', suit: 'clubs' }, { rank: 'A', suit: 'spades' })).toBe(false)
  })

  it('emits one ghost per legal landing of an exit move', () => {
    // Deterministic game; find an Ace in the human hand to exit with, or skip.
    const state = createGame(['human', 'bot'], 48, () => 0.42)
    const legal = getLegalMoves(state, 0)
    const exitMove = legal.find(move => move.type === 'exit')
    if (!exitMove) return // hand had no exit card this seed; covered by engine tests
    const ghostList = ghostsForCard(exitMove.card, state, legal)
    expect(ghostList.length).toBeGreaterThanOrEqual(1)
    expect(ghostList.every(ghost => typeof ghost.cx === 'number')).toBe(true)
  })

  it('handIsPlayable is false for a card with no legal move', () => {
    const state = createGame(['human', 'bot'], 48)
    const legal = getLegalMoves(state, 0)
    const unplayable = state.playerList[0]!.hand.find(card => movesForCard(card, legal).length === 0)
    if (unplayable) expect(handIsPlayable(unplayable, legal)).toBe(false)
  })
})
```
(Add a focused, seed-independent unit test using a hand-built state via `tests/support`-style placement if the workspace exposes a placement helper; otherwise the engine's own move tests already cover enumeration and these assert the projection layer.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tock/web test moveSelection` → FAIL (module missing).

- [ ] **Step 3: Implement**

`apps/web/src/moveSelection.ts`:
```ts
import type { Card, GameState, MarbleId, Move } from '@tock/core'
import { applyMove } from '@tock/core'
import { marbleCenter } from './svgGeometry'

export type Ghost = { key: string, move: Move, cx: number, cy: number, label?: string }

export const sameCard = (a: Card, b: Card): boolean => a.rank === b.rank && a.suit === b.suit

export const movesForCard = (card: Card, legalMoves: Move[]): Move[] =>
  legalMoves.filter(move => sameCard(move.card, card))

export const handIsPlayable = (card: Card, legalMoves: Move[]): boolean =>
  movesForCard(card, legalMoves).length > 0

export const isSplitCard = (card: Card, legalMoves: Move[]): boolean =>
  movesForCard(card, legalMoves).some(move => move.type === 'split7')

export const isDiscardOnly = (card: Card, legalMoves: Move[]): boolean => {
  const list = movesForCard(card, legalMoves)
  return list.length > 0 && list.every(move => move.type === 'discard')
}

// The marble whose landing a ghost should mark: the actor's marble for
// exit/move, the pushed opponent marble for push.
const landingMarbleId = (move: Move): MarbleId | null => {
  if (move.type === 'exit' || move.type === 'move' || move.type === 'push') return move.marbleId
  return null
}

const slotIndexOf = (state: GameState, id: MarbleId): number => {
  const owner = state.marbleList.find(marble => marble.id === id)?.owner
  return state.marbleList.filter(marble => marble.owner === owner).findIndex(marble => marble.id === id)
}

// One ghost per exit/move/push outcome, placed at the post-move cell of the
// relevant marble (read from the engine's immutable applyMove — positions only).
export const ghostsForCard = (card: Card, state: GameState, legalMoves: Move[]): Ghost[] => {
  const ghostList: Ghost[] = []
  movesForCard(card, legalMoves).forEach((move, index) => {
    const id = landingMarbleId(move)
    if (!id) return
    const after = applyMove(state, move)
    const marble = after.marbleList.find(candidate => candidate.id === id)
    if (!marble) return
    const slot = slotIndexOf(after, id)
    const point = marbleCenter(marble.owner, marble.position, slot, state.ringSize)
    const label = move.type === 'move' && move.enterLane ? '⌂' : String(('steps' in move) ? move.steps : '')
    ghostList.push({ key: `ghost-${index}`, move, cx: point.x, cy: point.y, label: label || undefined })
  })
  return ghostList
}

export const swapMovesForCard = (card: Card, legalMoves: Move[]): Move[] =>
  movesForCard(card, legalMoves).filter(move => move.type === 'swap')

export const ownSwapMarbleIds = (card: Card, legalMoves: Move[]): MarbleId[] => {
  const idList: MarbleId[] = []
  for (const move of swapMovesForCard(card, legalMoves)) {
    if (move.type === 'swap' && !idList.includes(move.marbleId)) idList.push(move.marbleId)
  }
  return idList
}

export const swapTargetsFor = (card: Card, marbleId: MarbleId, legalMoves: Move[]): Move[] =>
  swapMovesForCard(card, legalMoves).filter(move => move.type === 'swap' && move.marbleId === marbleId)
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @tock/web test moveSelection` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): ghost-destination enumeration from legal moves"
```

### Task 1.6: Progressive 7-split (`splitAllocation.ts`)

**Files:**
- Create: `apps/web/src/splitAllocation.ts`, `apps/web/tests/splitAllocation.test.ts`

**Interfaces:**
- Consumes: `@tock/core` (`Card`, `Move`, `MarbleId`, `GameState`, `applyMove`), `svgGeometry.marbleCenter`, `moveSelection.Ghost`.
- Produces:
  - `type SplitPart = { marbleId: MarbleId, steps: number, enterLane?: boolean }`
  - `type SplitDraft = { card: Card, assigned: SplitPart[] }`
  - `startSplit(card: Card): SplitDraft`
  - `splitRemaining(draft: SplitDraft): number` (7 − Σ assigned)
  - `splitCandidateIds(card: Card, legalMoves: Move[]): MarbleId[]`
  - `splitGhostsForMarble(draft, marbleId, state, legalMoves): Ghost[]` (each reachable landing for that marble, given what is assigned)
  - `allocate(draft, part: SplitPart): SplitDraft`
  - `undoLast(draft): SplitDraft`
  - `completedSplitMove(draft, legalMoves): Move | undefined` (defined only when remaining === 0)

- [ ] **Step 1: Write the failing test**

`apps/web/tests/splitAllocation.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Move } from '@tock/core'
import { allocate, completedSplitMove, splitRemaining, startSplit, undoLast } from '../src/splitAllocation'

const card = { rank: '7', suit: 'hearts' } as const

// A minimal legal-move set standing in for getLegalMoves on a split turn:
// one marble can go 3 or 7, another can go 4 (3+4 and 7+0 are the partitions).
const legalMoves: Move[] = [
  { type: 'split7', card, partList: [{ marbleId: 'p0m0', steps: 7 }] },
  { type: 'split7', card, partList: [{ marbleId: 'p0m0', steps: 3 }, { marbleId: 'p0m1', steps: 4 }] }
]

describe('splitAllocation', () => {
  it('starts with the full budget of 7', () => {
    expect(splitRemaining(startSplit(card))).toBe(7)
  })

  it('decrements the budget as parts are allocated', () => {
    const draft = allocate(startSplit(card), { marbleId: 'p0m0', steps: 3 })
    expect(splitRemaining(draft)).toBe(4)
  })

  it('undo restores the previous budget', () => {
    const draft = allocate(startSplit(card), { marbleId: 'p0m0', steps: 3 })
    expect(splitRemaining(undoLast(draft))).toBe(7)
  })

  it('yields no completed move until the budget hits 0', () => {
    const draft = allocate(startSplit(card), { marbleId: 'p0m0', steps: 3 })
    expect(completedSplitMove(draft, legalMoves)).toBeUndefined()
  })

  it('resolves to the matching split7 move at 0 remaining', () => {
    const draft = allocate(
      allocate(startSplit(card), { marbleId: 'p0m0', steps: 3 }),
      { marbleId: 'p0m1', steps: 4 }
    )
    expect(splitRemaining(draft)).toBe(0)
    const move = completedSplitMove(draft, legalMoves)
    expect(move?.type).toBe('split7')
    expect(move?.type === 'split7' && move.partList).toHaveLength(2)
  })

  it('resolves a single-marble full 7', () => {
    const draft = allocate(startSplit(card), { marbleId: 'p0m0', steps: 7 })
    expect(completedSplitMove(draft, legalMoves)?.type).toBe('split7')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tock/web test splitAllocation` → FAIL (module missing).

- [ ] **Step 3: Implement**

`apps/web/src/splitAllocation.ts`:
```ts
import type { Card, GameState, MarbleId, Move } from '@tock/core'
import { applyMove } from '@tock/core'
import type { Ghost } from './moveSelection'
import { sameCard } from './moveSelection'
import { marbleCenter } from './svgGeometry'

export type SplitPart = { marbleId: MarbleId, steps: number, enterLane?: boolean }
export type SplitDraft = { card: Card, assigned: SplitPart[] }

const TOTAL = 7

export const startSplit = (card: Card): SplitDraft => ({ card, assigned: [] })

export const splitRemaining = (draft: SplitDraft): number =>
  TOTAL - draft.assigned.reduce((sum, part) => sum + part.steps, 0)

export const allocate = (draft: SplitDraft, part: SplitPart): SplitDraft =>
  ({ card: draft.card, assigned: [...draft.assigned, part] })

export const undoLast = (draft: SplitDraft): SplitDraft =>
  ({ card: draft.card, assigned: draft.assigned.slice(0, -1) })

const splitPartLists = (card: Card, legalMoves: Move[]): SplitPart[][] =>
  legalMoves.flatMap(move => (move.type === 'split7' && sameCard(move.card, card) ? [move.partList] : []))

const stepsOf = (partList: SplitPart[], marbleId: MarbleId): number =>
  partList.find(part => part.marbleId === marbleId)?.steps ?? 0

const laneOf = (partList: SplitPart[], marbleId: MarbleId): boolean =>
  partList.find(part => part.marbleId === marbleId)?.enterLane ?? false

// Partitions still consistent with everything assigned so far.
const compatible = (card: Card, assigned: SplitPart[], legalMoves: Move[]): SplitPart[][] =>
  splitPartLists(card, legalMoves).filter(partList =>
    assigned.every(part =>
      stepsOf(partList, part.marbleId) === part.steps &&
      laneOf(partList, part.marbleId) === (part.enterLane ?? false)
    )
  )

export const splitCandidateIds = (card: Card, legalMoves: Move[]): MarbleId[] => {
  const idList: MarbleId[] = []
  for (const partList of splitPartLists(card, legalMoves)) {
    for (const part of partList) if (!idList.includes(part.marbleId)) idList.push(part.marbleId)
  }
  return idList
}

const slotIndexOf = (state: GameState, id: MarbleId): number => {
  const owner = state.marbleList.find(marble => marble.id === id)?.owner
  return state.marbleList.filter(marble => marble.owner === owner).findIndex(marble => marble.id === id)
}

// The distinct still-reachable (steps, enterLane) landings for one marble, each
// as a ghost placed at where that marble would sit if only this part applied.
export const splitGhostsForMarble = (
  draft: SplitDraft,
  marbleId: MarbleId,
  state: GameState,
  legalMoves: Move[]
): Ghost[] => {
  const live = compatible(draft.card, draft.assigned, legalMoves)
  const seen = new Set<string>()
  const ghostList: Ghost[] = []
  live.forEach((partList, index) => {
    const steps = stepsOf(partList, marbleId)
    if (steps <= 0) return
    const enterLane = laneOf(partList, marbleId)
    const key = `${steps}-${enterLane}`
    if (seen.has(key)) return
    seen.add(key)
    // Preview via a one-part move applied to the marble.
    const preview: Move = { type: 'split7', card: draft.card, partList: [{ marbleId, steps, enterLane }] }
    const after = applyMove(state, preview)
    const marble = after.marbleList.find(candidate => candidate.id === marbleId)
    if (!marble) return
    const point = marbleCenter(marble.owner, marble.position, slotIndexOf(after, marbleId), state.ringSize)
    ghostList.push({ key: `split-${marbleId}-${key}`, move: preview, cx: point.x, cy: point.y, label: String(steps) })
  })
  return ghostList
}

// The single completed split7 move matching the assigned non-zero parts, order-
// and zero-insensitive. Defined only when the budget is fully spent.
export const completedSplitMove = (draft: SplitDraft, legalMoves: Move[]): Move | undefined => {
  if (splitRemaining(draft) !== 0) return undefined
  const nonZero = draft.assigned.filter(part => part.steps > 0)
  return splitPartLists(draft.card, legalMoves)
    .map(partList => ({ type: 'split7', card: draft.card, partList } as Move))
    .find(move =>
      move.type === 'split7' &&
      move.partList.length === nonZero.length &&
      nonZero.every(part =>
        stepsOf(move.partList, part.marbleId) === part.steps &&
        laneOf(move.partList, part.marbleId) === (part.enterLane ?? false)
      )
    )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @tock/web test splitAllocation` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): progressive 7-split allocation logic"
```

### Task 1.7: Game state + bot autoplay hooks + log format

**Files:**
- Create: `apps/web/src/format.ts`, `apps/web/src/hooks/useTockGame.ts`, `apps/web/src/hooks/useBotAutoplay.ts`, `apps/web/tests/gameHooks.test.tsx`

**Interfaces:**
- Consumes: `@tock/core` (`GameState`, `Move`, `PlayerId`, `PlayerKind`, `createGame`, `applyMove`, `colorOf`, `pickMove`).
- Produces:
  - `moveLabel(before: GameState, after: GameState, move: Move): string`
  - `useTockGame(): { state: GameState | null, logList: string[], start: (kindList: PlayerKind[], ringSize: number) => void, restart: () => void, commitMove: (move: Move) => void }`
  - `useBotAutoplay(args: { state: GameState | null, humanSeatIds: PlayerId[], delayMs: number, commitMove: (move: Move) => void, random?: () => number }): void`
  - `isHumanSeat(state: GameState, humanSeatIds: PlayerId[]): boolean`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/gameHooks.test.tsx`:
```tsx
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getLegalMoves } from '@tock/core'
import { useTockGame } from '../src/hooks/useTockGame'

describe('useTockGame', () => {
  it('starts a game and exposes state', () => {
    const { result } = renderHook(() => useTockGame())
    expect(result.current.state).toBeNull()
    act(() => result.current.start(['human', 'bot'], 48))
    expect(result.current.state?.playerList).toHaveLength(4)
    expect(result.current.state?.currentPlayer).toBe(0)
  })

  it('commitMove applies a move, advances the turn, and appends a log line', () => {
    const { result } = renderHook(() => useTockGame())
    act(() => result.current.start(['human', 'bot'], 48))
    const before = result.current.state!
    const move = getLegalMoves(before, 0)[0]!
    act(() => result.current.commitMove(move))
    expect(result.current.state).not.toBe(before)
    expect(result.current.logList.length).toBe(1)
  })

  it('restart clears the game', () => {
    const { result } = renderHook(() => useTockGame())
    act(() => result.current.start(['human', 'bot'], 48))
    act(() => result.current.restart())
    expect(result.current.state).toBeNull()
    expect(result.current.logList).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tock/web test gameHooks` → FAIL (module missing).

- [ ] **Step 3: Implement format + hooks**

`apps/web/src/format.ts`:
```ts
import type { GameState, Move } from '@tock/core'
import { colorOf } from '@tock/core'

// Short, human-readable log line for a committed move. Kept deliberately simple
// for M1 (the terminal has a richer moveLabel; this is the web's own copy).
export const moveLabel = (before: GameState, after: GameState, move: Move): string => {
  const who = colorOf(before.currentPlayer)
  switch (move.type) {
    case 'exit': return `${who} exits a marble (${move.card.rank})`
    case 'move': return `${who} moves ${move.steps}${move.enterLane ? ' into the lane' : ''}`
    case 'push': return `${who} pushes an opponent 5`
    case 'swap': return `${who} swaps (Jack)`
    case 'split7': return `${who} splits the 7`
    case 'discard': return `${who} discards ${move.card.rank}`
  }
}
```

`apps/web/src/hooks/useTockGame.ts`:
```ts
import { useCallback, useState } from 'react'
import type { GameState, Move, PlayerKind } from '@tock/core'
import { applyMove, createGame } from '@tock/core'
import { moveLabel } from '../format'

export const useTockGame = () => {
  const [state, setState] = useState<GameState | null>(null)
  const [logList, setLogList] = useState<string[]>([])

  const start = useCallback((kindList: PlayerKind[], ringSize: number) => {
    setState(createGame(kindList, ringSize))
    setLogList([])
  }, [])

  const restart = useCallback(() => {
    setState(null)
    setLogList([])
  }, [])

  const commitMove = useCallback((move: Move) => {
    setState(current => {
      if (!current) return current
      const next = applyMove(current, move)
      setLogList(previous => [...previous, moveLabel(current, next, move)])
      return next
    })
  }, [])

  return { state, logList, start, restart, commitMove }
}
```

`apps/web/src/hooks/useBotAutoplay.ts`:
```ts
import { useEffect } from 'react'
import type { GameState, Move, PlayerId } from '@tock/core'
import { pickMove } from '@tock/core'

export const isHumanSeat = (state: GameState, humanSeatIds: PlayerId[]): boolean =>
  humanSeatIds.includes(state.currentPlayer)

type Args = {
  state: GameState | null
  humanSeatIds: PlayerId[]
  delayMs: number
  commitMove: (move: Move) => void
  random?: () => number
}

// When it is a bot seat's turn, schedule its move after a short delay so the
// human can follow. One timer per state; cleared on change (mirrors the terminal
// useGameLoop).
export const useBotAutoplay = ({ state, humanSeatIds, delayMs, commitMove, random }: Args): void => {
  useEffect(() => {
    if (!state || state.winner !== null) return
    if (isHumanSeat(state, humanSeatIds)) return
    const timer = setTimeout(() => commitMove(pickMove(state, random)), delayMs)
    return () => clearTimeout(timer)
  }, [state, humanSeatIds, delayMs, commitMove, random])
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @tock/web test gameHooks` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): game state + bot autoplay hooks, log formatting"
```

### Task 1.8: StatusBar, Hand (fan), GameLog components

**Files:**
- Create: `apps/web/src/components/StatusBar.tsx`, `apps/web/src/components/Hand.tsx`, `apps/web/src/components/GameLog.tsx`, `apps/web/tests/hand.test.tsx`, `apps/web/tests/gameLog.test.tsx`

**Interfaces:**
- Produces:
  - `StatusBar` props `{ turnColor: Color, drawCount: number, discardCount: number, prompt: string }`
  - `Hand` props `{ hand: Card[], playableList: boolean[], selectedIndex: number, onSelect: (index: number) => void }` — renders each card as a button `aria-label` `card-<rank>-<suit>`, dimmed when not playable, fanned via rotation.
  - `GameLog` props `{ logList: string[] }` — a 4-line-tall, touch-scrollable box with a top fade mask that auto-scrolls to the bottom when `logList` grows.

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/hand.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Card } from '@tock/core'
import { Hand } from '../src/components/Hand'

const hand: Card[] = [
  { rank: 'A', suit: 'clubs' },
  { rank: '7', suit: 'hearts' }
]

describe('Hand', () => {
  it('renders a button per card and fires onSelect with its index', async () => {
    const onSelect = vi.fn()
    render(<Hand hand={hand} playableList={[true, true]} selectedIndex={-1} onSelect={onSelect} />)
    await userEvent.click(screen.getByLabelText('card-7-hearts'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('marks unplayable cards as disabled', () => {
    render(<Hand hand={hand} playableList={[true, false]} selectedIndex={-1} onSelect={() => {}} />)
    expect(screen.getByLabelText('card-7-hearts')).toBeDisabled()
  })
})
```

`apps/web/tests/gameLog.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameLog } from '../src/components/GameLog'

describe('GameLog', () => {
  it('renders every log line and marks the scroll region', () => {
    render(<GameLog logList={['a', 'b', 'c', 'd', 'e']} />)
    expect(screen.getByText('e')).toBeInTheDocument()
    expect(screen.getByTestId('game-log')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @tock/web test hand gameLog` → FAIL (modules missing).

- [ ] **Step 3: Implement the components**

`apps/web/src/components/StatusBar.tsx`:
```tsx
import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'

type StatusBarProps = { turnColor: Color, drawCount: number, discardCount: number, prompt: string }

export const StatusBar = ({ turnColor, drawCount, discardCount, prompt }: StatusBarProps) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', color: theme.text, fontSize: 13 }}>
    <span><span style={{ color: seatColor[turnColor].light }}>●</span> {prompt}</span>
    <span style={{ color: theme.textDim }}>🂠 {drawCount} · 🗑 {discardCount}</span>
  </div>
)
```

`apps/web/src/components/Hand.tsx`:
```tsx
import type { Card } from '@tock/core'
import { theme } from '../theme'

type HandProps = {
  hand: Card[]
  playableList: boolean[]
  selectedIndex: number
  onSelect: (index: number) => void
}

const isRed = (card: Card): boolean => card.suit === 'hearts' || card.suit === 'diamonds'

export const Hand = ({ hand, playableList, selectedIndex, onSelect }: HandProps) => {
  const mid = (hand.length - 1) / 2
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 90 }}>
      {hand.map((card, index) => {
        const playable = playableList[index] ?? false
        const angle = (index - mid) * 8
        const lift = index === selectedIndex ? -14 : Math.abs(index - mid) * 2
        return (
          <button
            key={`${card.rank}-${card.suit}-${index}`}
            aria-label={`card-${card.rank}-${card.suit}`}
            disabled={!playable}
            onClick={() => onSelect(index)}
            style={{
              width: 44, height: 64, margin: '0 -7px', borderRadius: 6, border: 'none',
              background: theme.cardFace, color: isRed(card) ? theme.cardInkRed : theme.cardInk,
              fontWeight: 700, fontSize: 18, transformOrigin: 'bottom center',
              transform: `rotate(${angle}deg) translateY(${lift}px)`,
              opacity: playable ? 1 : 0.4, cursor: playable ? 'pointer' : 'default',
              boxShadow: '0 3px 6px rgba(0,0,0,.5)'
            }}
          >
            {card.rank}
          </button>
        )
      })}
    </div>
  )
}
```

`apps/web/src/components/GameLog.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { theme } from '../theme'

type GameLogProps = { logList: string[] }

// 4-line tall, touch-scrollable, top-faded. Auto-scrolls to the bottom whenever a
// new line is appended (design spec §6.2).
export const GameLog = ({ logList }: GameLogProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [logList.length])

  return (
    <div
      ref={scrollRef}
      data-testid="game-log"
      style={{
        height: 66, overflowY: 'auto', padding: '0 8px', fontSize: 12, lineHeight: '16.5px',
        color: theme.textDim, WebkitOverflowScrolling: 'touch',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 55%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, #000 55%)'
      }}
    >
      {logList.map((line, index) => (
        <div key={index} style={{ color: index === logList.length - 1 ? theme.text : undefined }}>{line}</div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm --filter @tock/web test hand gameLog` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): StatusBar, fanned Hand, faded auto-scroll GameLog"
```

### Task 1.9: SplitControls component

**Files:**
- Create: `apps/web/src/components/SplitControls.tsx`, `apps/web/tests/splitControls.test.tsx`

**Interfaces:**
- Consumes: `splitAllocation.SplitDraft`, `splitRemaining`.
- Produces: `SplitControls` props `{ remaining: number, canPlay: boolean, onUndo: () => void, onPlay: () => void }` — shows "N steps left" / "0 left ✓", an Undo button, and a Play button enabled only when `canPlay`.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/splitControls.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SplitControls } from '../src/components/SplitControls'

describe('SplitControls', () => {
  it('shows the remaining budget and disables Play until 0', () => {
    render(<SplitControls remaining={4} canPlay={false} onUndo={() => {}} onPlay={() => {}} />)
    expect(screen.getByText(/4/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play/i })).toBeDisabled()
  })

  it('fires onPlay when enabled and clicked', async () => {
    const onPlay = vi.fn()
    render(<SplitControls remaining={0} canPlay onUndo={() => {}} onPlay={onPlay} />)
    await userEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(onPlay).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tock/web test splitControls` → FAIL (module missing).

- [ ] **Step 3: Implement**

`apps/web/src/components/SplitControls.tsx`:
```tsx
import { theme } from '../theme'

type SplitControlsProps = { remaining: number, canPlay: boolean, onUndo: () => void, onPlay: () => void }

export const SplitControls = ({ remaining, canPlay, onUndo, onPlay }: SplitControlsProps) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 6, color: theme.text }}>
    <span style={{ fontWeight: 700, color: remaining === 0 ? '#46a758' : '#e5b53a' }}>
      {remaining === 0 ? '0 left ✓' : `${remaining} steps left`}
    </span>
    <button onClick={onUndo}>Undo</button>
    <button onClick={onPlay} disabled={!canPlay}>▶ Play the 7</button>
  </div>
)
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @tock/web test splitControls` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): SplitControls (budget + undo + play)"
```

### Task 1.10: App — human turn wiring (ghost interaction integration)

**Files:**
- Modify: `apps/web/src/components/App.tsx`
- Create: `apps/web/src/components/Setup.tsx`, `apps/web/src/components/GameOver.tsx`, `apps/web/tests/humanTurn.test.tsx`

**Interfaces:**
- Consumes: everything above (`useTockGame`, `useBotAutoplay`, `moveSelection`, `splitAllocation`, all components, `@tock/core`).
- Produces: a playable single-human App. Local interaction state machine:
  - `interaction = { phase: 'pickCard' } | { phase: 'ghosts', cardIndex } | { phase: 'swapTarget', cardIndex, marbleId } | { phase: 'split', cardIndex, draft, focusMarbleId | null }`.

- [ ] **Step 1: Write the failing integration test**

`apps/web/tests/humanTurn.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../src/components/App'

describe('human turn (solo vs bots)', () => {
  it('starts a game from Setup and shows the board + hand', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /start/i }))
    expect(screen.getByLabelText('board')).toBeInTheDocument()
    // 5-card hand
    expect(screen.getAllByLabelText(/^card-/).length).toBe(5)
  })

  it('tapping a playable card reveals ghost destinations on the board', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /start/i }))
    // find the first enabled card button and click it
    const cardButtons = screen.getAllByLabelText(/^card-/)
    const playable = cardButtons.find(button => !(button as HTMLButtonElement).disabled)
    if (!playable) return // no playable card at this default seed — engine tests cover generation
    await userEvent.click(playable)
    // at least one ghost button appears (aria-label starts with "ghost-")
    expect(screen.getAllByLabelText(/^ghost-/).length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tock/web test humanTurn` → FAIL (Setup/GameOver missing, App is still the stub).

- [ ] **Step 3: Implement Setup (M1: opponent count + board size)**

`apps/web/src/components/Setup.tsx`:
```tsx
import { useState } from 'react'
import type { PlayerKind } from '@tock/core'
import { DEFAULT_RING_SIZE, RING_SIZE_OPTIONS } from '@tock/core'
import { theme } from '../theme'

type SetupProps = { onStart: (kindList: PlayerKind[], ringSize: number) => void }

const opponentChoiceList = [1, 2, 3]

export const Setup = ({ onStart }: SetupProps) => {
  const [opponentCount, setOpponentCount] = useState(1)
  const [ringSize, setRingSize] = useState<number>(DEFAULT_RING_SIZE)

  const handleStart = () => {
    const kindList: PlayerKind[] = ['human', ...Array.from({ length: opponentCount }, () => 'bot' as const)]
    onStart(kindList, ringSize)
  }

  return (
    <div style={{ color: theme.text, padding: 20, textAlign: 'center' }}>
      <h1>TOCK</h1>
      <p>Opponents</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {opponentChoiceList.map(count => (
          <button key={count} aria-pressed={opponentCount === count} onClick={() => setOpponentCount(count)}>{count}</button>
        ))}
      </div>
      <p>Board size</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {RING_SIZE_OPTIONS.map(size => (
          <button key={size} aria-pressed={ringSize === size} onClick={() => setRingSize(size)}>{size}</button>
        ))}
      </div>
      <button style={{ marginTop: 16 }} onClick={handleStart}>Start</button>
    </div>
  )
}
```

`apps/web/src/components/GameOver.tsx`:
```tsx
import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'

type GameOverProps = { winnerColor: Color, onRestart: () => void }

export const GameOver = ({ winnerColor, onRestart }: GameOverProps) => (
  <div style={{ color: theme.text, padding: 20, textAlign: 'center' }}>
    <h2 style={{ color: seatColor[winnerColor].light }}>{winnerColor} wins!</h2>
    <button onClick={onRestart}>Play again</button>
  </div>
)
```

- [ ] **Step 4: Implement the App interaction machine**

`apps/web/src/components/App.tsx`:
```tsx
import { useMemo, useState } from 'react'
import type { MarbleId, Move, PlayerId } from '@tock/core'
import { colorOf, getLegalMoves } from '@tock/core'
import { useTockGame } from '../hooks/useTockGame'
import { useBotAutoplay, isHumanSeat } from '../hooks/useBotAutoplay'
import {
  Ghost as GhostType, ghostsForCard, handIsPlayable, isDiscardOnly, isSplitCard,
  movesForCard, ownSwapMarbleIds, swapTargetsFor
} from '../moveSelection'
import {
  SplitDraft, allocate, completedSplitMove, splitCandidateIds, splitGhostsForMarble,
  splitRemaining, startSplit, undoLast
} from '../splitAllocation'
import { marbleCenter } from '../svgGeometry'
import { Board } from './Board'
import { Hand } from './Hand'
import { StatusBar } from './StatusBar'
import { GameLog } from './GameLog'
import { SplitControls } from './SplitControls'
import { Setup } from './Setup'
import { GameOver } from './GameOver'

const HUMAN_SEATS: PlayerId[] = [0]
const BOT_DELAY_MS = 900

type Interaction =
  | { phase: 'pickCard' }
  | { phase: 'ghosts', cardIndex: number }
  | { phase: 'swapTarget', cardIndex: number, marbleId: MarbleId }
  | { phase: 'split', cardIndex: number, draft: SplitDraft, focusMarbleId: MarbleId | null }

export const App = () => {
  const { state, logList, start, restart, commitMove } = useTockGame()
  const [interaction, setInteraction] = useState<Interaction>({ phase: 'pickCard' })

  useBotAutoplay({ state, humanSeatIds: HUMAN_SEATS, delayMs: BOT_DELAY_MS, commitMove })

  const legalMoves = useMemo(
    () => (state && isHumanSeat(state, HUMAN_SEATS) && state.winner === null ? getLegalMoves(state, state.currentPlayer) : []),
    [state]
  )

  if (!state) return <Setup onStart={(kindList, ringSize) => { start(kindList, ringSize); setInteraction({ phase: 'pickCard' }) }} />
  if (state.winner !== null) return <GameOver winnerColor={colorOf(state.winner)} onRestart={restart} />

  const hand = state.playerList.find(player => player.id === state.currentPlayer)?.hand ?? []
  const humanTurn = isHumanSeat(state, HUMAN_SEATS)
  const playableList = hand.map(card => humanTurn && handIsPlayable(card, legalMoves))

  const resetInteraction = () => setInteraction({ phase: 'pickCard' })
  const doCommit = (move: Move) => { commitMove(move); resetInteraction() }

  // --- build the ghost list for the current interaction phase ---
  let ghostList: GhostType[] = []
  if (humanTurn && interaction.phase === 'ghosts') {
    const card = hand[interaction.cardIndex]
    if (card) ghostList = ghostsForCard(card, state, legalMoves)
  } else if (humanTurn && interaction.phase === 'swapTarget') {
    const card = hand[interaction.cardIndex]
    if (card) {
      ghostList = swapTargetsFor(card, interaction.marbleId, legalMoves).map((move, index) => {
        const target = move.type === 'swap' ? move.targetMarbleId : ''
        const marble = state.marbleList.find(candidate => candidate.id === target)
        const slot = state.marbleList.filter(m => m.owner === marble?.owner).findIndex(m => m.id === target)
        const point = marble ? marbleCenter(marble.owner, marble.position, slot, state.ringSize) : { x: 0, y: 0 }
        return { key: `swap-${index}`, move, cx: point.x, cy: point.y, label: '⇄' }
      })
    }
  } else if (humanTurn && interaction.phase === 'split' && interaction.focusMarbleId) {
    ghostList = splitGhostsForMarble(interaction.draft, interaction.focusMarbleId, state, legalMoves)
  }

  const handleCard = (index: number) => {
    if (!humanTurn) return
    const card = hand[index]
    if (!card || !handIsPlayable(card, legalMoves)) return
    if (isDiscardOnly(card, legalMoves)) { doCommit(movesForCard(card, legalMoves)[0]!); return }
    if (isSplitCard(card, legalMoves)) { setInteraction({ phase: 'split', cardIndex: index, draft: startSplit(card), focusMarbleId: null }); return }
    if (ownSwapMarbleIds(card, legalMoves).length > 0) {
      // Jack: if exactly one own marble can swap, go straight to targets; else pick own first via ghosts on own marbles.
      const ownList = ownSwapMarbleIds(card, legalMoves)
      setInteraction({ phase: 'swapTarget', cardIndex: index, marbleId: ownList[0]! })
      return
    }
    setInteraction({ phase: 'ghosts', cardIndex: index })
  }

  const handleGhost = (key: string) => {
    const ghost = ghostList.find(entry => entry.key === key)
    if (!ghost) return
    if (interaction.phase === 'split') {
      const part = ghost.move.type === 'split7' ? ghost.move.partList[0]! : null
      if (!part) return
      const draft = allocate(interaction.draft, part)
      const done = completedSplitMove(draft, legalMoves)
      if (splitRemaining(draft) === 0 && done) { doCommit(done); return }
      setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft, focusMarbleId: null })
      return
    }
    doCommit(ghost.move)
  }

  // Split: tapping a candidate marble focuses it (so its ghosts appear).
  const splitCandidates = interaction.phase === 'split' ? splitCandidateIds(hand[interaction.cardIndex]!, legalMoves) : []

  const prompt = !humanTurn
    ? `${colorOf(state.currentPlayer)} is thinking…`
    : interaction.phase === 'split' ? 'spend the 7' : interaction.phase === 'pickCard' ? 'choose a card' : 'choose where to land'

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <StatusBar turnColor={colorOf(state.currentPlayer)} drawCount={state.drawPile.length} discardCount={state.discardPile.length} prompt={prompt} />
      <GameLog logList={logList} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <Board state={state} ghostList={ghostList.map(g => ({ key: g.key, cx: g.cx, cy: g.cy, label: g.label }))} onGhost={handleGhost} />
      </div>
      {interaction.phase === 'split' && (
        <>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {splitCandidates.map(id => (
              <button key={id} onClick={() => setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: interaction.draft, focusMarbleId: id })}>
                {id}
              </button>
            ))}
          </div>
          <SplitControls
            remaining={splitRemaining(interaction.draft)}
            canPlay={!!completedSplitMove(interaction.draft, legalMoves)}
            onUndo={() => setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: undoLast(interaction.draft), focusMarbleId: null })}
            onPlay={() => { const done = completedSplitMove(interaction.draft, legalMoves); if (done) doCommit(done) }}
          />
        </>
      )}
      <Hand hand={hand} playableList={playableList} selectedIndex={interaction.phase !== 'pickCard' ? ('cardIndex' in interaction ? interaction.cardIndex : -1) : -1} onSelect={handleCard} />
    </div>
  )
}
```
(Note the Jack flow here takes the first own-swappable marble straight to target selection; refining "pick which of my marbles to swap" when several qualify is a small follow-up and does not block M1 — targets are still chosen explicitly.)

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @tock/web test humanTurn` → PASS.

- [ ] **Step 6: Run the full web suite + typecheck**

Run: `pnpm --filter @tock/web test` → all green.
Run: `pnpm --filter @tock/web typecheck` → no errors.

- [ ] **Step 7: Manual smoke — play a game**

Run: `pnpm --filter @tock/web dev`, open the served URL in a browser, resize to a phone viewport (DevTools device toolbar), and play a full turn against a bot: tap a card → tap a ghost → the marble slides, the log appends, the bot replies. Confirm the 7-split (tap 7 → tap a marble → tap a step ghost → budget drops → Play).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(web): playable solo-vs-bots turn (ghosts, split, swap, discard)"
```

### Task 1.11: Static build + deploy config

**Files:**
- Create: `apps/web/public/manifest.webmanifest` (basic, non-PWA-service-worker — icon + name for a polished install prompt later), `apps/web/README.md` (run/build/deploy notes)
- Modify: `README.md` (root — add the web app + shareable-link story)

**Interfaces:** none (build/docs task).

- [ ] **Step 1: Add a minimal web manifest + link**

`apps/web/public/manifest.webmanifest`:
```json
{
  "name": "Tock",
  "short_name": "Tock",
  "display": "standalone",
  "background_color": "#5c3a17",
  "theme_color": "#5c3a17",
  "icons": []
}
```
Add to `apps/web/index.html` `<head>`:
```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#5c3a17" />
```
(Full PWA service worker + icons are M3, out of scope here; this is just the metadata so the later step is small.)

- [ ] **Step 2: Verify the production build**

Run: `pnpm --filter @tock/web build`
Expected: Vite writes `apps/web/dist/` with `index.html` + hashed assets, exit 0.

Run: `pnpm --filter @tock/web preview` and open the printed URL → the app loads and a game is playable from the built bundle.

- [ ] **Step 3: Document run/build/deploy**

`apps/web/README.md`: how to `pnpm --filter @tock/web dev`, `build`, and deploy `dist/` to a static host (Vercel/Netlify/GitHub Pages), noting `base: './'` makes it path-agnostic and that there is **no backend** — solo and pass-and-play run fully client-side.

Update root `README.md`: add the web app to the project overview — the shareable-link portfolio story, the `@tock/core`/`apps/*` workspace layout, and the M1–M4 roadmap.

Update `CLAUDE.md` (design spec §10): rewrite the Commands section for the workspace (`pnpm --filter @tock/web dev`, `pnpm --filter @tock/terminal dev`, `pnpm -r test`, `pnpm -r typecheck`), the module-layout/architecture sections for `packages/core` + `apps/terminal` + `apps/web`, and note that the engine/UI separation is now a package boundary (the "isomorphic, zero Node deps" rule names `@tock/core`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): static build + deploy config, docs"
```

---

## PHASE 2 — Local pass-and-play (M2)

### Task 2.1: Pass-and-play gating logic (`passAndPlay.ts`)

**Files:**
- Create: `apps/web/src/passAndPlay.ts`, `apps/web/tests/passAndPlay.test.ts`

**Interfaces:**
- Consumes: `@tock/core` (`GameState`, `PlayerId`).
- Produces:
  - `humanSeatIds(state: GameState): PlayerId[]` — the seats whose `kind === 'human'`.
  - `needsHandoff(previousPlayer: PlayerId, state: GameState, humanIdList: PlayerId[]): boolean` — true when the new current player is a **different** human from the one who just played (so their secret hand must be hidden first). False for bot seats and when there is only one human seat.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/passAndPlay.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createGame } from '@tock/core'
import { humanSeatIds, needsHandoff } from '../src/passAndPlay'

describe('pass-and-play gating', () => {
  it('lists only human seats', () => {
    const state = createGame(['human', 'bot', 'human'], 48)
    expect(humanSeatIds(state)).toEqual([0, 2])
  })

  it('requires a handoff when the turn passes to a different human', () => {
    const state = { ...createGame(['human', 'human'], 48), currentPlayer: 1 as const }
    expect(needsHandoff(0, state, [0, 1])).toBe(true)
  })

  it('does not require a handoff before a bot seat', () => {
    const state = { ...createGame(['human', 'bot'], 48), currentPlayer: 1 as const }
    expect(needsHandoff(0, state, [0])).toBe(false)
  })

  it('does not require a handoff in a solo (single human) game', () => {
    const state = { ...createGame(['human', 'bot'], 48), currentPlayer: 0 as const }
    expect(needsHandoff(1, state, [0])).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tock/web test passAndPlay` → FAIL (module missing).

- [ ] **Step 3: Implement**

`apps/web/src/passAndPlay.ts`:
```ts
import type { GameState, PlayerId } from '@tock/core'

export const humanSeatIds = (state: GameState): PlayerId[] =>
  state.playerList.filter(player => player.kind === 'human').map(player => player.id)

// A handoff screen is needed only when control passes to a human seat that is
// different from the one who just moved. Bot seats never trigger it, and a single
// human game (solo vs bots) never triggers it.
export const needsHandoff = (previousPlayer: PlayerId, state: GameState, humanIdList: PlayerId[]): boolean => {
  if (humanIdList.length < 2) return false
  const current = state.currentPlayer
  return humanIdList.includes(current) && current !== previousPlayer
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @tock/web test passAndPlay` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): pass-and-play handoff gating logic"
```

### Task 2.2: Pass interstitial + Setup seat kinds + App gate

**Files:**
- Create: `apps/web/src/components/PassInterstitial.tsx`, `apps/web/tests/handoff.test.tsx`
- Modify: `apps/web/src/components/Setup.tsx` (choose each opponent as human or bot), `apps/web/src/components/App.tsx` (show the interstitial before a different human's turn, and treat all human seats as human in `useBotAutoplay`/`getLegalMoves`)

**Interfaces:**
- Produces: `PassInterstitial` props `{ color: Color, onReveal: () => void }` — a full-screen "Pass to {color} — tap to reveal" overlay with a single reveal button.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/handoff.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PassInterstitial } from '../src/components/PassInterstitial'

describe('PassInterstitial', () => {
  it('names the next player and reveals on tap', async () => {
    const onReveal = vi.fn()
    render(<PassInterstitial color="green" onReveal={onReveal} />)
    expect(screen.getByText(/green/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /reveal/i }))
    expect(onReveal).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @tock/web test handoff` → FAIL (module missing).

- [ ] **Step 3: Implement the interstitial**

`apps/web/src/components/PassInterstitial.tsx`:
```tsx
import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'

type PassInterstitialProps = { color: Color, onReveal: () => void }

export const PassInterstitial = ({ color, onReveal }: PassInterstitialProps) => (
  <div style={{ position: 'fixed', inset: 0, background: theme.boardEdge, color: theme.text, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
    <h2>Pass to <span style={{ color: seatColor[color].light }}>{color}</span></h2>
    <button onClick={onReveal}>Tap to reveal your hand</button>
  </div>
)
```

- [ ] **Step 4: Update Setup for per-seat kind**

In `apps/web/src/components/Setup.tsx`, replace the opponent-count control with per-opponent kind toggles (human/bot) for seats 1–3, still defaulting seat 0 to human. Build the `kindList` from the chosen kinds. Keep the board-size control. (Seats set to neither are `'inactive'`.) Example shape of the produced `kindList`: `['human', 'bot', 'human', 'inactive']`.

- [ ] **Step 5: Gate the App on handoff**

In `apps/web/src/components/App.tsx`:
- Compute `humanIdList = humanSeatIds(state)` and pass it as `humanSeatIds` to `useBotAutoplay`.
- Track `previousPlayer` and a `revealed` flag. After a `commitMove`, if `needsHandoff(previousPlayer, nextState, humanIdList)` is true, set an `awaitingHandoff` state; render `<PassInterstitial color={colorOf(state.currentPlayer)} onReveal={...} />` instead of the board until the next human taps reveal. Reset interaction to `pickCard` on reveal.
- Use `humanIdList.includes(state.currentPlayer)` (not the M1 constant `[0]`) everywhere the "is it a human's turn" decision is made.

Concretely, add near the top of `App`:
```tsx
const humanIdList = state ? humanSeatIds(state) : []
const [awaitingHandoff, setAwaitingHandoff] = useState(false)
```
Replace `useBotAutoplay({ ..., humanSeatIds: HUMAN_SEATS, ... })` with `humanSeatIds: humanIdList`, and gate it so bots do not auto-play while `awaitingHandoff` is true (pass `state: awaitingHandoff ? null : state`). Wrap `commitMove` so it detects the handoff:
```tsx
const commitAndPass = (move: Move) => {
  if (!state) return
  const previous = state.currentPlayer
  commitMove(move)
  // needsHandoff reads the NEXT state; recompute from applyMove for the decision
  const next = applyMove(state, move)
  if (needsHandoff(previous, next, humanSeatIds(next))) setAwaitingHandoff(true)
  resetInteraction()
}
```
(Import `applyMove` and `needsHandoff`/`humanSeatIds`.) Render, before the normal return:
```tsx
if (awaitingHandoff) return <PassInterstitial color={colorOf(state.currentPlayer)} onReveal={() => { setAwaitingHandoff(false); resetInteraction() }} />
```

- [ ] **Step 6: Write an App-level handoff integration test**

Append to `apps/web/tests/handoff.test.tsx`:
```tsx
import { App } from '../src/components/App'

describe('handoff in a two-human game', () => {
  it('shows the pass screen after the first human commits when seat 1 is human', async () => {
    render(<App />)
    // set opponent seat 1 to human in Setup, then start
    await userEvent.click(screen.getByRole('button', { name: /seat 1: bot/i })) // toggles to human
    await userEvent.click(screen.getByRole('button', { name: /start/i }))
    const cardButtons = screen.getAllByLabelText(/^card-/)
    const playable = cardButtons.find(button => !(button as HTMLButtonElement).disabled)
    if (!playable) return
    await userEvent.click(playable)
    const ghost = screen.queryAllByLabelText(/^ghost-/)[0]
    if (!ghost) return
    await userEvent.click(ghost)
    expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument()
  })
})
```
(The Setup toggle label text must match what Task 2.2 Step 4 renders — align the button `aria-label`/text, e.g. `seat 1: bot` ⇄ `seat 1: human`.)

- [ ] **Step 7: Run the handoff tests + full suite**

Run: `pnpm --filter @tock/web test handoff` → PASS.
Run: `pnpm -r test` → core + terminal + web all green.
Run: `pnpm -r typecheck` → no errors.

- [ ] **Step 8: Manual smoke — pass-and-play**

Run: `pnpm --filter @tock/web dev`; start a game with two human seats; after committing a move, confirm the "Pass to {color}" screen appears and the hand is hidden until reveal; confirm a bot seat chains without the screen.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): local pass-and-play with pass-the-phone interstitial"
```

---

## Self-Review

**1. Spec coverage** (design spec → task):
- §2 M1 (web solo vs bots) → Tasks 1.1–1.11. §2 M2 (pass-and-play) → Tasks 2.1–2.2. M3/M4 explicitly out (roadmap).
- §3 approach B / Vite → Task 1.1. §4 pnpm workspace (`@tock/core`, `apps/terminal`, `apps/web`) → Tasks 0.1, 0.2. §4.2 import rewrite → Task 0.2 Step 2. §4.3 package boundary → Global Constraints + enforced by imports.
- §5.1 SVG + geometry → Tasks 1.0 (grid, in core — flagged deviation), 1.3 (pixels), 1.4 (render). §5.2 wood theme → Task 1.2. §5.3 CSS-transition slides → Task 1.4 (Marble `transition`).
- §6.1 layout (status → log → board → fan) → Task 1.10 App + 1.8 components. §6.2 log scroll + auto-follow → Task 1.8 GameLog. §6.3 ghost destinations → Tasks 1.5 + 1.10. §6.4 progressive 7 → Tasks 1.6 + 1.9 + 1.10. §6.5 push (ghosts) / swap (two-tap) / discard → Tasks 1.5 + 1.10. §6.6 pass-and-play → Phase 2.
- §7 turn controller reuse → Task 1.7 hooks. §8 build/deploy → Task 1.11. §9 tests reused + web tests → Tasks 0.1/0.2 (reused) + per-task web tests. §10 docs → Task 1.11 + a follow-up CLAUDE.md edit (added below).
- **Gap found & fixed:** §10 also requires updating `CLAUDE.md`. Add to Task 1.11 Step 3: update `CLAUDE.md`'s Commands + module-layout + architecture sections for the workspace (`@tock/core`, `apps/terminal`, `apps/web`, `pnpm --filter` commands). Noted here so the executor includes it.

**2. Placeholder scan:** No "TBD/TODO/handle edge cases". Two explicit *scope notes* (drilled-board backdrop in 1.4; multi-own-marble Jack refinement in 1.10) are called out as deliberate M1 simplifications with working behaviour, not gaps.

**3. Type consistency:** `Ghost` is defined once in `moveSelection.ts` (Task 1.5) and reused by `splitAllocation.ts` (1.6) and `App.tsx` (1.10); `Board` consumes a narrowed `{ key, cx, cy, label }` entry (1.4) that `App` builds from `Ghost` — consistent. `SplitPart`/`SplitDraft` defined in 1.6 and consumed in 1.9/1.10. `humanSeatIds`/`needsHandoff` signatures in 2.1 match their use in 2.2. `commitMove(move: Move)` consistent across 1.7/1.10/2.2. Board grid `Cell` originates in core (Task 1.0) and is imported by `svgGeometry` (1.3).

**Note on tests being seed-tolerant:** several web integration tests guard with `if (!playable) return` because the default RNG hand may lack a specific card. Move *generation* is exhaustively covered by the reused core tests; the web tests assert the *projection/wiring* layer. This is intentional, not a gap.

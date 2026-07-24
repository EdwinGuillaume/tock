# Finish-Lane Entry Effect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play a small, tasteful board effect — a golden thread flare, a white comet gliding down the lane, and a gold echo on the landing cell — whenever a marble enters its finish lane in the web app.

**Architecture:** A pure `laneEntries(before, after)` diff detects marbles whose `position.zone` became `finish`. A presentation-layer hook (`useLaneEntryFx`) watches committed states, surfaces short-lived entries, and drops them after a fixed lifetime. A `LaneEntryFx` SVG component renders the CSS-animated effect, mounted inside the board `<svg>` by `Board.tsx`. `@tock/core` and `apps/terminal` are untouched.

**Tech Stack:** TypeScript (strict), React 19, Vite, Vitest + @testing-library/react + jsdom, CSS keyframes. SVG geometry via `@tock/core` + `apps/web/src/svgGeometry.ts`.

## Global Constraints

- **Package scope:** all changes are in `apps/web` only. `@tock/core` and `apps/terminal` MUST NOT change.
- **Node version:** the project needs Node ≥ 22; non-interactive shells default to Node 18. **Prefix every `pnpm`/`node` command** with `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; ` (already baked into every command below). Pass this instruction to any subagent that runs tests/typecheck.
- **Code style:** no semicolons, no trailing commas; no `function` keyword (const arrow functions only); **no non-null assertions (`!`) in production code** (tests may use `!`); all identifiers/comments in English.
- **Naming:** camelCase; collections use a `List` suffix, never a plural (`entryList`, not `entries`); handlers use a `handle` prefix.
- **Determinism:** no `Math.random`, no `Date.now`, no argless `new Date()` (banned repo-wide). Unique keys come from a monotonic `useRef` counter.
- **Reduced motion:** the effect MUST NOT animate under `prefers-reduced-motion: reduce` (guarded in the hook; also covered by the existing global `* { animation: none }` rule).
- **Testing:** Vitest, one file per feature under `apps/web/tests/`, building `GameState` via the existing `apps/web/tests/support.ts` rig (`place`, `card`, `setHand`). Marble ids are `p{player}m{index}` (e.g. `p0m0`).

## File Structure

- **Create `apps/web/src/laneFx.ts`** — pure `laneEntries(before, after): LaneEntry[]` + `LaneEntry` type. The detection crux.
- **Create `apps/web/src/hooks/useLaneEntryFx.ts`** — `useLaneEntryFx(state): ActiveLaneEntry[]` + `ActiveLaneEntry` type. Transient event lifecycle (diff on state change, timed removal, reduced-motion guard).
- **Create `apps/web/src/components/LaneEntryFx.tsx`** — one arrival rendered as an SVG fragment (glow line + comet group + echo rings).
- **Modify `apps/web/src/motion.ts`** — add `laneEntryFxMs` (effect lifetime in ms).
- **Modify `apps/web/src/index.css`** — add `tock-lane-glow` / `tock-lane-comet` / `tock-lane-echo` keyframes + classes.
- **Modify `apps/web/src/components/Board.tsx`** — add the `<filter id="lane-soft">` def, call the hook, render the effect layer between the backdrop and the marbles.
- **Create tests:** `apps/web/tests/laneFx.test.ts`, `apps/web/tests/useLaneEntryFx.test.tsx`, `apps/web/tests/laneEntryFx.test.tsx`, `apps/web/tests/boardLaneFx.test.tsx`.

---

### Task 1: `laneEntries` — pure detection

**Files:**
- Create: `apps/web/src/laneFx.ts`
- Test: `apps/web/tests/laneFx.test.ts`

**Interfaces:**
- Consumes: `GameState`, `MarbleId`, `PlayerId` from `@tock/core`; `place` from `tests/support.ts`.
- Produces: `type LaneEntry = { marbleId: MarbleId, owner: PlayerId, finishIndex: number }` and `laneEntries(before: GameState, after: GameState): LaneEntry[]`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/laneFx.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createGame } from '@tock/core'
import { laneEntries } from '../src/laneFx'
import { place } from './support'

describe('laneEntries', () => {
  const base = createGame(['human', 'bot', 'bot', 'bot'], 48)

  it('detects a marble crossing from the ring into the finish lane', () => {
    const before = place(base, 'p0m0', { zone: 'track', index: 10 })
    const after = place(before, 'p0m0', { zone: 'finish', index: 0 })
    expect(laneEntries(before, after)).toEqual([{ marbleId: 'p0m0', owner: 0, finishIndex: 0 }])
  })

  it('detects two marbles entering at once (a 7 split across two marbles)', () => {
    const staged = place(place(base, 'p0m0', { zone: 'track', index: 10 }), 'p0m1', { zone: 'track', index: 12 })
    const after = place(place(staged, 'p0m0', { zone: 'finish', index: 0 }), 'p0m1', { zone: 'finish', index: 1 })
    expect(laneEntries(staged, after)).toHaveLength(2)
  })

  it('ignores a marble moving deeper WITHIN the finish lane', () => {
    const before = place(base, 'p0m0', { zone: 'finish', index: 1 })
    const after = place(before, 'p0m0', { zone: 'finish', index: 3 })
    expect(laneEntries(before, after)).toEqual([])
  })

  it('ignores a marble that stays on the ring', () => {
    const before = place(base, 'p0m0', { zone: 'track', index: 10 })
    const after = place(before, 'p0m0', { zone: 'track', index: 14 })
    expect(laneEntries(before, after)).toEqual([])
  })

  it('ignores a captured marble sent home (home is not finish)', () => {
    const before = place(base, 'p0m0', { zone: 'track', index: 10 })
    const after = place(before, 'p0m0', { zone: 'home' })
    expect(laneEntries(before, after)).toEqual([])
  })

  it('detects a bot-owned marble entering its lane', () => {
    const before = place(base, 'p1m0', { zone: 'track', index: 20 })
    const after = place(before, 'p1m0', { zone: 'finish', index: 0 })
    expect(laneEntries(before, after)).toEqual([{ marbleId: 'p1m0', owner: 1, finishIndex: 0 }])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/laneFx.test.ts`
Expected: FAIL — `Failed to resolve import "../src/laneFx"` (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `apps/web/src/laneFx.ts`:

```ts
import type { GameState, MarbleId, PlayerId } from '@tock/core'

export type LaneEntry = { marbleId: MarbleId, owner: PlayerId, finishIndex: number }

// Marbles whose position.zone went from a non-finish zone to 'finish' between
// `before` and `after` — i.e. they crossed the lane mouth into the couloir.
// Move-type agnostic (works for a plain move, a 7-split part, or any future
// path in) and seat-agnostic (fires for human and bot marbles alike), because
// it reads only the state transition, not the Move or whose turn it is.
export const laneEntries = (before: GameState, after: GameState): LaneEntry[] => {
  const result: LaneEntry[] = []
  for (const marble of before.marbleList) {
    if (marble.position.zone === 'finish') continue
    const post = after.marbleList.find(candidate => candidate.id === marble.id)
    if (post && post.position.zone === 'finish') {
      result.push({ marbleId: marble.id, owner: marble.owner, finishIndex: post.position.index })
    }
  }
  return result
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/laneFx.test.ts`
Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/laneFx.ts apps/web/tests/laneFx.test.ts
git commit -m "feat(web): laneEntries — detect finish-lane crossings by state diff"
```

---

### Task 2: `LaneEntryFx` component + CSS keyframes

**Files:**
- Create: `apps/web/src/components/LaneEntryFx.tsx`
- Modify: `apps/web/src/index.css` (append keyframes + classes)
- Test: `apps/web/tests/laneEntryFx.test.tsx`

**Interfaces:**
- Consumes: `PlayerId`, `finishCoord` from `@tock/core`; `cellCenter`, `finishThread` from `../svgGeometry`; `theme` from `../theme`; `CSSProperties` from `react`. Relies on the consumer (Board, Task 4) providing `<filter id="lane-soft">` in the board `<defs>`.
- Produces: `LaneEntryFx` component with props `{ owner: PlayerId, finishIndex: number, ringSize: number }`. Renders test hooks `data-testid="lane-fx-${owner}-${finishIndex}"` (wrapper), `lane-fx-glow`, `lane-fx-comet`, `lane-fx-echo`. Uses CSS classes `tock-lane-glow`, `tock-lane-comet`, `tock-lane-echo`, `tock-lane-echo--b`, and consumes CSS custom properties `--lx` / `--ly` (comet travel vector).

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/laneEntryFx.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LaneEntryFx } from '../src/components/LaneEntryFx'

describe('LaneEntryFx', () => {
  it('renders the glow, comet and echo for the given seat and finish cell', () => {
    const { getByTestId } = render(<svg><LaneEntryFx owner={0} finishIndex={0} ringSize={48} /></svg>)
    expect(getByTestId('lane-fx-0-0')).toBeInTheDocument()
    expect(getByTestId('lane-fx-glow')).toBeInTheDocument()
    expect(getByTestId('lane-fx-comet')).toBeInTheDocument()
    expect(getByTestId('lane-fx-echo')).toBeInTheDocument()
  })

  it('sets the comet travel vector as CSS custom properties', () => {
    const { getByTestId } = render(<svg><LaneEntryFx owner={0} finishIndex={0} ringSize={48} /></svg>)
    const comet = getByTestId('lane-fx-comet')
    expect(comet.style.getPropertyValue('--lx')).not.toBe('')
    expect(comet.style.getPropertyValue('--ly')).not.toBe('')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/laneEntryFx.test.tsx`
Expected: FAIL — `Failed to resolve import "../src/components/LaneEntryFx"`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/LaneEntryFx.tsx`:

```tsx
import type { CSSProperties } from 'react'
import type { PlayerId } from '@tock/core'
import { finishCoord } from '@tock/core'
import { cellCenter, finishThread } from '../svgGeometry'
import { theme } from '../theme'

type LaneEntryFxProps = { owner: PlayerId, finishIndex: number, ringSize: number }

// Transient finish-lane entry effect, embedded inside the board <svg> (it relies
// on the shared <filter id="lane-soft"> defined by Board). A golden thread flare
// over the seat's finish thread, a white comet gliding from the mouth toward the
// nest, and two gold echo rings on the landing cell. All motion is CSS (see
// index.css); this component only positions the elements. The comet's outer group
// is statically positioned at the mouth so its inner group is free to animate its
// own transform (translate by the mouth->stop vector, passed as --lx/--ly).
export const LaneEntryFx = ({ owner, finishIndex, ringSize }: LaneEntryFxProps) => {
  const { mouth, stop } = finishThread(owner, ringSize)
  const landing = cellCenter(finishCoord(owner, finishIndex, ringSize))
  const cometStyle = { '--lx': `${stop.x - mouth.x}px`, '--ly': `${stop.y - mouth.y}px` } as CSSProperties
  return (
    <g data-testid={`lane-fx-${owner}-${finishIndex}`}>
      <line
        data-testid="lane-fx-glow"
        className="tock-lane-glow"
        x1={mouth.x} y1={mouth.y} x2={stop.x} y2={stop.y}
        stroke={theme.gold} strokeWidth={1.8} strokeLinecap="round" filter="url(#lane-soft)"
      />
      <g style={{ transform: `translate(${mouth.x}px, ${mouth.y}px)` }}>
        <g data-testid="lane-fx-comet" className="tock-lane-comet" style={cometStyle}>
          <circle cx={0} cy={0} r={2.4} fill="#fffaf0" filter="url(#lane-soft)" />
          <circle cx={0} cy={0} r={1.1} fill="#ffffff" />
        </g>
      </g>
      <g data-testid="lane-fx-echo" style={{ transform: `translate(${landing.x}px, ${landing.y}px)` }}>
        <circle className="tock-lane-echo" cx={0} cy={0} r={3.6} fill="none" stroke={theme.gold} strokeWidth={0.9} />
        <circle className="tock-lane-echo tock-lane-echo--b" cx={0} cy={0} r={3.6} fill="none" stroke="#ffe6a0" strokeWidth={0.6} />
      </g>
    </g>
  )
}
```

- [ ] **Step 4: Append the keyframes + classes to `apps/web/src/index.css`**

Add at the end of the file (the existing `@media (prefers-reduced-motion: reduce) { * { animation: none !important … } }` rule uses `!important`, so it disables these regardless of source order):

```css
/* ---- finish-lane entry effect (mounted transiently by useLaneEntryFx) ---- */
@keyframes tock-lane-glow { 0% { opacity: 0 } 22% { opacity: .9 } 100% { opacity: 0 } }
@keyframes tock-lane-comet { 0% { transform: translate(0,0); opacity: 0 } 16% { opacity: 1 } 100% { transform: translate(var(--lx), var(--ly)); opacity: 0 } }
@keyframes tock-lane-echo { 0% { transform: scale(.45); opacity: .85 } 100% { transform: scale(1.9); opacity: 0 } }

.tock-lane-glow { animation: tock-lane-glow 1.4s ease-out both; }
.tock-lane-comet { animation: tock-lane-comet 1s cubic-bezier(.35,0,.5,1) both; }
.tock-lane-echo { animation: tock-lane-echo .8s ease-out .24s both; transform-box: fill-box; transform-origin: center; }
.tock-lane-echo--b { animation-delay: .42s; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/laneEntryFx.test.tsx`
Expected: PASS — 2 tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/LaneEntryFx.tsx apps/web/src/index.css apps/web/tests/laneEntryFx.test.tsx
git commit -m "feat(web): LaneEntryFx component + lane-entry CSS keyframes"
```

---

### Task 3: `useLaneEntryFx` hook + motion token

**Files:**
- Create: `apps/web/src/hooks/useLaneEntryFx.ts`
- Modify: `apps/web/src/motion.ts` (add `laneEntryFxMs`)
- Test: `apps/web/tests/useLaneEntryFx.test.tsx`

**Interfaces:**
- Consumes: `laneEntries` + `LaneEntry` from `../laneFx` (Task 1); `prefersReducedMotion` from `../motion`; `GameState`, `PlayerId` from `@tock/core`.
- Produces: `type ActiveLaneEntry = { key: string, owner: PlayerId, finishIndex: number }` and `useLaneEntryFx(state: GameState): ActiveLaneEntry[]`. Also `export const laneEntryFxMs = 1600` in `motion.ts`.

- [ ] **Step 1: Add the motion token**

Append to `apps/web/src/motion.ts`:

```ts
// Lifetime (ms) of the finish-lane entry effect: how long an entry stays mounted
// before useLaneEntryFx removes it. Covers its longest sub-animation (~1.4s).
export const laneEntryFxMs = 1600
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/tests/useLaneEntryFx.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameState } from '@tock/core'
import { createGame } from '@tock/core'
import { useLaneEntryFx } from '../src/hooks/useLaneEntryFx'
import { place } from './support'

const setMatch = (matches: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {} }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const base = createGame(['human', 'bot'], 48)
const onTrack: GameState = place(base, 'p0m0', { zone: 'track', index: 10 })
const inFinish: GameState = place(onTrack, 'p0m0', { zone: 'finish', index: 0 })

describe('useLaneEntryFx', () => {
  it('surfaces an active entry on lane crossing, then clears it after the lifetime', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ state }: { state: GameState }) => useLaneEntryFx(state),
      { initialProps: { state: onTrack } }
    )
    expect(result.current).toHaveLength(0)
    act(() => rerender({ state: inFinish }))
    expect(result.current).toHaveLength(1)
    expect(result.current[0]!).toMatchObject({ owner: 0, finishIndex: 0 })
    act(() => { vi.advanceTimersByTime(1600) })
    expect(result.current).toHaveLength(0)
  })

  it('yields nothing under prefers-reduced-motion', () => {
    setMatch(true)
    const { result, rerender } = renderHook(
      ({ state }: { state: GameState }) => useLaneEntryFx(state),
      { initialProps: { state: onTrack } }
    )
    act(() => rerender({ state: inFinish }))
    expect(result.current).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/useLaneEntryFx.test.tsx`
Expected: FAIL — `Failed to resolve import "../src/hooks/useLaneEntryFx"`.

- [ ] **Step 4: Write the hook**

Create `apps/web/src/hooks/useLaneEntryFx.ts`:

```ts
import { useEffect, useRef, useState } from 'react'
import type { GameState, PlayerId } from '@tock/core'
import { laneEntries } from '../laneFx'
import { laneEntryFxMs, prefersReducedMotion } from '../motion'

export type ActiveLaneEntry = { key: string, owner: PlayerId, finishIndex: number }

// Watches committed game states and surfaces a short-lived list of finish-lane
// entries to animate. Detection is a pure before/after diff (see laneEntries),
// so it fires for any seat (human or bot) and any move type. Yields nothing
// under prefers-reduced-motion. Keys come from a monotonic counter (no
// Math.random / Date.now, which are banned for determinism). Each entry is
// removed after laneEntryFxMs so the transient SVG unmounts once it has played.
export const useLaneEntryFx = (state: GameState): ActiveLaneEntry[] => {
  const [activeList, setActiveList] = useState<ActiveLaneEntry[]>([])
  const prevRef = useRef<GameState | null>(null)
  const counterRef = useRef(0)
  const timerListRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = state
    if (!prev || prefersReducedMotion()) return
    const entryList = laneEntries(prev, state)
    if (entryList.length === 0) return
    const addedList = entryList.map(entry => {
      counterRef.current += 1
      return { key: `${entry.marbleId}-${counterRef.current}`, owner: entry.owner, finishIndex: entry.finishIndex }
    })
    setActiveList(current => [...current, ...addedList])
    const timer = setTimeout(() => {
      setActiveList(current => current.filter(item => !addedList.some(added => added.key === item.key)))
    }, laneEntryFxMs)
    timerListRef.current.push(timer)
  }, [state])

  useEffect(() => () => { timerListRef.current.forEach(clearTimeout) }, [])

  return activeList
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/useLaneEntryFx.test.tsx`
Expected: PASS — 2 tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/useLaneEntryFx.ts apps/web/src/motion.ts apps/web/tests/useLaneEntryFx.test.tsx
git commit -m "feat(web): useLaneEntryFx hook — transient lane-entry events"
```

---

### Task 4: Wire the effect into `Board.tsx`

**Files:**
- Modify: `apps/web/src/components/Board.tsx`
- Test: `apps/web/tests/boardLaneFx.test.tsx`

**Interfaces:**
- Consumes: `LaneEntryFx` (Task 2); `useLaneEntryFx` (Task 3).
- Produces: a board that renders one `<LaneEntryFx>` per active entry between the backdrop and the marbles, and provides the shared `<filter id="lane-soft">` in its `<defs>`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/boardLaneFx.test.tsx`:

```tsx
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameState } from '@tock/core'
import { createGame } from '@tock/core'
import { Board } from '../src/components/Board'
import { place } from './support'

const setMatch = (matches: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {} }))

afterEach(() => vi.unstubAllGlobals())

const base = createGame(['human', 'bot'], 48)
const onTrack: GameState = place(base, 'p0m0', { zone: 'track', index: 10 })
const inFinish: GameState = place(onTrack, 'p0m0', { zone: 'finish', index: 0 })
const noop = () => {}

describe('Board finish-lane effect', () => {
  it('mounts a lane-fx overlay when a marble enters its finish lane', () => {
    const view = render(<Board state={onTrack} ghostList={[]} onGhost={noop} />)
    expect(view.queryByTestId('lane-fx-0-0')).toBeNull()
    act(() => { view.rerender(<Board state={inFinish} ghostList={[]} onGhost={noop} />) })
    expect(view.queryByTestId('lane-fx-0-0')).not.toBeNull()
  })

  it('mounts nothing under prefers-reduced-motion', () => {
    setMatch(true)
    const view = render(<Board state={onTrack} ghostList={[]} onGhost={noop} />)
    act(() => { view.rerender(<Board state={inFinish} ghostList={[]} onGhost={noop} />) })
    expect(view.queryByTestId('lane-fx-0-0')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/boardLaneFx.test.tsx`
Expected: FAIL — first test errors because no `lane-fx-0-0` node exists after the rerender (`expected null not to be null`).

- [ ] **Step 3: Add the imports to `apps/web/src/components/Board.tsx`**

After the existing `import { Ghost } from './Ghost'` line (top of file), add:

```tsx
import { LaneEntryFx } from './LaneEntryFx'
import { useLaneEntryFx } from '../hooks/useLaneEntryFx'
```

- [ ] **Step 4: Call the hook inside the `Board` component**

At the top of the `Board` component body (immediately after the line `export const Board = ({ state, ghostList, onGhost, selectedMarbleId, selectableMarbleIds, onSelectMarble }: BoardProps) => {`), add:

```tsx
  const entryList = useLaneEntryFx(state)
```

- [ ] **Step 5: Add the shared blur filter to `<defs>`**

Inside the `<defs>` block, after the closing `</radialGradient>` of the `id="socket"` gradient, add:

```tsx
        <filter id="lane-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
```

- [ ] **Step 6: Render the effect layer between the backdrop and the marbles**

In the JSX, between `{boardBackdrop(state.ringSize)}` and `{placedList.map(({ marble, point }) => {`, insert:

```tsx
      {entryList.map(entry => (
        <LaneEntryFx key={entry.key} owner={entry.owner} finishIndex={entry.finishIndex} ringSize={state.ringSize} />
      ))}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/boardLaneFx.test.tsx`
Expected: PASS — 2 tests green.

- [ ] **Step 8: Run the full web suite + typecheck**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test && pnpm --filter @tock/web typecheck`
Expected: PASS — all web tests green (existing + 12 new across the four files), typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/Board.tsx apps/web/tests/boardLaneFx.test.tsx
git commit -m "feat(web): render the finish-lane entry effect on the board"
```

---

## Self-Review

**1. Spec coverage:**
- Effect = thread flare + white comet + echo, no pop → Task 2 component + Task 2 CSS keyframes (`tock-lane-glow`/`comet`/`echo`); `Marble.tsx` untouched. ✓
- Detection by state diff, move-type-agnostic → Task 1 `laneEntries`. ✓
- All seats (human + bot) → Task 1 test "bot-owned marble entering"; hook reads state only. ✓
- Simultaneous entries (7-split) → Task 1 test "two marbles entering at once". ✓
- Presentation-layer, `@tock/core`/`useTockGame` untouched → hook lives in `apps/web/src/hooks`, watches `state`. ✓
- CSS keyframes not Framer → Task 2 CSS. ✓
- Geometry via `finishThread` / `cellCenter(finishCoord(...))` → Task 2 component. ✓
- Motion token lifetime → Task 3 `laneEntryFxMs`. ✓
- Comet launches with the glide, echo delayed to arrival → Task 2 CSS (comet/glow no delay, echo `.24s`/`.42s`). ✓
- Sync launch of comet + marble glide → both fire on mount (hook) / no CSS delay on comet; documented in Task 2 component comment. ✓
- Reduced-motion double guard → Task 3 hook guard + Task 3/Task 4 reduced-motion tests + existing global CSS rule (noted in Task 2 Step 4). ✓
- Render order (above felt, below marbles) → Task 4 Step 6 insertion point. ✓
- Tests: `laneFx` pure (6 cases), `LaneEntryFx` render, reduced-motion guard through the board → Tasks 1–4. ✓
- Out of scope (final-nest/win, sound, terminal, core) → nothing in the plan touches them. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"write tests for the above". Every code and test step shows full content. ✓

**3. Type consistency:** `LaneEntry { marbleId, owner, finishIndex }` (Task 1) is consumed by the hook, which maps to `ActiveLaneEntry { key, owner, finishIndex }` (Task 3); `LaneEntryFx` props `{ owner, finishIndex, ringSize }` (Task 2) are exactly what Task 4 passes from each `ActiveLaneEntry` (`owner`, `finishIndex`) plus `state.ringSize`. `laneEntryFxMs` defined in Task 3 Step 1, used in the same file's hook. Testids (`lane-fx-${owner}-${finishIndex}`, `lane-fx-glow/comet/echo`) match between Task 2 component, Task 2 test, and Task 4 test. CSS class names match between Task 2 component and Task 2 CSS. ✓

No issues found.

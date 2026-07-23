# Tock web visual & UX redesign ("Feutrine & or") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin and re-ergonomise `apps/web` into the Balatro-inspired "warm felt & gold" design, matching the validated mockups, without touching game logic.

**Architecture:** Purely a presentation-layer change under `apps/web/src`. A rewritten `theme.ts` token set + a new `motion.ts` drive every component. `svgGeometry.ts` gains a continuous-ring channel path, finish-lane gold-thread geometry, and a clockwise-rotated `homeSlotCenter`; the abstract geometry in `@tock/core` (`board2d`) is untouched. Components read tokens and reuse the existing `moveSelection` / `splitAllocation` / `passAndPlay` logic and the `useTockGame` / `useBotAutoplay` hooks unchanged. Ambient CSS `@keyframes` live in `index.css`; spring/particle motion uses Framer Motion. All motion honours `prefers-reduced-motion`.

**Tech Stack:** React 19, TypeScript (strict), Vite 5, Vitest 2 + jsdom + @testing-library/react, Framer Motion (`motion`), `@fontsource/fredoka` + `@fontsource/inter`. Package: `@tock/web`.

## Global Constraints

Copied verbatim from the spec and CLAUDE.md; every task implicitly includes these.

- **Scope**: changes live **only** under `apps/web/src` (+ `apps/web/tests`, `apps/web/package.json`, `apps/web/index.html`). **`@tock/core` and `apps/terminal` are not modified.**
- **Code style**: no semicolons; no trailing commas; **no `function` keyword** (const arrow functions only); **no non-null assertions (`!`) in production code** (tests may use them); all identifiers and comments in **English**; ESLint max-warnings 0 by convention.
- **Naming**: components PascalCase; hooks `useX`; handlers `handleX`; variables camelCase, descriptive, **no plural suffix** (`cardList`, not `cards`).
- **Node**: prefix every `pnpm` command with `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; ` (tool shells default to Node 18; the project needs Node ≥ 22).
- **Motion**: every animation must have a `prefers-reduced-motion: reduce` fallback that is near-instant / non-looping.
- **Preserve stable test hooks** (do not rename): card `aria-label` = `card-<rank>-<suit>`; marble `data-testid` = `marble-<id>`; ghost `aria-label` = `ghost-<label>`; the game log `data-testid` = `game-log`; board `aria-label` = `board`.
- **Visual source of truth**: `docs/superpowers/specs/2026-07-22-tock-web-visual-redesign-mockups/` (the six HTML mockups). The implementation must match them.
- **Seat → colour** (`@tock/core` `colorOf`): 0 red, 1 green, 2 yellow, 3 blue. **Seat → side** (`board2d.sideOf`): 0 bottom, 1 left, 2 top, 3 right.

---

## File structure

Under `apps/web/src`:

- `theme.ts` — **rewritten**: the full "Feutrine & or" token set (colour, type, radius, shadow). Keeps `seatColor` and `marbleGradientId` (Board/Marble depend on them).
- `motion.ts` — **new**: motion durations/easings + `prefersReducedMotion()`.
- `svgGeometry.ts` — **modified**: socket/marble/channel sizing; `ringChannelPath`, `finishThread`, `boardCenter`, rotated `homeSlotCenter`.
- `components/Marble.tsx` — gloss + `selected` gold ring.
- `components/Ghost.tsx` — echo destination + label + swap glyph.
- `components/Board.tsx` — felt channel, carved sockets, finish threads, tinted home pods, start rings, centre emblem.
- `components/StatusBar.tsx` — turn indicator + pile pills.
- `components/GameLog.tsx` — one-line ticker + expandable history.
- `components/Hand.tsx` — suited fanned cards, selection lift, draw motion.
- `components/Setup.tsx` — colour seats, "chairs" add/remove, Humain/Bot segmented, board-size cards, hero CTA.
- `components/SplitControls.tsx` — 7-pip budget gauge.
- `components/GameScreen.tsx` — discreet hint chip, discard flow, wiring.
- `components/GameOver.tsx` — winner marble + confetti + CTA.
- `components/Confetti.tsx` — **new**: dosed confetti burst.
- `components/PassInterstitial.tsx` — hidden hand + CTA.
- `components/ScreenTransition.tsx` — **new**: fade+accel wrapper (fast opaque cover variant).
- `components/App.tsx` — wrap routes in `ScreenTransition`.
- `index.css` — felt background, base type, `@keyframes` (echo, deal, discard, confetti-fall, bob).
- `main.tsx` — import `@fontsource` fonts.
- `index.html` — `theme-color` → felt.

Test files mirror these under `apps/web/tests/`.

---

## Task 1: Design tokens + fonts foundation

**Files:**
- Modify: `apps/web/package.json` (add `@fontsource/fredoka`, `@fontsource/inter`, `motion`)
- Rewrite: `apps/web/src/theme.ts`
- Modify: `apps/web/src/main.tsx`, `apps/web/index.html`, `apps/web/src/index.css`
- Test: `apps/web/tests/theme.test.ts`

**Interfaces:**
- Produces: `theme` (object of design tokens, see below), `seatColor: Record<Color, { light: string, dark: string, soft: string }>`, `marbleGradientId(color): string`.

- [ ] **Step 1: Add dependencies**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"
pnpm --filter @tock/web add @fontsource/fredoka @fontsource/inter motion
```
Expected: `apps/web/package.json` gains the three deps; lockfile updates.

- [ ] **Step 2: Write the failing theme test**

Replace `apps/web/tests/theme.test.ts` with:
```ts
import { describe, expect, it } from 'vitest'
import { seatColor, theme, marbleGradientId } from '../src/theme'

describe('theme tokens', () => {
  it('exposes the four seat colours with light/dark/soft', () => {
    for (const color of ['red', 'green', 'yellow', 'blue'] as const) {
      expect(seatColor[color].light).toMatch(/^#/)
      expect(seatColor[color].dark).toMatch(/^#/)
      expect(seatColor[color].soft).toMatch(/^\d+,\d+,\d+$/)
    }
  })

  it('exposes the core felt & gold tokens', () => {
    expect(theme.gold).toBe('#ffd873')
    expect(theme.feltPanel).toBe('#173e35')
    expect(theme.cardFace).toBe('#f5ecd6')
    expect(theme.fontDisplay).toContain('Fredoka')
    expect(theme.ease.accel).toContain('cubic-bezier')
  })

  it('builds a marble gradient id', () => {
    expect(marbleGradientId('red')).toBe('marble-red')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/theme.test.ts`
Expected: FAIL (`theme.gold` undefined / `seatColor.red.soft` undefined).

- [ ] **Step 4: Rewrite `theme.ts`**

```ts
import type { Color } from '@tock/core'

// "Feutrine & or" palette. Marble radial gradient runs light (top-left highlight)
// -> dark (bottom-right shadow). `soft` is an "r,g,b" triple for translucent glows,
// home-pod tints, and finish-socket rims.
export const seatColor: Record<Color, { light: string, dark: string, soft: string }> = {
  red: { light: '#ff8a8f', dark: '#c02b31', soft: '229,72,77' },
  green: { light: '#86e6a0', dark: '#2e8a4a', soft: '70,167,88' },
  yellow: { light: '#ffe79a', dark: '#d29a1e', soft: '255,197,61' },
  blue: { light: '#93b6ff', dark: '#345fd0', soft: '79,139,255' }
}

export const theme = {
  feltGradient: 'radial-gradient(130% 90% at 50% 45%, #1f5147 0%, #0c211d 72%)',
  feltPanel: '#173e35',
  socketDark: '#05100d',
  socketMid: '#0a201b',
  socketRim: '#1b4d42',
  gold: '#ffd873',
  goldButtonTop: '#ffcf5f',
  goldButtonBottom: '#e6a636',
  goldButtonLip: '#9c6b1e',
  goldDim: '#d8b871',
  ink: '#e8eaf0',
  inkDim: '#9aa2b4',
  hairline: 'rgba(255,216,115,.14)',
  cardFace: '#f5ecd6',
  cardInk: '#2a2320',
  cardInkRed: '#c8323a',
  cardBack: 'linear-gradient(135deg,#3a2a12,#1c1408)',
  fontDisplay: "'Fredoka', system-ui, sans-serif",
  fontUi: "'Inter', system-ui, sans-serif",
  radius: { sm: 8, md: 12, lg: 16, pill: 20, card: 10 },
  shadowCard: '0 8px 14px rgba(0,0,0,.45)',
  shadowFloat: '0 16px 26px rgba(0,0,0,.5)',
  glowGold: '0 0 22px rgba(255,216,115,.6)',
  ease: { accel: 'cubic-bezier(.7,0,.84,0)', spring: 'cubic-bezier(.34,1.56,.64,1)' }
}

export const marbleGradientId = (color: Color): string => `marble-${color}`
```

- [ ] **Step 5: Import fonts and update the shell**

In `apps/web/src/main.tsx`, add at the top (before `import './index.css'`):
```ts
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/fredoka/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
```

In `apps/web/index.html`, change the theme-color meta to:
```html
<meta name="theme-color" content="#0c211d" />
```

Replace `apps/web/src/index.css` with:
```css
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  background: radial-gradient(circle at 50% 30%, #1f5147, #0c211d 82%);
  color: #e8eaf0;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}

/* ---- ambient keyframes (disabled under reduced motion, see below) ---- */
@keyframes tock-echo { 0% { transform: scale(.9); opacity: .6 } 100% { transform: scale(1.8); opacity: 0 } }
@keyframes tock-deal { 0% { transform: translateY(-44px) scale(.9); opacity: 0 } 100% { transform: none; opacity: 1 } }
@keyframes tock-discard { 0% { transform: none; opacity: 1 } 100% { transform: translateY(-48px) scale(.9); opacity: 0 } }
@keyframes tock-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
@keyframes tock-confetti { 0% { transform: translateY(-14px) rotate(0); opacity: 0 } 8% { opacity: 1 } 100% { transform: translateY(620px) rotate(540deg); opacity: 1 } }

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 6: Run the theme test — expect PASS**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/theme.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml pnpm-lock.yaml apps/web/src/theme.ts apps/web/src/main.tsx apps/web/index.html apps/web/src/index.css apps/web/tests/theme.test.ts
git commit -m "feat(web): feutrine & or design tokens, fonts, base css"
```
(If the lockfile is at the repo root only, drop the `apps/web/pnpm-lock.yaml` path.)

---

## Task 2: Motion foundation

**Files:**
- Create: `apps/web/src/motion.ts`
- Test: `apps/web/tests/motion.test.ts`

**Interfaces:**
- Produces: `duration` `{ fast: 0.16, base: 0.3 }`, `echoDuration = 3.2`, `prefersReducedMotion(): boolean`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/motion.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { duration, echoDuration, prefersReducedMotion } from '../src/motion'

const setMatch = (matches: boolean) => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {} }))
}

afterEach(() => vi.unstubAllGlobals())

describe('motion', () => {
  it('exposes durations', () => {
    expect(duration.fast).toBe(0.16)
    expect(duration.base).toBe(0.3)
    expect(echoDuration).toBe(3.2)
  })

  it('reads the reduced-motion preference', () => {
    setMatch(true)
    expect(prefersReducedMotion()).toBe(true)
    setMatch(false)
    expect(prefersReducedMotion()).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/motion.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `motion.ts`**

```ts
// Motion tokens shared by CSS-driven and Framer-Motion-driven animation.
export const duration = { fast: 0.16, base: 0.3 }
export const echoDuration = 3.2
export const easeAccel = [0.7, 0, 0.84, 0] as const
export const easeSpring = [0.34, 1.56, 0.64, 1] as const

// True when the user asked the OS to reduce motion. Guarded for non-browser
// (test) environments where matchMedia may be absent.
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/motion.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/motion.ts apps/web/tests/motion.test.ts
git commit -m "feat(web): motion tokens + reduced-motion helper"
```

---

## Task 3: Board geometry — sizing, ring channel, finish thread, rotated homes

**Files:**
- Modify: `apps/web/src/svgGeometry.ts`
- Test: `apps/web/tests/svgGeometry.test.ts` (extend)

**Interfaces:**
- Produces (new/changed exports): `CELL = 10`, `SOCKET_R = 3.6`, `MARBLE_R = 3.2`, `CHANNEL_W = 9`, `EMBLEM_R = 6`; `boardCenter(ringSize): { x, y }`; `ringChannelPath(ringSize): string`; `finishThread(owner, ringSize): { mouth: {x,y}, stop: {x,y} }`; unchanged `cellCenter`, `positionCenter`, `marbleCenter`, `viewBox`; **changed** `homeSlotCenter` (clockwise corners).
- Consumes: `@tock/core` `ringCoord`, `finishCoord`, `gridSize`, `sideOf`, `cellOf`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/tests/svgGeometry.test.ts`:
```ts
import { boardCenter, ringChannelPath, finishThread, homeSlotCenter, CELL } from '../src/svgGeometry'

describe('redesign geometry', () => {
  it('closes the ring channel path with the right number of points', () => {
    const path = ringChannelPath(48)
    expect(path.startsWith('M')).toBe(true)
    expect(path.trimEnd().endsWith('Z')).toBe(true)
    // 48 ring cells -> 47 L segments after the initial M
    expect((path.match(/L/g) ?? []).length).toBe(47)
  })

  it('puts the board centre at the middle grid cell', () => {
    const center = boardCenter(48) // gridSize(48) = 13 -> centre cell index 6
    expect(center.x).toBeCloseTo(6.5 * CELL)
    expect(center.y).toBeCloseTo(6.5 * CELL)
  })

  it('rotates homes clockwise: seat 0 (bottom/red) sits bottom-left', () => {
    const slot0 = homeSlotCenter(0, 0, 48)
    const center = boardCenter(48)
    expect(slot0.x).toBeLessThan(center.x) // left half
    expect(slot0.y).toBeGreaterThan(center.y) // bottom half
  })

  it('rotates homes clockwise: seat 1 (left/green) sits top-left', () => {
    const slot = homeSlotCenter(1, 0, 48)
    const center = boardCenter(48)
    expect(slot.x).toBeLessThan(center.x)
    expect(slot.y).toBeLessThan(center.y)
  })

  it('threads a finish lane from the ring mouth toward the centre', () => {
    const thread = finishThread(0, 48) // bottom seat: mouth below, stop above (toward centre)
    expect(thread.mouth.y).toBeGreaterThan(thread.stop.y)
    expect(thread.mouth.x).toBeCloseTo(thread.stop.x)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/svgGeometry.test.ts`
Expected: FAIL (new exports missing).

- [ ] **Step 3: Rewrite `svgGeometry.ts`**

```ts
import type { PlayerId, Position } from '@tock/core'
import { cellOf, finishCoord, gridSize, ringCoord, sideOf } from '@tock/core'
import type { Cell } from '@tock/core'

export const CELL = 10
export const SOCKET_R = 3.6
export const MARBLE_R = 3.2
export const CHANNEL_W = 9
export const EMBLEM_R = 6
export const BOARD_MARGIN = 4

export const viewBox = (ringSize: number): string => {
  const side = gridSize(ringSize) * CELL
  return `${-BOARD_MARGIN} ${-BOARD_MARGIN} ${side + BOARD_MARGIN * 2} ${side + BOARD_MARGIN * 2}`
}

export const cellCenter = (cell: Cell): { x: number, y: number } => ({
  x: (cell.col + 0.5) * CELL,
  y: (cell.row + 0.5) * CELL
})

export const boardCenter = (ringSize: number): { x: number, y: number } => {
  const mid = (gridSize(ringSize) - 1) / 2
  return cellCenter({ row: mid, col: mid })
}

export const positionCenter = (
  owner: PlayerId,
  position: Position,
  ringSize: number
): { x: number, y: number } | null => {
  const cell = cellOf(owner, position, ringSize)
  return cell ? cellCenter(cell) : null
}

// The continuous ring as one closed SVG path through every ring-cell centre in
// order (index 0..ringSize-1). Rendered as a wide rounded stroke = the felt track.
export const ringChannelPath = (ringSize: number): string => {
  const points = Array.from({ length: ringSize }, (_unused, index) => cellCenter(ringCoord(index, ringSize)))
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ') + ' Z'
}

// Gold-thread endpoints for a seat's finish lane: from the lane mouth (nearest the
// ring, finish slot 0) to the emblem's edge (the thread stops at the emblem, never
// crosses it). Each lane is axis-aligned, so the stop is the board centre offset by
// EMBLEM_R back toward the mouth.
export const finishThread = (
  owner: PlayerId,
  ringSize: number
): { mouth: { x: number, y: number }, stop: { x: number, y: number } } => {
  const mouth = cellCenter(finishCoord(owner, 0, ringSize))
  const center = boardCenter(ringSize)
  const offset: Record<string, { x: number, y: number }> = {
    bottom: { x: center.x, y: center.y + EMBLEM_R },
    top: { x: center.x, y: center.y - EMBLEM_R },
    left: { x: center.x - EMBLEM_R, y: center.y },
    right: { x: center.x + EMBLEM_R, y: center.y }
  }
  return { mouth, stop: offset[sideOf[owner]] ?? center }
}

// Home nests sit in the corner CLOCKWISE-adjacent to the seat's arm (on the side of
// its start square): bottom -> bottom-left, left -> top-left, top -> top-right,
// right -> bottom-right. Laid out as a 2x2 cluster.
export const homeSlotCenter = (
  owner: PlayerId,
  slotIndex: number,
  ringSize: number
): { x: number, y: number } => {
  const cellsPerSide = gridSize(ringSize)
  const near = 1.5
  const far = cellsPerSide - 1.5
  const corner: Record<string, { cx: number, cy: number }> = {
    bottom: { cx: near, cy: far },
    left: { cx: near, cy: near },
    top: { cx: far, cy: near },
    right: { cx: far, cy: far }
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

Note: `HOLE_R` was removed. Board.tsx (Task 6) no longer imports it; check no other file references `HOLE_R` before committing (`grep -rn HOLE_R apps/web/src`).

- [ ] **Step 4: Update any stale `homeSlotCenter` corner assertions**

Open `apps/web/tests/svgGeometry.test.ts`; if pre-existing tests assert the OLD corners (seat 0 bottom-right), update them to the new clockwise corners (seat 0 bottom-left) so they match Step 1's expectations.

- [ ] **Step 5: Run to verify all geometry tests pass**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/svgGeometry.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/svgGeometry.ts apps/web/tests/svgGeometry.test.ts
git commit -m "feat(web): ring-channel path, finish-thread geometry, clockwise homes"
```

---

## Task 4: Marble — gloss + selected ring

**Files:**
- Modify: `apps/web/src/components/Marble.tsx`
- Test: `apps/web/tests/board.test.tsx` (add a marble-gloss assertion; keep existing marble assertions passing)

**Interfaces:**
- Produces: `Marble` props `{ color: Color, cx: number, cy: number, testId?: string, selected?: boolean }`. Renders a `<g>` containing shadow ellipse, gradient circle (`data-testid={testId}`), highlight, and a gold ring when `selected`.
- Consumes: `MARBLE_R` (svgGeometry), `marbleGradientId`, `theme` (theme).

- [ ] **Step 1: Write the failing test**

Add to `apps/web/tests/board.test.tsx`:
```ts
it('draws a gold selection ring on a selected marble', () => {
  // Board renders marbles; find one and assert the group has the selection ring.
  // (Rendered indirectly via <Board>; see existing board render helper.)
})
```
Then, since Marble is easiest to test in isolation, create `apps/web/tests/marble.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Marble } from '../src/components/Marble'

const wrap = (node: React.ReactNode) => render(<svg>{node}</svg>)

describe('Marble', () => {
  it('renders the marble circle with its test id and a highlight', () => {
    const { container } = wrap(<Marble color="red" cx={10} cy={10} testId="marble-p0m0" />)
    expect(container.querySelector('[data-testid="marble-p0m0"]')).not.toBeNull()
    expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2)
  })

  it('adds a selection ring when selected', () => {
    const { container } = wrap(<Marble color="red" cx={10} cy={10} selected />)
    expect(container.querySelector('[data-selected="true"]')).not.toBeNull()
  })
})
```
(Delete the placeholder assertion added to board.test.tsx if you added one; keep the standalone marble.test.tsx.)

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/marble.test.tsx`
Expected: FAIL (`data-selected` absent).

- [ ] **Step 3: Implement `Marble.tsx`**

```tsx
import type { Color } from '@tock/core'
import { MARBLE_R } from '../svgGeometry'
import { marbleGradientId, theme } from '../theme'

type MarbleProps = { color: Color, cx: number, cy: number, testId?: string, selected?: boolean }

export const Marble = ({ color, cx, cy, testId, selected }: MarbleProps) => (
  <g style={{ transition: 'transform 0.25s ' + theme.ease.spring }}>
    <ellipse cx={cx} cy={cy + MARBLE_R - 0.4} rx={MARBLE_R * 0.8} ry={1} fill="rgba(0,0,0,.4)" />
    <circle cx={cx} cy={cy} r={MARBLE_R} fill={`url(#${marbleGradientId(color)})`} data-testid={testId} />
    <circle cx={cx - MARBLE_R * 0.3} cy={cy - MARBLE_R * 0.35} r={MARBLE_R * 0.28} fill="rgba(255,255,255,.72)" />
    {selected && (
      <circle data-selected="true" cx={cx} cy={cy} r={MARBLE_R + 1.4} fill="none" stroke={theme.gold} strokeWidth={0.9} opacity={0.9} />
    )}
  </g>
)
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/marble.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Marble.tsx apps/web/tests/marble.test.tsx
git commit -m "feat(web): glossy marble with selection ring"
```

---

## Task 5: Ghost — echo destination + labels

**Files:**
- Modify: `apps/web/src/components/Ghost.tsx`
- Test: `apps/web/tests/board.test.tsx` (ghost assertions) or a new `apps/web/tests/ghost.test.tsx`

**Interfaces:**
- Produces: `Ghost` props unchanged `{ cx, cy, label?, onSelect }`. Renders a `<g role="button" aria-label={`ghost-${label ?? ''}`}>` with a transparent hit circle, a steady gold ring, two echo rings (`className="tock-echo"`), and the label text. Keeps `aria-label` = `ghost-<label>`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/ghost.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Ghost } from '../src/components/Ghost'

describe('Ghost', () => {
  it('keeps the ghost-<label> aria-label and fires onSelect', async () => {
    const onSelect = vi.fn()
    render(<svg><Ghost cx={5} cy={5} label="3" onSelect={onSelect} /></svg>)
    const node = screen.getByLabelText('ghost-3')
    await userEvent.click(node)
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('renders echo rings', () => {
    const { container } = render(<svg><Ghost cx={5} cy={5} onSelect={() => {}} /></svg>)
    expect(container.querySelectorAll('.tock-echo').length).toBe(2)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/ghost.test.tsx`
Expected: FAIL (`.tock-echo` absent).

- [ ] **Step 3: Add echo keyframes usage + implement `Ghost.tsx`**

The `tock-echo` keyframes already exist in `index.css` (Task 1). Add the echo class styling to `index.css` (append):
```css
.tock-echo { animation: tock-echo 3.2s ease-out infinite; transform-box: fill-box; transform-origin: center; }
.tock-echo--b { animation-delay: 1.6s; }
```

Implement `Ghost.tsx`:
```tsx
import { MARBLE_R } from '../svgGeometry'
import { theme } from '../theme'

type GhostProps = { cx: number, cy: number, label?: string, onSelect: () => void }

export const Ghost = ({ cx, cy, label, onSelect }: GhostProps) => (
  <g role="button" aria-label={`ghost-${label ?? ''}`} onClick={onSelect} style={{ cursor: 'pointer' }}>
    <circle cx={cx} cy={cy} r={MARBLE_R + 1.6} fill="transparent" />
    <circle cx={cx} cy={cy} r={MARBLE_R} fill="rgba(255,216,115,.16)" stroke={theme.gold} strokeWidth={0.8} />
    <circle className="tock-echo" cx={cx} cy={cy} r={MARBLE_R} fill="none" stroke={theme.gold} strokeWidth={0.8} />
    <circle className="tock-echo tock-echo--b" cx={cx} cy={cy} r={MARBLE_R} fill="none" stroke={theme.gold} strokeWidth={0.8} />
    {label && (
      <text x={cx} y={cy + 1} textAnchor="middle" fontSize={3.2} fontFamily={theme.fontDisplay} fontWeight={700} fill="#ffe6a6">{label}</text>
    )}
  </g>
)
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/ghost.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Ghost.tsx apps/web/src/index.css apps/web/tests/ghost.test.tsx
git commit -m "feat(web): echo destination ghost"
```

---

## Task 6: Board — felt channel, carved sockets, finish threads, home pods, emblem

**Files:**
- Modify: `apps/web/src/components/Board.tsx`
- Test: `apps/web/tests/board.test.tsx` (keep existing marble/ghost assertions; add channel + socket presence)

**Interfaces:**
- Consumes: `ringChannelPath`, `finishThread`, `boardCenter`, `homeSlotCenter`, `marbleCenter`, `cellCenter`, `viewBox`, `SOCKET_R`, `MARBLE_R`, `CHANNEL_W`, `EMBLEM_R` (svgGeometry); `seatColor`, `theme` (theme); `ringCoord`, `finishCoord`, `finishSize`, `startCell`, `colorOf` (core); `Marble`, `Ghost`.
- Produces: `Board` props unchanged `{ state, ghostList, onGhost }`. Keeps `<svg role="img" aria-label="board">` and the marble-gradient `<defs>`. Passes `selected` to a marble when it is the source of the current ghosts (see note).

- [ ] **Step 1: Write the failing test**

Add to `apps/web/tests/board.test.tsx` (keep the file's existing imports/setup):
```ts
it('renders a continuous ring channel and carved sockets', () => {
  // render <Board .../> via the file's existing helper, then:
  // expect at least one path with a wide stroke (the channel) and many socket circles.
})
```
Make it concrete using the file's existing render helper (the file already renders a Board for its marble tests). Replace the stub with:
```ts
it('renders a continuous ring channel', () => {
  const { container } = renderBoard() // reuse the helper already in this file
  const channel = container.querySelector('path[data-role="ring-channel"]')
  expect(channel).not.toBeNull()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/board.test.tsx`
Expected: FAIL (`ring-channel` path absent).

- [ ] **Step 3: Implement `Board.tsx`**

```tsx
import type { GameState, PlayerId } from '@tock/core'
import { colorOf, finishCoord, finishSize, ringCoord, startCell } from '@tock/core'
import {
  CHANNEL_W, EMBLEM_R, MARBLE_R, SOCKET_R,
  boardCenter, cellCenter, finishThread, homeSlotCenter, marbleCenter, ringChannelPath, viewBox
} from '../svgGeometry'
import { seatColor, theme } from '../theme'
import { Marble } from './Marble'
import { Ghost } from './Ghost'

type GhostEntry = { key: string, cx: number, cy: number, label?: string }
type BoardProps = { state: GameState, ghostList: GhostEntry[], onGhost: (key: string) => void }

const SEAT_LIST: PlayerId[] = [0, 1, 2, 3]

const slotIndexOf = (marbleList: GameState['marbleList'], marble: GameState['marbleList'][number]): number => {
  const owned = marbleList.filter(candidate => candidate.owner === marble.owner)
  return owned.findIndex(candidate => candidate.id === marble.id)
}

// A carved, recessed socket at a grid cell. `rim` (an "r,g,b" triple) tints its edge
// for finish/home ownership; otherwise a faint dark rim.
const Socket = ({ x, y, rim }: { x: number, y: number, rim?: string }) => (
  <>
    <circle cx={x} cy={y} r={SOCKET_R} fill="url(#socket)" />
    <circle cx={x} cy={y} r={SOCKET_R} fill="none" stroke={rim ? `rgba(${rim},.75)` : 'rgba(0,0,0,.5)'} strokeWidth={rim ? 0.7 : 0.5} />
    <path d={`M ${x - SOCKET_R + 0.7} ${y + 0.7} A ${SOCKET_R - 0.5} ${SOCKET_R - 0.5} 0 0 0 ${x + SOCKET_R - 0.7} ${y + 0.7}`} fill="none" stroke="rgba(255,255,255,.13)" strokeWidth={0.5} />
  </>
)

const boardBackdrop = (ringSize: number) => {
  const center = boardCenter(ringSize)
  const path = ringChannelPath(ringSize)
  return (
    <>
      {/* main ring = continuous felt channel */}
      <path data-role="ring-channel" d={path} fill="none" stroke={theme.feltPanel} strokeWidth={CHANNEL_W} strokeLinejoin="round" strokeLinecap="round" />
      <path d={path} fill="none" stroke="rgba(255,216,115,.08)" strokeWidth={CHANNEL_W} strokeLinejoin="round" />

      {/* finish lanes = gold thread + seat-rimmed sockets */}
      {SEAT_LIST.map(seat => {
        const thread = finishThread(seat, ringSize)
        const rim = seatColor[colorOf(seat)].soft
        return (
          <g key={`finish-${seat}`}>
            <line x1={thread.mouth.x} y1={thread.mouth.y} x2={thread.stop.x} y2={thread.stop.y} stroke="rgba(255,216,115,.38)" strokeWidth={1} strokeLinecap="round" />
            {Array.from({ length: finishSize }, (_unused, slot) => {
              const point = cellCenter(finishCoord(seat, slot, ringSize))
              return <Socket key={slot} x={point.x} y={point.y} rim={rim} />
            })}
          </g>
        )
      })}

      {/* ring sockets */}
      {Array.from({ length: ringSize }, (_unused, index) => {
        const point = cellCenter(ringCoord(index, ringSize))
        return <Socket key={`ring-${index}`} x={point.x} y={point.y} />
      })}

      {/* home pods + sockets + start rings */}
      {SEAT_LIST.map(seat => {
        const color = colorOf(seat)
        const rim = seatColor[color].soft
        const homeList = Array.from({ length: finishSize }, (_unused, slot) => homeSlotCenter(seat, slot, ringSize))
        const xList = homeList.map(spot => spot.x)
        const yList = homeList.map(spot => spot.y)
        const pad = SOCKET_R + 2.5
        const minX = Math.min(...xList) - pad
        const minY = Math.min(...yList) - pad
        const start = cellCenter(ringCoord(startCell(seat, ringSize), ringSize))
        return (
          <g key={`home-${seat}`}>
            <rect x={minX} y={minY} width={Math.max(...xList) - minX + pad} height={Math.max(...yList) - minY + pad} rx={pad} fill={`rgba(${rim},.15)`} stroke={`rgba(${rim},.5)`} strokeWidth={0.7} />
            {homeList.map((spot, slot) => <Socket key={slot} x={spot.x} y={spot.y} rim={rim} />)}
            <circle cx={start.x} cy={start.y} r={SOCKET_R + 1.4} fill="none" stroke={seatColor[color].light} strokeWidth={0.9} opacity={0.9} />
          </g>
        )
      })}

      {/* centre emblem */}
      <circle cx={center.x} cy={center.y} r={EMBLEM_R} fill="rgba(255,216,115,.10)" stroke="rgba(255,216,115,.4)" strokeWidth={0.7} />
      <text x={center.x} y={center.y + 2.2} textAnchor="middle" fontFamily={theme.fontDisplay} fontSize={6} fontWeight={700} fill={theme.gold}>T</text>
    </>
  )
}

export const Board = ({ state, ghostList, onGhost }: BoardProps) => {
  const placedList = state.marbleList.map(marble => ({
    marble,
    point: marbleCenter(marble.owner, marble.position, slotIndexOf(state.marbleList, marble), state.ringSize)
  }))

  return (
    <svg viewBox={viewBox(state.ringSize)} role="img" aria-label="board" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        {(['red', 'green', 'yellow', 'blue'] as const).map(color => (
          <radialGradient key={color} id={`marble-${color}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={seatColor[color].light} />
            <stop offset="100%" stopColor={seatColor[color].dark} />
          </radialGradient>
        ))}
        <radialGradient id="socket" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor={theme.socketDark} />
          <stop offset="55%" stopColor={theme.socketMid} />
          <stop offset="100%" stopColor={theme.socketRim} />
        </radialGradient>
      </defs>
      {boardBackdrop(state.ringSize)}
      {placedList.map(({ marble, point }) => (
        <Marble key={marble.id} testId={`marble-${marble.id}`} color={colorOf(marble.owner)} cx={point.x} cy={point.y} />
      ))}
      {ghostList.map(ghost => (
        <Ghost key={ghost.key} cx={ghost.cx} cy={ghost.cy} label={ghost.label} onSelect={() => onGhost(ghost.key)} />
      ))}
    </svg>
  )
}
```

- [ ] **Step 4: Run the board test suite — expect PASS**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/board.test.tsx`
Expected: PASS (channel present; existing marble assertions still pass).

- [ ] **Step 5: Visual check against `board.html`**

Run `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web dev`, open the app, start a game, and compare the board to `docs/superpowers/specs/2026-07-22-tock-web-visual-redesign-mockups/board.html`. Confirm: continuous felt ring, breathing sockets, gold finish threads stopping at the emblem, clockwise home pods, start rings.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/Board.tsx apps/web/tests/board.test.tsx
git commit -m "feat(web): felt-channel board with carved sockets and gold finish threads"
```

---

## Task 7: StatusBar — turn indicator + pile pills

**Files:**
- Modify: `apps/web/src/components/StatusBar.tsx`
- Test: `apps/web/tests/gameScreen.test.tsx` (covers StatusBar output) — add a pile-count assertion if absent.

**Interfaces:**
- Produces: `StatusBar` props unchanged `{ turnColor, drawCount, discardCount, prompt }`. Renders the prompt text and both counts.

- [ ] **Step 1: Write/adjust the test**

In `apps/web/tests/gameScreen.test.tsx`, ensure an assertion exists that the draw and discard counts render as text (e.g. `expect(screen.getByText(/Pioche/)).toBeInTheDocument()`). If GameScreen tests query the old `🂠 N · 🗑 N` string, update them to the new "Pioche N" / "Défausse N".

- [ ] **Step 2: Run to verify current state**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/gameScreen.test.tsx`
Expected: FAIL on the new text (old markup).

- [ ] **Step 3: Implement `StatusBar.tsx`**

```tsx
import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'

type StatusBarProps = { turnColor: Color, drawCount: number, discardCount: number, prompt: string }

const pill = { fontSize: 11, color: theme.goldDim, background: 'rgba(0,0,0,.25)', border: `1px solid rgba(255,216,115,.18)`, borderRadius: theme.radius.pill, padding: '4px 10px' } as const

export const StatusBar = ({ turnColor, drawCount, discardCount, prompt }: StatusBarProps) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 8px', color: theme.ink }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: theme.fontDisplay, fontWeight: 600, fontSize: 15, color: '#ffe6a6' }}>
      <span className="tock-bob" style={{ width: 12, height: 12, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${seatColor[turnColor].light}, ${seatColor[turnColor].dark})`, boxShadow: `0 0 10px rgba(${seatColor[turnColor].soft},.8)` }} />
      {prompt}
    </span>
    <span style={{ display: 'flex', gap: 7 }}>
      <span style={pill}>Pioche <b style={{ color: '#ffe6a6' }}>{drawCount}</b></span>
      <span style={pill}>Défausse <b style={{ color: '#ffe6a6' }}>{discardCount}</b></span>
    </span>
  </div>
)
```

Append to `index.css`: `.tock-bob { animation: tock-bob 1.4s ease-in-out infinite; }`

Note: `prompt` here is the turn line (e.g. "À toi de jouer"), not the action hint — see Task 11 for how GameScreen supplies it.

- [ ] **Step 4: Run — expect PASS**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/gameScreen.test.tsx`
Expected: PASS (may still fail on hint-chip assertions handled in Task 11 — that is fine; re-run after Task 11).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/StatusBar.tsx apps/web/src/index.css apps/web/tests/gameScreen.test.tsx
git commit -m "feat(web): status bar with turn dot and pile pills"
```

---

## Task 8: GameLog — one-line ticker + expandable history

**Files:**
- Modify: `apps/web/src/components/GameLog.tsx`
- Test: `apps/web/tests/gameLog.test.tsx` (rewrite for ticker behaviour)

**Interfaces:**
- Produces: `GameLog` props unchanged `{ logList: string[] }`. Keeps `data-testid="game-log"`. Shows the last line + a "▾" toggle button (`aria-label="afficher l'historique"`) that expands the full list.

- [ ] **Step 1: Rewrite the failing test**

Replace `apps/web/tests/gameLog.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GameLog } from '../src/components/GameLog'

describe('GameLog', () => {
  it('shows only the last line collapsed', () => {
    render(<GameLog logList={['un', 'deux', 'trois']} />)
    expect(screen.getByTestId('game-log')).toHaveTextContent('trois')
    expect(screen.queryByText('un')).toBeNull()
  })

  it('reveals the full history when expanded', async () => {
    render(<GameLog logList={['un', 'deux', 'trois']} />)
    await userEvent.click(screen.getByLabelText("afficher l'historique"))
    expect(screen.getByText('un')).toBeInTheDocument()
    expect(screen.getByText('deux')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/gameLog.test.tsx`
Expected: FAIL (old 8-line block shows all lines / no toggle).

- [ ] **Step 3: Implement `GameLog.tsx`**

```tsx
import { useState } from 'react'
import { theme } from '../theme'

type GameLogProps = { logList: string[] }

export const GameLog = ({ logList }: GameLogProps) => {
  const [open, setOpen] = useState(false)
  const last = logList[logList.length - 1] ?? ''

  return (
    <div data-testid="game-log" style={{ margin: '2px 16px 4px', fontSize: 12.5, color: '#b7c0cf' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'rgba(0,0,0,.2)', borderRadius: theme.radius.md }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last}</span>
        <button
          aria-label="afficher l'historique"
          onClick={() => setOpen(value => !value)}
          style={{ background: 'none', border: 'none', color: theme.goldDim, fontSize: 14, cursor: 'pointer', transform: open ? 'rotate(180deg)' : 'none' }}
        >▾</button>
      </div>
      {open && (
        <div style={{ maxHeight: 140, overflowY: 'auto', padding: '6px 12px', WebkitOverflowScrolling: 'touch' }}>
          {logList.map((line, index) => <div key={index} style={{ color: index === logList.length - 1 ? theme.ink : undefined }}>{line}</div>)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/gameLog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/GameLog.tsx apps/web/tests/gameLog.test.tsx
git commit -m "feat(web): one-line expandable game log"
```

---

## Task 9: Hand — suited cards, fan, selection lift, draw motion

**Files:**
- Modify: `apps/web/src/components/Hand.tsx`
- Test: `apps/web/tests/hand.test.tsx` (keep aria-labels; add suit assertion)

**Interfaces:**
- Produces: `Hand` props unchanged `{ hand: Card[], playableList: boolean[], selectedIndex: number, onSelect: (index: number) => void }`. Each card keeps `aria-label={`card-${rank}-${suit}`}`, `disabled={!playable}`. Shows rank + suit glyph; selected card lifts; unplayable dimmed. Cards animate in via the `tock-deal` class.
- Consumes: `theme`.

- [ ] **Step 1: Add/adjust the failing test**

Ensure `apps/web/tests/hand.test.tsx` asserts the suit renders. Add:
```tsx
it('shows the suit glyph and keeps the card aria-label', () => {
  render(<Hand hand={[{ rank: 'A', suit: 'hearts' }]} playableList={[true]} selectedIndex={-1} onSelect={() => {}} />)
  const card = screen.getByLabelText('card-A-hearts')
  expect(card).toHaveTextContent('A')
  expect(card).toHaveTextContent('♥')
})
```
(Keep the file's existing playable/disabled and onSelect tests.)

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/hand.test.tsx`
Expected: FAIL (no suit glyph today).

- [ ] **Step 3: Implement `Hand.tsx`**

```tsx
import type { Card, Suit } from '@tock/core'
import { theme } from '../theme'

type HandProps = {
  hand: Card[]
  playableList: boolean[]
  selectedIndex: number
  onSelect: (index: number) => void
}

const suitGlyph: Record<Suit, string> = { hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣' }
const isRed = (card: Card): boolean => card.suit === 'hearts' || card.suit === 'diamonds'

export const Hand = ({ hand, playableList, selectedIndex, onSelect }: HandProps) => {
  const mid = (hand.length - 1) / 2
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 130, paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}>
      {hand.map((card, index) => {
        const playable = playableList[index] ?? false
        const selected = index === selectedIndex
        const angle = (index - mid) * 8
        const lift = selected ? -20 : Math.abs(index - mid) * 2
        const ink = isRed(card) ? theme.cardInkRed : theme.cardInk
        return (
          <button
            key={`${card.rank}-${card.suit}-${index}`}
            aria-label={`card-${card.rank}-${card.suit}`}
            disabled={!playable}
            onClick={() => onSelect(index)}
            className="tock-deal"
            style={{
              position: 'relative', width: 62, height: 86, margin: '0 -7px', borderRadius: theme.radius.card, border: 'none',
              background: theme.cardFace, color: ink, fontFamily: theme.fontDisplay, fontWeight: 700,
              transformOrigin: 'bottom center',
              transform: `rotate(${selected ? 0 : angle}deg) translateY(${lift}px) scale(${selected ? 1.07 : 1})`,
              opacity: playable ? 1 : 0.42, cursor: playable ? 'pointer' : 'default',
              boxShadow: selected ? `${theme.shadowFloat}, 0 0 0 2px ${theme.gold}, ${theme.glowGold}` : theme.shadowCard,
              transition: `transform 0.16s ${theme.ease.spring}, box-shadow 0.16s ease`, zIndex: selected ? 5 : 1
            }}
          >
            <span style={{ position: 'absolute', top: 6, left: 7, fontSize: 16, lineHeight: 0.85 }}>{card.rank}<br />{suitGlyph[card.suit]}</span>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>{suitGlyph[card.suit]}</span>
          </button>
        )
      })}
    </div>
  )
}
```

Append to `index.css`:
```css
.tock-deal { animation: tock-deal 0.36s cubic-bezier(.7,0,.84,0); }
```

- [ ] **Step 4: Run — expect PASS**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/hand.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Hand.tsx apps/web/src/index.css apps/web/tests/hand.test.tsx
git commit -m "feat(web): suited fanned hand with selection lift and draw motion"
```

---

## Task 10: Setup — colour seats, "chairs" add/remove, segmented role, board-size cards, hero CTA

**Files:**
- Rewrite: `apps/web/src/components/Setup.tsx`
- Test: `apps/web/tests/setup.test.tsx` (full rewrite)

**Interfaces:**
- Produces: `Setup` props unchanged `{ onStart: (kindList: PlayerKind[], ringSize: number) => void }`. Emits the same `PlayerKind[]` of length 4 (index 0 always `'human'`) and a ring size.
- New accessible names (for tests): each opponent seat n∈{1,2,3} is either an add button `aria-label={`ajouter le joueur ${n}`}` (absent) OR, when present, a group with role segments named `humain`/`bot` (buttons) and a remove button `aria-label={`retirer le joueur ${n}`}`. Board-size buttons keep their `aria-pressed`. Start button text: **"Lancer la partie"**.

- [ ] **Step 1: Rewrite the failing test**

Replace `apps/web/tests/setup.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_RING_SIZE } from '@tock/core'
import { Setup } from '../src/components/Setup'

describe('Setup', () => {
  it('defaults to one bot opponent (seats 2 and 3 absent) and starts with that kindList', async () => {
    const onStart = vi.fn()
    render(<Setup onStart={onStart} />)
    // Seat 1 present as a bot; seats 2 and 3 are empty chairs to add.
    expect(screen.getByRole('button', { name: 'bot' })).toBeInTheDocument()
    expect(screen.getByLabelText('ajouter le joueur 2')).toBeInTheDocument()
    expect(screen.getByLabelText('ajouter le joueur 3')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Lancer la partie' }))
    expect(onStart).toHaveBeenCalledWith(['human', 'bot', 'inactive', 'inactive'], DEFAULT_RING_SIZE)
  })

  it('adds seat 2 as a bot and includes it', async () => {
    const onStart = vi.fn()
    render(<Setup onStart={onStart} />)
    await userEvent.click(screen.getByLabelText('ajouter le joueur 2'))
    await userEvent.click(screen.getByRole('button', { name: 'Lancer la partie' }))
    expect(onStart).toHaveBeenCalledWith(['human', 'bot', 'bot', 'inactive'], DEFAULT_RING_SIZE)
  })

  it('switches an added seat to human via the segmented control', async () => {
    const onStart = vi.fn()
    render(<Setup onStart={onStart} />)
    // Seat 1 is present; set its role to human. Scope the query to seat 1's row.
    const seatOne = screen.getByTestId('seat-1')
    await userEvent.click(within(seatOne).getByRole('button', { name: 'humain' }))
    await userEvent.click(screen.getByRole('button', { name: 'Lancer la partie' }))
    expect(onStart).toHaveBeenCalledWith(['human', 'human', 'inactive', 'inactive'], DEFAULT_RING_SIZE)
  })

  it('removes a seat back to absent', async () => {
    const onStart = vi.fn()
    render(<Setup onStart={onStart} />)
    await userEvent.click(screen.getByLabelText('retirer le joueur 1'))
    await userEvent.click(screen.getByRole('button', { name: 'Lancer la partie' }))
    expect(onStart).toHaveBeenCalledWith(['human', 'inactive', 'inactive', 'inactive'], DEFAULT_RING_SIZE)
  })
})
```
Add `import { within } from '@testing-library/react'` at the top.

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/setup.test.tsx`
Expected: FAIL (old cycling model).

- [ ] **Step 3: Rewrite `Setup.tsx`**

```tsx
import { useState } from 'react'
import type { Color, PlayerKind } from '@tock/core'
import { DEFAULT_RING_SIZE, RING_SIZE_OPTIONS, colorOf } from '@tock/core'
import { seatColor, theme } from '../theme'

type SetupProps = { onStart: (kindList: PlayerKind[], ringSize: number) => void }

const opponentSeatList = [1, 2, 3] as const
const colorLabel: Record<Color, string> = { red: 'Rouge', green: 'Vert', yellow: 'Jaune', blue: 'Bleu' }
const defaultOpponentKindList: PlayerKind[] = ['bot', 'inactive', 'inactive']

const Dot = ({ color }: { color: Color }) => (
  <span style={{ width: 22, height: 22, borderRadius: '50%', flex: 'none', background: `radial-gradient(circle at 35% 30%, ${seatColor[color].light}, ${seatColor[color].dark})`, boxShadow: '0 0 10px rgba(0,0,0,.4)' }} />
)

export const Setup = ({ onStart }: SetupProps) => {
  const [opponentKindList, setOpponentKindList] = useState<PlayerKind[]>(defaultOpponentKindList)
  const [ringSize, setRingSize] = useState<number>(DEFAULT_RING_SIZE)

  const setKind = (seatIndex: number, kind: PlayerKind) =>
    setOpponentKindList(previous => previous.map((entry, index) => (index === seatIndex ? kind : entry)))

  const handleStart = () => onStart(['human', ...opponentKindList], ringSize)

  const label = { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: theme.goldDim, opacity: 0.85, margin: '0 2px 10px' } as const
  const rowBase = { display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', marginBottom: 9, minHeight: 44, borderRadius: 14 } as const
  const seg = { display: 'flex', background: 'rgba(0,0,0,.28)', borderRadius: 10, padding: 3, gap: 2 } as const
  const opt = (on: boolean) => ({ fontFamily: theme.fontUi, fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', background: on ? `linear-gradient(${theme.goldButtonTop},${theme.goldButtonBottom})` : 'transparent', color: on ? '#3f280a' : '#b9c0cf' }) as const

  return (
    <div style={{ maxWidth: 360, margin: '0 auto', padding: '26px 20px 22px', display: 'flex', flexDirection: 'column', minHeight: '100dvh', color: theme.ink }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 46, letterSpacing: 3, color: theme.gold, textShadow: '0 2px 0 #7a4e12, 0 6px 14px rgba(0,0,0,.5)', lineHeight: 1 }}>TOCK</div>
        <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#cdb277', marginTop: 6, opacity: 0.8 }}>course de billes</div>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,216,115,.35), transparent)', margin: '20px 0 16px' }} />

      <div style={label}>Joueurs</div>

      <div style={{ ...rowBase, background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.07)' }}>
        <Dot color={colorOf(0)} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Vous · {colorLabel[colorOf(0)]}</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: '#4a2f0c', background: `linear-gradient(${theme.goldButtonTop},${theme.goldButtonBottom})`, padding: '5px 12px', borderRadius: theme.radius.pill }}>JOUEUR</span>
      </div>

      {opponentSeatList.map((seat, index) => {
        const kind = opponentKindList[index] ?? 'inactive'
        const color = colorOf(seat)
        if (kind === 'inactive') {
          return (
            <button key={seat} aria-label={`ajouter le joueur ${seat}`} onClick={() => setKind(index, 'bot')}
              style={{ ...rowBase, width: '100%', background: 'transparent', border: '1px dashed rgba(255,255,255,.16)', cursor: 'pointer', color: theme.inkDim }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px dashed ${seatColor[color].light}`, opacity: 0.55, flex: 'none' }} />
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>Ajouter {colorLabel[color]}</span>
              <span style={{ marginLeft: 'auto', fontSize: 20, color: theme.gold, fontWeight: 700 }}>+</span>
            </button>
          )
        }
        return (
          <div key={seat} data-testid={`seat-${seat}`} style={{ ...rowBase, background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.07)' }}>
            <Dot color={color} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{colorLabel[color]}</span>
            <div style={seg}>
              <button aria-label="humain" onClick={() => setKind(index, 'human')} style={opt(kind === 'human')}>Humain</button>
              <button aria-label="bot" onClick={() => setKind(index, 'bot')} style={opt(kind === 'bot')}>Bot</button>
            </div>
            <button aria-label={`retirer le joueur ${seat}`} onClick={() => setKind(index, 'inactive')}
              style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer', flex: 'none', background: 'rgba(255,255,255,.08)', color: '#cbb', fontSize: 15 }}>×</button>
          </div>
        )
      })}

      <div style={{ ...label, marginTop: 18 }}>Plateau</div>
      <div style={{ display: 'flex', gap: 10 }}>
        {RING_SIZE_OPTIONS.map(size => {
          const on = ringSize === size
          return (
            <button key={size} aria-pressed={on} onClick={() => setRingSize(size)}
              style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRadius: 13, cursor: 'pointer', background: on ? 'rgba(255,216,115,.12)' : 'rgba(255,255,255,.045)', border: on ? '1px solid rgba(255,216,115,.55)' : '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ fontFamily: theme.fontDisplay, fontWeight: 600, fontSize: 15, color: on ? theme.gold : theme.ink }}>{size === RING_SIZE_OPTIONS[0] ? 'Standard' : 'Grand'}</div>
              <div style={{ fontSize: 11, color: theme.inkDim, marginTop: 2 }}>{size} cases · {size === RING_SIZE_OPTIONS[0] ? 'vif' : 'long'}</div>
            </button>
          )
        })}
      </div>

      <button onClick={handleStart}
        style={{ marginTop: 'auto', fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 19, color: '#4a2f0c', background: `linear-gradient(${theme.goldButtonTop}, ${theme.goldButtonBottom})`, border: 'none', borderRadius: theme.radius.lg, padding: 16, boxShadow: `0 6px 0 ${theme.goldButtonLip}, 0 12px 20px rgba(0,0,0,.45)`, cursor: 'pointer', marginTop: 24 }}>
        Lancer la partie
      </button>
    </div>
  )
}
```

Note: the two `marginTop` keys — keep only one. Use `marginTop: 24` on the CTA (drop the `'auto'`), or wrap the CTA in a spacer. For the plan, set the CTA `marginTop: 24` and add `<div style={{ flex: 1 }} />` before it so it sits at the bottom.

- [ ] **Step 4: Run — expect PASS**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/setup.test.tsx`
Expected: PASS.

- [ ] **Step 5: Visual check against `menu.html`, then commit**

```bash
git add apps/web/src/components/Setup.tsx apps/web/tests/setup.test.tsx
git commit -m "feat(web): chairs-based setup menu"
```

---

## Task 11: GameScreen — discreet hint chip, discard flow, wiring

**Files:**
- Modify: `apps/web/src/components/GameScreen.tsx`
- Test: `apps/web/tests/gameScreen.test.tsx` (hint chip text + turn/prompt split)

**Interfaces:**
- Consumes: unchanged `moveSelection` / `splitAllocation` helpers, `Board`, `Hand`, `StatusBar`, `GameLog`, `SplitControls`. Splits the single `prompt` into a **turn line** (passed to StatusBar) and an **action hint** (the chip). Keeps `commitMove`, the interaction state machine, and the split UI.

- [ ] **Step 1: Adjust the test**

In `apps/web/tests/gameScreen.test.tsx`, assert the hint chip text on a human turn (e.g. `expect(screen.getByText('choisis où poser ta bille')).toBeInTheDocument()` when in the `ghosts` phase) and the StatusBar turn line ("À toi de jouer"). Update any assertions referencing the old combined prompt string.

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/gameScreen.test.tsx`
Expected: FAIL on new copy.

- [ ] **Step 3: Implement `GameScreen.tsx`**

Keep the entire existing interaction machine (phases `pickCard | ghosts | swapTarget | split`, `handleCard`, `handleGhost`, split candidates/controls) verbatim; change only (a) the prompt split, (b) the hint chip render, and (c) the container/styling. Full file:

```tsx
import { useMemo, useState } from 'react'
import type { GameState, MarbleId, Move, PlayerId } from '@tock/core'
import { colorOf, getLegalMoves } from '@tock/core'
import { isHumanSeat } from '../hooks/useBotAutoplay'
import { activeHumanSeat } from '../passAndPlay'
import type { Ghost as GhostType } from '../moveSelection'
import { ghostsForCard, handIsPlayable, isDiscardOnly, isSplitCard, movesForCard, ownSwapMarbleIds, swapTargetsFor } from '../moveSelection'
import type { SplitDraft } from '../splitAllocation'
import { allocate, completedSplitMove, splitCandidateIds, splitGhostsForMarble, splitRemaining, startSplit, undoLast } from '../splitAllocation'
import { marbleCenter } from '../svgGeometry'
import { theme } from '../theme'
import { Board } from './Board'
import { Hand } from './Hand'
import { StatusBar } from './StatusBar'
import { GameLog } from './GameLog'
import { SplitControls } from './SplitControls'

type GameScreenProps = { state: GameState, logList: string[], humanSeatIds: PlayerId[], commitMove: (move: Move) => void }

type Interaction =
  | { phase: 'pickCard' }
  | { phase: 'ghosts', cardIndex: number }
  | { phase: 'swapTarget', cardIndex: number, marbleId: MarbleId }
  | { phase: 'split', cardIndex: number, draft: SplitDraft, focusMarbleId: MarbleId | null }

export const GameScreen = ({ state, logList, humanSeatIds, commitMove }: GameScreenProps) => {
  const [interaction, setInteraction] = useState<Interaction>({ phase: 'pickCard' })

  const legalMoves = useMemo(
    () => (isHumanSeat(state, humanSeatIds) && state.winner === null ? getLegalMoves(state, state.currentPlayer) : []),
    [state, humanSeatIds]
  )

  const handSeat = activeHumanSeat(state, humanSeatIds) ?? state.currentPlayer
  const hand = state.playerList.find(player => player.id === handSeat)?.hand ?? []
  const humanTurn = isHumanSeat(state, humanSeatIds)
  const playableList = hand.map(card => humanTurn && handIsPlayable(card, legalMoves))
  const noMovePlayable = humanTurn && legalMoves.length > 0 && playableList.every(value => value === false)

  const resetInteraction = () => setInteraction({ phase: 'pickCard' })
  const doCommit = (move: Move) => { commitMove(move); resetInteraction() }

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
        const slot = state.marbleList.filter(candidate => candidate.owner === marble?.owner).findIndex(candidate => candidate.id === target)
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
    if (isDiscardOnly(card, legalMoves)) { const first = movesForCard(card, legalMoves)[0]; if (first) doCommit(first); return }
    if (isSplitCard(card, legalMoves)) { setInteraction({ phase: 'split', cardIndex: index, draft: startSplit(card), focusMarbleId: null }); return }
    const own = ownSwapMarbleIds(card, legalMoves)[0]
    if (own) { setInteraction({ phase: 'swapTarget', cardIndex: index, marbleId: own }); return }
    setInteraction({ phase: 'ghosts', cardIndex: index })
  }

  const handleGhost = (key: string) => {
    const ghost = ghostList.find(entry => entry.key === key)
    if (!ghost) return
    if (interaction.phase === 'split') {
      const part = ghost.move.type === 'split7' ? ghost.move.partList[0] : undefined
      if (!part) return
      setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: allocate(interaction.draft, part), focusMarbleId: null })
      return
    }
    doCommit(ghost.move)
  }

  const splitCard = interaction.phase === 'split' ? hand[interaction.cardIndex] : undefined
  const splitCandidates = interaction.phase === 'split' && splitCard ? splitCandidateIds(splitCard, legalMoves) : []

  const turnLine = humanTurn ? 'À toi de jouer' : `${colorOf(state.currentPlayer)} réfléchit…`
  const hint = !humanTurn ? '' : noMovePlayable ? 'aucun coup — touche une carte pour la défausser'
    : interaction.phase === 'split' ? 'répartis le 7' : interaction.phase === 'pickCard' ? 'choisis une carte' : 'choisis où poser ta bille'
  const selectedIndex = interaction.phase === 'pickCard' ? -1 : interaction.cardIndex

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <StatusBar turnColor={colorOf(state.currentPlayer)} drawCount={state.drawPile.length} discardCount={state.discardPile.length} prompt={turnLine} />
      <GameLog logList={logList} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
        <Board state={state} ghostList={ghostList.map(ghost => ({ key: ghost.key, cx: ghost.cx, cy: ghost.cy, label: ghost.label }))} onGhost={handleGhost} />
      </div>
      {interaction.phase === 'split' && (
        <>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', padding: '0 8px' }}>
            {splitCandidates.map(id => (
              <button key={id} onClick={() => setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: interaction.draft, focusMarbleId: id })}
                style={{ fontFamily: theme.fontUi, fontSize: 12, fontWeight: 600, border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '6px 10px', background: 'rgba(255,255,255,.06)', color: theme.ink, cursor: 'pointer' }}>{id}</button>
            ))}
          </div>
          <SplitControls
            remaining={splitRemaining(interaction.draft)}
            canPlay={completedSplitMove(interaction.draft, legalMoves) !== undefined}
            onUndo={() => setInteraction({ phase: 'split', cardIndex: interaction.cardIndex, draft: undoLast(interaction.draft), focusMarbleId: null })}
            onPlay={() => { const done = completedSplitMove(interaction.draft, legalMoves); if (done) doCommit(done) }}
          />
        </>
      )}
      {hint && (
        <div style={{ alignSelf: 'center', margin: '2px 0 8px', fontSize: 12, color: 'rgba(232,234,240,.62)', background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.13)', borderRadius: theme.radius.sm, padding: '4px 12px' }}>{hint}</div>
      )}
      <Hand hand={hand} playableList={playableList} selectedIndex={selectedIndex} onSelect={handleCard} />
    </div>
  )
}
```

- [ ] **Step 4: Run the GameScreen (and StatusBar) tests — expect PASS**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/gameScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/GameScreen.tsx apps/web/tests/gameScreen.test.tsx
git commit -m "feat(web): discreet hint chip + turn line split in game screen"
```

---

## Task 12: SplitControls — 7-pip budget gauge

**Files:**
- Modify: `apps/web/src/components/SplitControls.tsx`
- Test: `apps/web/tests/splitControls.test.tsx` (keep behaviour; add pip count)

**Interfaces:**
- Produces: `SplitControls` props unchanged `{ remaining, canPlay, onUndo, onPlay }`. Renders 7 pips (7 − remaining filled), a "Reste N"/"0 ✓" readout, an "Annuler" button (`onUndo`), and a "Jouer le 7" button disabled unless `canPlay`.

- [ ] **Step 1: Adjust the test**

In `apps/web/tests/splitControls.test.tsx`, keep the existing onUndo/onPlay/disabled tests, updating button names to `Annuler` and `Jouer le 7`. Add:
```tsx
it('renders seven pips with the spent ones filled', () => {
  const { container } = render(<SplitControls remaining={4} canPlay={false} onUndo={() => {}} onPlay={() => {}} />)
  expect(container.querySelectorAll('[data-pip]').length).toBe(7)
  expect(container.querySelectorAll('[data-pip="on"]').length).toBe(3)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/splitControls.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `SplitControls.tsx`**

```tsx
import { theme } from '../theme'

type SplitControlsProps = { remaining: number, canPlay: boolean, onUndo: () => void, onPlay: () => void }

export const SplitControls = ({ remaining, canPlay, onUndo, onPlay }: SplitControlsProps) => {
  const spent = 7 - remaining
  const mini = { fontFamily: theme.fontUi, fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 9, padding: '7px 12px', cursor: 'pointer' } as const
  return (
    <div style={{ margin: '0 16px', background: 'rgba(0,0,0,.24)', borderRadius: theme.radius.md, padding: '9px 11px' }}>
      <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 8 }}>
        {Array.from({ length: 7 }, (_unused, index) => {
          const on = index < spent
          return <span key={index} data-pip={on ? 'on' : 'off'} style={{ width: 13, height: 13, borderRadius: '50%', border: on ? 'none' : '1.5px solid rgba(255,216,115,.55)', background: on ? `linear-gradient(${theme.goldButtonTop},${theme.goldButtonBottom})` : 'transparent' }} />
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        <span style={{ fontFamily: theme.fontDisplay, fontWeight: 600, fontSize: 13, color: remaining === 0 ? '#86e6a0' : '#ffe6a6' }}>{remaining === 0 ? '0 ✓' : `Reste ${remaining}`}</span>
        <button onClick={onUndo} style={{ ...mini, background: 'rgba(255,255,255,.08)', color: '#cdd3df' }}>Annuler</button>
        <button onClick={onPlay} disabled={!canPlay} style={{ ...mini, background: `linear-gradient(${theme.goldButtonTop},${theme.goldButtonBottom})`, color: '#3f280a', opacity: canPlay ? 1 : 0.4 }}>Jouer le 7</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/splitControls.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/SplitControls.tsx apps/web/tests/splitControls.test.tsx
git commit -m "feat(web): 7-pip split budget gauge"
```

---

## Task 13: GameOver — winner marble + confetti

**Files:**
- Create: `apps/web/src/components/Confetti.tsx`
- Modify: `apps/web/src/components/GameOver.tsx`
- Modify: `apps/web/tests/app.test.tsx` (GameOver copy) or add `apps/web/tests/gameOver.test.tsx`

**Interfaces:**
- Produces: `Confetti` component (no props) — renders ~26 falling pieces via `.tock-confetti` class. `GameOver` props unchanged `{ winnerColor: Color, onRestart: () => void }`; button text **"Rejouer"**.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/gameOver.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameOver } from '../src/components/GameOver'

describe('GameOver', () => {
  it('announces the winner and replays', async () => {
    const onRestart = vi.fn()
    render(<GameOver winnerColor="red" onRestart={onRestart} />)
    expect(screen.getByText(/gagne/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Rejouer' }))
    expect(onRestart).toHaveBeenCalledOnce()
  })
})
```
Also update any assertion in `apps/web/tests/app.test.tsx` that queries "Play again" → "Rejouer".

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/gameOver.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `Confetti.tsx` and `GameOver.tsx`**

`Confetti.tsx`:
```tsx
import { useMemo } from 'react'
import { seatColor } from '../theme'

// A fixed set of falling pieces. Positions/timings are derived from the index
// (no Math.random) so the render is deterministic and SSR/test-safe.
export const Confetti = () => {
  const pieceList = useMemo(() => {
    const palette = ['#ffd873', seatColor.red.light, seatColor.green.light, seatColor.blue.light, seatColor.yellow.light]
    return Array.from({ length: 26 }, (_unused, index) => ({
      left: (index * 37) % 100,
      color: palette[index % palette.length] ?? '#ffd873',
      duration: 2.4 + (index % 5) * 0.4,
      delay: (index % 7) * 0.4
    }))
  }, [])
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {pieceList.map((piece, index) => (
        <span key={index} className="tock-confetti" style={{ position: 'absolute', top: -14, left: `${piece.left}%`, width: 8, height: 12, borderRadius: 2, background: piece.color, animationDuration: `${piece.duration}s`, animationDelay: `${piece.delay}s`, animationIterationCount: 'infinite', animationTimingFunction: 'linear' }} />
      ))}
    </div>
  )
}
```
Append to `index.css`: `.tock-confetti { animation-name: tock-confetti; }`

`GameOver.tsx`:
```tsx
import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'
import { Confetti } from './Confetti'

type GameOverProps = { winnerColor: Color, onRestart: () => void }
const colorLabel: Record<Color, string> = { red: 'Rouge', green: 'Vert', yellow: 'Jaune', blue: 'Bleu' }

export const GameOver = ({ winnerColor, onRestart }: GameOverProps) => (
  <div style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: theme.ink, textAlign: 'center', padding: 20 }}>
    <Confetti />
    <div style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 18, letterSpacing: 2, color: theme.gold, opacity: 0.85 }}>TOCK</div>
    <div className="tock-bob" style={{ width: 84, height: 84, borderRadius: '50%', margin: '8px 0 12px', background: `radial-gradient(circle at 35% 30%, ${seatColor[winnerColor].light}, ${seatColor[winnerColor].dark})`, boxShadow: `0 0 40px rgba(${seatColor[winnerColor].soft},.65), 0 10px 20px rgba(0,0,0,.5)` }} />
    <div style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 30, color: seatColor[winnerColor].light }}>{colorLabel[winnerColor]} gagne&nbsp;!</div>
    <div style={{ fontSize: 13.5, color: '#c9cfdb', marginBottom: 26 }}>Toutes ses billes sont rentrées.</div>
    <button onClick={onRestart} style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 17, color: '#4a2f0c', background: `linear-gradient(${theme.goldButtonTop},${theme.goldButtonBottom})`, border: 'none', borderRadius: theme.radius.lg, padding: '14px 34px', boxShadow: `0 6px 0 ${theme.goldButtonLip}, 0 12px 20px rgba(0,0,0,.45)`, cursor: 'pointer' }}>Rejouer</button>
  </div>
)
```

- [ ] **Step 4: Run — expect PASS**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/gameOver.test.tsx tests/app.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Confetti.tsx apps/web/src/components/GameOver.tsx apps/web/src/index.css apps/web/tests/gameOver.test.tsx apps/web/tests/app.test.tsx
git commit -m "feat(web): game over screen with winner marble and confetti"
```

---

## Task 14: PassInterstitial — hidden hand + CTA

**Files:**
- Modify: `apps/web/src/components/PassInterstitial.tsx`
- Test: `apps/web/tests/passInterstitial.test.tsx` (copy update)

**Interfaces:**
- Produces: `PassInterstitial` props unchanged `{ color: Color, onReveal: () => void }`; button text **"Révéler ma main"**; shows the next player's colour name.

- [ ] **Step 1: Adjust the test**

Update `apps/web/tests/passInterstitial.test.tsx`: query the button by name `Révéler ma main` and assert the colour name (e.g. "Vert") appears. Keep the `onReveal` click assertion.

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/passInterstitial.test.tsx`
Expected: FAIL (old English copy).

- [ ] **Step 3: Implement `PassInterstitial.tsx`**

```tsx
import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'

type PassInterstitialProps = { color: Color, onReveal: () => void }
const colorLabel: Record<Color, string> = { red: 'Rouge', green: 'Vert', yellow: 'Jaune', blue: 'Bleu' }

export const PassInterstitial = ({ color, onReveal }: PassInterstitialProps) => (
  <div style={{ position: 'fixed', inset: 0, background: theme.feltGradient, color: theme.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#cdb277', opacity: 0.8, marginBottom: 14 }}>passe le téléphone</div>
    <div className="tock-bob" style={{ width: 70, height: 70, borderRadius: '50%', marginBottom: 18, background: `radial-gradient(circle at 35% 30%, ${seatColor[color].light}, ${seatColor[color].dark})`, boxShadow: `0 0 34px rgba(${seatColor[color].soft},.6), 0 8px 18px rgba(0,0,0,.5)` }} />
    <div style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 24 }}>À <span style={{ color: seatColor[color].light }}>{colorLabel[color]}</span> de jouer</div>
    <div style={{ fontSize: 13, color: theme.inkDim, marginBottom: 26 }}>Passe l'appareil, puis révèle ta main.</div>
    <button onClick={onReveal} style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 17, color: '#4a2f0c', background: `linear-gradient(${theme.goldButtonTop},${theme.goldButtonBottom})`, border: 'none', borderRadius: theme.radius.lg, padding: '14px 34px', boxShadow: `0 6px 0 ${theme.goldButtonLip}, 0 12px 20px rgba(0,0,0,.45)`, cursor: 'pointer' }}>Révéler ma main</button>
    <div style={{ display: 'flex', marginTop: 26 }} aria-hidden>
      {Array.from({ length: 5 }, (_unused, index) => (
        <span key={index} style={{ width: 34, height: 48, borderRadius: 6, margin: '0 -4px', background: theme.cardBack, border: '1px solid rgba(255,216,115,.25)', boxShadow: '0 4px 8px rgba(0,0,0,.4)' }} />
      ))}
    </div>
  </div>
)
```

- [ ] **Step 4: Run — expect PASS**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/passInterstitial.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/PassInterstitial.tsx apps/web/tests/passInterstitial.test.tsx
git commit -m "feat(web): themed pass-the-phone interstitial with hidden hand"
```

---

## Task 15: Screen transitions

**Files:**
- Create: `apps/web/src/components/ScreenTransition.tsx`
- Modify: `apps/web/src/components/App.tsx`
- Test: `apps/web/tests/app.test.tsx` (routing still works)

**Interfaces:**
- Produces: `ScreenTransition` props `{ screenKey: string, cover?: boolean, children: React.ReactNode }` — crossfades on `screenKey` change (fast opaque cover when `cover`). Uses Framer Motion `AnimatePresence`; honours `prefersReducedMotion()` (no animation).
- Consumes: `motion` (Framer Motion), `duration`, `prefersReducedMotion` (motion.ts).

- [ ] **Step 1: Write the failing test**

Add to `apps/web/tests/app.test.tsx` a test that the app still routes Setup → GameScreen after starting (i.e. wrapping in ScreenTransition does not break rendering). Keep existing App routing tests. Add:
```tsx
it('renders the setup screen at start (wrapped in a transition)', () => {
  render(<App />)
  expect(screen.getByRole('button', { name: 'Lancer la partie' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify current App routing tests still target old copy**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/app.test.tsx`
Expected: the new assertion FAILS only if App copy differs; align copy from earlier tasks.

- [ ] **Step 3: Implement `ScreenTransition.tsx`**

```tsx
import { AnimatePresence, motion } from 'motion/react'
import { duration, prefersReducedMotion } from '../motion'

type ScreenTransitionProps = { screenKey: string, cover?: boolean, children: React.ReactNode }

export const ScreenTransition = ({ screenKey, cover, children }: ScreenTransitionProps) => {
  const reduced = prefersReducedMotion()
  const fade = cover ? duration.fast : duration.base
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screenKey}
        initial={reduced ? false : { opacity: 0, scale: cover ? 1 : 1.03 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduced ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: reduced ? 0 : fade, ease: [0.7, 0, 0.84, 0] }}
        style={{ height: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Wire into `App.tsx`**

Keep all existing routing logic; wrap the returned screen in `ScreenTransition` with a `screenKey` reflecting the active screen, using `cover` for the pass interstitial. Replace the final render block of `App.tsx`:
```tsx
  const screen = (() => {
    if (!state) return { key: 'setup', cover: false, node: <Setup onStart={(kindList, ringSize) => start(kindList, ringSize)} /> }
    if (state.winner !== null) return { key: 'over', cover: false, node: <GameOver winnerColor={colorOf(state.winner)} onRestart={handleRestart} /> }
    if (awaitingHandoff) return { key: `pass-${state.currentPlayer}`, cover: true, node: <PassInterstitial color={colorOf(state.currentPlayer)} onReveal={() => setAwaitingHandoff(false)} /> }
    return { key: 'game', cover: false, node: <GameScreen state={state} logList={logList} humanSeatIds={humanIdList} commitMove={commitAndPass} /> }
  })()

  return <ScreenTransition screenKey={screen.key} cover={screen.cover}>{screen.node}</ScreenTransition>
```
Add `import { ScreenTransition } from './ScreenTransition'` and keep the existing imports/hooks above unchanged.

- [ ] **Step 5: Run the full app + smoke tests — expect PASS**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/app.test.tsx tests/smoke.test.tsx tests/handoff.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ScreenTransition.tsx apps/web/src/components/App.tsx apps/web/tests/app.test.tsx
git commit -m "feat(web): screen transitions with fast pass-handoff cover"
```

---

## Task 16: Full verification + visual QA against mockups

**Files:** none (verification only; small fixes as needed)

- [ ] **Step 1: Full web test suite**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test`
Expected: all green. Fix any residual assertions referencing old copy/markup.

- [ ] **Step 2: Typecheck the workspace**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm -r typecheck`
Expected: clean (0 errors). Confirm no lingering `HOLE_R`/`CELL` mismatches and no non-null assertions were introduced.

- [ ] **Step 3: Production build**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web build`
Expected: build succeeds; fonts bundled.

- [ ] **Step 4: Visual QA against the mockups**

Run `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web dev`. On a phone-width viewport, walk each screen and compare to the mockups in `docs/superpowers/specs/2026-07-22-tock-web-visual-redesign-mockups/`:
- menu (`menu.html`) — colour seats, chairs add/remove, segmented role, size cards, hero CTA
- game (`game-screen.html`, `board.html`) — felt ring, sockets, gold finish threads to emblem, clockwise homes, ticker log, hint chip, suited hand, echo destinations, draw motion
- interactions (`interactions.html`) — 7-pip gauge, ⇄ swap, discard reverse-draw
- endgame (`endgame.html`) — winner marble + confetti; pass hidden hand
- transitions (`transitions.html`) — fade+accel; fast opaque cover on handoff
Toggle OS "reduce motion" and confirm animations become near-instant.

- [ ] **Step 5: Final commit (if fixes were made)**

```bash
git add -A apps/web
git commit -m "chore(web): visual QA fixes for the feutrine & or redesign"
```

---

## Self-Review

**1. Spec coverage:**
- §1bis visual reference → Task 16 QA maps each mockup; §2 direction → Tasks 1,10,11 (gold restraint, one hero button). §3 tokens/type/fonts → Task 1. §3.3 fonts → Task 1. §4 board (B ring, carved sockets, C gold threads to emblem, clockwise homes, start rings, emblem, marbles) → Tasks 3,4,6. §5.1 menu → Task 10. §5.2 game layout (top bar, ticker, board, hint) → Tasks 7,8,11. §5.3 hand → Task 9. §5.4 interactions (7 gauge, ⇄ swap, discard reverse-draw) → Tasks 12,11 (+ existing moveSelection/splitAllocation reused). §5.5 GameOver+confetti → Task 13. §5.6 Pass → Task 14. §6 motion (echo, draw, discard, bob, reduced-motion) → Tasks 2,5,7,9,11 + index.css. §7 transitions → Task 15. §8 file map → matches. §9 testing impact (preserved hooks, updated Setup/Start/GameOver/Pass tests) → Tasks 6,9,10,13,14. §10 non-goals → respected (no core/terminal edits; no new features). §11 animation library (Framer Motion) → Task 15 + Task 1 dep.
- Marble spring movement (§4/§6): CSS transition on the Marble `<g>` (Task 4) covers position tweening; full Framer-Motion spring on marbles is optional polish and not separately required for correctness. Capture pop + screen-shake + "PRISE!" (§6): **not yet a dedicated task** — see gap below.

**Gap found → resolution:** The capture "juice" (pop + screen-shake + "PRISE !" label) in §6 has no dedicated task. It depends on capture detection between states, which is derivable but non-trivial. Rather than leave a placeholder, treat it as an **optional enhancement task** appended below; the redesign is complete and shippable without it, and it can be built on top once the static redesign lands.

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". The one `marginTop` duplication in Task 10 Step 3 is explicitly called out with the fix (spacer div + single `marginTop`). Confirm during implementation.

**3. Type consistency:** `seatColor[color].soft` (Task 1) is consumed as an "r,g,b" string in Tasks 6,7,13,14 — consistent. `finishThread`/`ringChannelPath`/`boardCenter`/`homeSlotCenter` signatures (Task 3) match their consumers in Task 6. `SplitControls`/`Hand`/`Board`/`StatusBar`/`GameOver`/`PassInterstitial` prop shapes are unchanged from the current code, so `GameScreen`/`App` wiring stays valid.

---

## Task 17 (optional enhancement): Capture juice — pop + shake + "PRISE !"

Deferred, additive. Detect a capture by diffing marble positions before/after `applyMove` in `useTockGame.commitMove` (a marble that returned to home / left the ring for a home slot on an opponent's move), expose a transient `lastCapture` signal, and in `GameScreen` render a brief screen-shake (a wrapper class toggled for ~250ms) plus a floating "PRISE !" label near the captured cell, both gated on `prefersReducedMotion()`. Build only after Tasks 1–16 are merged and verified.

---
```

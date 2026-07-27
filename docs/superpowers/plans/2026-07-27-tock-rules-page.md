# Rules Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rules page to the mobile web app — a card-first reference in a single overlay panel, reachable from Home, Setup, and (via a "?" button) during play.

**Architecture:** One `RulesOverlay` dialog owned by `App` and rendered above `ScreenTransition` (sibling of `UpdateBanner`), so it layers over any screen without touching game state. `App` holds a `rulesOpen` boolean and passes an `onOpenRules` callback to the three screens that offer a trigger (a shared `RulesButton`). Content lives in a pure data module `rulesContent.ts`.

**Tech Stack:** React 19, TypeScript (strict), Vite, `motion/react` (Framer Motion), Vitest + jsdom + @testing-library/react. `apps/web` only — `@tock/core` and `apps/terminal` untouched.

## Global Constraints

- Scope: `apps/web` only. Do not modify `@tock/core` or `apps/terminal`.
- All user-facing copy is French; all identifiers and comments are English.
- Code Style: no semicolons, no trailing commas, no `function` keyword (const arrow functions), no non-null assertions (`!`) in production code (tests may use them), max warnings 0.
- Naming: components PascalCase, hooks `use*`, handlers `handle*`, variables camelCase and non-plural (e.g. `cardRuleList`, not `cardRules`).
- Reuse existing design tokens from `apps/web/src/theme.ts`, motion tokens from `apps/web/src/motion.ts`, and safe-area composers `safeTop`/`safeBottom` from `apps/web/src/layout.ts`. Do not add new tokens.
- Card rank glyphs shown on the rules page must match what the engine puts on the cards and what `Hand.tsx` renders: `A K Q J` and the numbers — not French `R D V`.
- Test conventions (match existing files): `import { render, screen, fireEvent } from '@testing-library/react'`, `import userEvent from '@testing-library/user-event'`, `import { describe, expect, it, vi } from 'vitest'`. Tests live in `apps/web/tests/`.
- Run commands from the repo root. Node 24 is required — prefix pnpm/node with the nvm v24 PATH if the shell defaults to Node 18.

---

### Task 1: Rules content data

The single source of truth for the page's copy, as a pure, testable module. No React here.

**Files:**
- Create: `apps/web/src/rulesContent.ts`
- Test: `apps/web/tests/rulesContent.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type CardRule = { ranks: string[], effect: string }`
  - `type SpecialMove = { title: string, text: string }`
  - `const rulesGoal: string`
  - `const cardRuleList: CardRule[]`
  - `const specialMoveList: SpecialMove[]`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/rulesContent.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cardRuleList, rulesGoal, specialMoveList } from '../src/rulesContent'

const everyRank = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

describe('rulesContent', () => {
  it('states a non-empty goal', () => {
    expect(rulesGoal.length).toBeGreaterThan(0)
  })

  it('covers all 13 card ranks exactly once', () => {
    const listed = cardRuleList.flatMap(rule => rule.ranks)
    expect(listed.slice().sort()).toEqual(everyRank.slice().sort())
  })

  it('gives every card rule a non-empty effect and at least one rank', () => {
    for (const rule of cardRuleList) {
      expect(rule.ranks.length).toBeGreaterThan(0)
      expect(rule.effect.length).toBeGreaterThan(0)
    }
  })

  it('lists the three special moves with non-empty text', () => {
    expect(specialMoveList).toHaveLength(3)
    for (const move of specialMoveList) {
      expect(move.title.length).toBeGreaterThan(0)
      expect(move.text.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tock/web test tests/rulesContent.test.ts`
Expected: FAIL — cannot resolve `../src/rulesContent`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/rulesContent.ts`:

```ts
// Copy for the rules page, kept as pure data so it is testable in isolation and
// the overlay stays presentational. Ranks match the engine's rank letters and
// what Hand.tsx renders on the cards (A K Q J, not R D V). Effects are verified
// against packages/core/src/engine/{cards,moves}.ts.
export type CardRule = { ranks: string[], effect: string }
export type SpecialMove = { title: string, text: string }

export const rulesGoal = 'Ramène tes quatre billes dans ton couloir avant les autres.'

export const cardRuleList: CardRule[] = [
  { ranks: ['A'], effect: 'sortir une bille ou avancer de 1' },
  { ranks: ['K'], effect: 'sortir une bille ou avancer de 13' },
  { ranks: ['Q'], effect: 'avancer de 12' },
  { ranks: ['J'], effect: 'échanger deux billes, une à toi et une adverse' },
  { ranks: ['7'], effect: 'répartir 7 pas entre tes billes' },
  { ranks: ['5'], effect: 'avancer une bille adverse de 5' },
  { ranks: ['4'], effect: 'reculer de 4, jamais vers la maison' },
  { ranks: ['2', '3', '6', '8', '9', '10'], effect: 'avancer du nombre indiqué' }
]

export const specialMoveList: SpecialMove[] = [
  { title: 'Capture', text: 'Te poser sur une bille adverse sur l’anneau la renvoie à son nid. Une bille à toi bloque la case.' },
  { title: 'Protection', text: 'Une bille posée sur sa case de départ ne peut être ni capturée ni échangée.' },
  { title: 'Entrée dans la maison', text: 'Une bille rejoint son couloir en franchissant sa bouche vers l’avant, avec le compte exact pour s’y poser.' }
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tock/web test tests/rulesContent.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm --filter @tock/web typecheck`

```bash
git add apps/web/src/rulesContent.ts apps/web/tests/rulesContent.test.ts
git commit -m "feat(web): add rules page content data"
```

---

### Task 2: Shared RulesButton trigger

A single gold trigger used at all three access points, so the affordance looks identical and its styling lives in one place.

**Files:**
- Create: `apps/web/src/components/RulesButton.tsx`
- Test: `apps/web/tests/rulesButton.test.tsx`

**Interfaces:**
- Consumes: `theme` from `../theme`.
- Produces: `const RulesButton: (props: { onClick: () => void, variant?: 'icon' | 'text' }) => JSX.Element`. Always renders a `<button>` with `aria-label="Ouvrir les règles"`. `variant` defaults to `'icon'` (renders `?`); `'text'` renders the word `Règles`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/rulesButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RulesButton } from '../src/components/RulesButton'

describe('RulesButton', () => {
  it('fires onClick and exposes an accessible label', async () => {
    const onClick = vi.fn()
    render(<RulesButton onClick={onClick} />)
    const button = screen.getByLabelText('Ouvrir les règles')
    expect(button).toHaveTextContent('?')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders the word "Règles" in the text variant', () => {
    render(<RulesButton onClick={() => {}} variant="text" />)
    expect(screen.getByLabelText('Ouvrir les règles')).toHaveTextContent('Règles')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tock/web test tests/rulesButton.test.tsx`
Expected: FAIL — cannot resolve `../src/components/RulesButton`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/RulesButton.tsx`:

```tsx
import { theme } from '../theme'

type RulesButtonProps = { onClick: () => void, variant?: 'icon' | 'text' }

const iconStyle = {
  width: 30, height: 30, borderRadius: '50%', flex: 'none',
  border: `1px solid rgba(255,216,115,.35)`, background: 'rgba(0,0,0,.25)',
  color: theme.gold, fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 15,
  lineHeight: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
} as const

const textStyle = {
  border: `1px solid rgba(255,216,115,.3)`, background: 'transparent',
  color: theme.goldDim, fontFamily: theme.fontUi, fontSize: 13, fontWeight: 600,
  borderRadius: theme.radius.pill, padding: '8px 18px', cursor: 'pointer'
} as const

export const RulesButton = ({ onClick, variant = 'icon' }: RulesButtonProps) => (
  <button type="button" aria-label="Ouvrir les règles" onClick={onClick} style={variant === 'text' ? textStyle : iconStyle}>
    {variant === 'text' ? 'Règles' : '?'}
  </button>
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tock/web test tests/rulesButton.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm --filter @tock/web typecheck`

```bash
git add apps/web/src/components/RulesButton.tsx apps/web/tests/rulesButton.test.tsx
git commit -m "feat(web): add shared RulesButton trigger"
```

---

### Task 3: RulesOverlay dialog

The overlay itself: scrim + felt panel, header with title and close, scrollable card-first body, closes via ✕ / backdrop / Escape, motion gated by reduced-motion, safe-area aware.

**Files:**
- Create: `apps/web/src/components/RulesOverlay.tsx`
- Test: `apps/web/tests/rulesOverlay.test.tsx`

**Interfaces:**
- Consumes: `rulesGoal`, `cardRuleList`, `specialMoveList` from `../rulesContent`; `theme` from `../theme`; `duration`, `prefersReducedMotion` from `../motion`; `safeTop`, `safeBottom` from `../layout`; `AnimatePresence`, `motion` from `motion/react`.
- Produces: `const RulesOverlay: (props: { open: boolean, onClose: () => void }) => JSX.Element`. When `open`, renders a `role="dialog"` panel inside a backdrop with `data-testid="rules-backdrop"`; the title has `id="rules-title"` and the panel is `aria-labelledby="rules-title"`. A close button carries `aria-label="Fermer les règles"`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/rulesOverlay.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RulesOverlay } from '../src/components/RulesOverlay'
import { rulesGoal } from '../src/rulesContent'

describe('RulesOverlay', () => {
  it('renders the goal, a card rule and a special move when open', () => {
    render(<RulesOverlay open onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(rulesGoal)).toBeInTheDocument()
    expect(screen.getByText('avancer de 12')).toBeInTheDocument()
    expect(screen.getByText('Capture')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(<RulesOverlay open={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes via the ✕ button', async () => {
    const onClose = vi.fn()
    render(<RulesOverlay open onClose={onClose} />)
    await userEvent.click(screen.getByLabelText('Fermer les règles'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a backdrop tap but not on a panel tap', async () => {
    const onClose = vi.fn()
    render(<RulesOverlay open onClose={onClose} />)
    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('rules-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<RulesOverlay open onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tock/web test tests/rulesOverlay.test.tsx`
Expected: FAIL — cannot resolve `../src/components/RulesOverlay`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/RulesOverlay.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { theme } from '../theme'
import { duration, prefersReducedMotion } from '../motion'
import { safeBottom, safeTop } from '../layout'
import { cardRuleList, rulesGoal, specialMoveList } from '../rulesContent'

type RulesOverlayProps = { open: boolean, onClose: () => void }

const MiniCard = ({ rank }: { rank: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 34, borderRadius: 6, background: theme.cardFace, color: theme.cardInk, fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 13, boxShadow: theme.shadowCard, flex: 'none' }}>{rank}</span>
)

const sectionLabel = { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: theme.goldDim, opacity: 0.85, margin: '22px 2px 12px' } as const

export const RulesOverlay = ({ open, onClose }: RulesOverlayProps) => {
  const reduced = prefersReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="rules-backdrop"
          onClick={onClose}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduced ? 0 : duration.fast }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(4,12,10,.66)', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
            onClick={event => event.stopPropagation()}
            initial={reduced ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 1 } : { opacity: 0, y: 24 }}
            transition={{ duration: reduced ? 0 : duration.base, ease: theme.ease.spring }}
            style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', background: theme.feltPanel, color: theme.ink, boxShadow: theme.shadowFloat, paddingTop: safeTop(0), paddingBottom: safeBottom(0) }}
          >
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px', borderBottom: `1px solid ${theme.hairline}` }}>
              <span id="rules-title" style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 22, color: theme.gold }}>Règles</span>
              <button ref={closeRef} type="button" aria-label="Fermer les règles" onClick={onClose}
                style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', flex: 'none', background: 'rgba(255,255,255,.08)', color: theme.ink, fontSize: 17 }}>✕</button>
            </header>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 18px 22px' }}>
              <p style={{ fontFamily: theme.fontUi, fontSize: 15, lineHeight: 1.5, color: theme.ink, margin: '14px 2px 4px' }}>{rulesGoal}</p>

              <div style={sectionLabel}>Les cartes</div>
              {cardRuleList.map(rule => (
                <div key={rule.ranks.join('-')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 2px' }}>
                  <span style={{ display: 'flex', gap: 4, flex: 'none' }}>
                    {rule.ranks.map(rank => <MiniCard key={rank} rank={rank} />)}
                  </span>
                  <span style={{ fontFamily: theme.fontUi, fontSize: 13.5, lineHeight: 1.35, color: theme.ink }}>{rule.effect}</span>
                </div>
              ))}

              <div style={sectionLabel}>Coups spéciaux</div>
              {specialMoveList.map(move => (
                <div key={move.title} style={{ padding: '7px 2px' }}>
                  <div style={{ fontFamily: theme.fontDisplay, fontWeight: 600, fontSize: 14.5, color: theme.gold }}>{move.title}</div>
                  <div style={{ fontFamily: theme.fontUi, fontSize: 13.5, lineHeight: 1.4, color: theme.inkDim, marginTop: 2 }}>{move.text}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tock/web test tests/rulesOverlay.test.tsx`
Expected: PASS (5 tests).

Note: the panel stops click propagation so a tap on the dialog never reaches the backdrop's `onClose`; the backdrop's own `onClick` handles both the backdrop tap and (harmlessly) is bypassed for panel taps.

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm --filter @tock/web typecheck`

```bash
git add apps/web/src/components/RulesOverlay.tsx apps/web/tests/rulesOverlay.test.tsx
git commit -m "feat(web): add RulesOverlay dialog"
```

---

### Task 4: Wire the overlay and its three triggers

Give `App` the open/close state, render the overlay above every screen, and add the trigger to Home, Setup, and the in-game StatusBar.

**Files:**
- Modify: `apps/web/src/components/App.tsx`
- Modify: `apps/web/src/components/Home.tsx`
- Modify: `apps/web/src/components/Setup.tsx`
- Modify: `apps/web/src/components/StatusBar.tsx`
- Modify: `apps/web/src/components/GameScreen.tsx`
- Test: `apps/web/tests/rulesAccess.test.tsx`

**Interfaces:**
- Consumes: `RulesButton` (Task 2), `RulesOverlay` (Task 3).
- Produces (new/changed props):
  - `Home` props become `{ onPlay: () => void, onOpenRules: () => void }`
  - `Setup` props become `{ onStart: (kindList: PlayerKind[], ringSize: number) => void, onOpenRules: () => void }`
  - `StatusBar` props gain `onOpenRules: () => void`
  - `GameScreen` props gain `onOpenRules: () => void`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/rulesAccess.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Home } from '../src/components/Home'
import { Setup } from '../src/components/Setup'
import { StatusBar } from '../src/components/StatusBar'

describe('rules access points', () => {
  it('Home opens the rules', async () => {
    const onOpenRules = vi.fn()
    render(<Home onPlay={() => {}} onOpenRules={onOpenRules} />)
    await userEvent.click(screen.getByLabelText('Ouvrir les règles'))
    expect(onOpenRules).toHaveBeenCalledTimes(1)
  })

  it('Setup opens the rules', async () => {
    const onOpenRules = vi.fn()
    render(<Setup onStart={() => {}} onOpenRules={onOpenRules} />)
    await userEvent.click(screen.getByLabelText('Ouvrir les règles'))
    expect(onOpenRules).toHaveBeenCalledTimes(1)
  })

  it('the in-game StatusBar opens the rules', async () => {
    const onOpenRules = vi.fn()
    render(<StatusBar turnColor="red" drawCount={4} discardCount={2} prompt="À toi de jouer" onOpenRules={onOpenRules} />)
    await userEvent.click(screen.getByLabelText('Ouvrir les règles'))
    expect(onOpenRules).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tock/web test tests/rulesAccess.test.tsx`
Expected: FAIL — `onOpenRules` is not a known prop / no button with that label exists yet (TypeScript errors on `Home`/`Setup`/`StatusBar` props, and no matching label at runtime).

- [ ] **Step 3a: Add the trigger to StatusBar**

In `apps/web/src/components/StatusBar.tsx`, import the button and extend the props/right-hand span.

Change the import block and the type:

```tsx
import type { Color } from '@tock/core'
import { seatColor, theme } from '../theme'
import { RulesButton } from './RulesButton'

type StatusBarProps = { turnColor: Color, drawCount: number, discardCount: number, prompt: string, onOpenRules: () => void }
```

Change the component signature and the right-hand span to include the button:

```tsx
export const StatusBar = ({ turnColor, drawCount, discardCount, prompt, onOpenRules }: StatusBarProps) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 8px', color: theme.ink }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: theme.fontDisplay, fontWeight: 600, fontSize: 15, color: '#ffe6a6' }}>
      <span className="tock-bob" style={{ width: 12, height: 12, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${seatColor[turnColor].light}, ${seatColor[turnColor].dark})`, boxShadow: `0 0 10px rgba(${seatColor[turnColor].soft},.8)` }} />
      {prompt}
    </span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={pill}>Pioche <b style={{ color: '#ffe6a6' }}>{drawCount}</b></span>
      <span style={pill}>Défausse <b style={{ color: '#ffe6a6' }}>{discardCount}</b></span>
      <RulesButton onClick={onOpenRules} />
    </span>
  </div>
)
```

(Leave the `pill` const as-is; only `alignItems: 'center'` was added to the right-hand span so the round button lines up with the pills.)

- [ ] **Step 3b: Thread it through GameScreen**

In `apps/web/src/components/GameScreen.tsx`, extend the props type and pass it to `StatusBar`.

Change the props type (line 23):

```tsx
type GameScreenProps = { state: GameState, logList: LogEntry[], humanSeatIds: PlayerId[], commitMove: (move: Move) => void, onOpenRules: () => void }
```

Change the destructuring (line 31):

```tsx
export const GameScreen = ({ state, logList, humanSeatIds, commitMove, onOpenRules }: GameScreenProps) => {
```

Change the `<StatusBar>` render (line 137) to pass the callback:

```tsx
<StatusBar turnColor={colorOf(state.currentPlayer)} drawCount={state.drawPile.length} discardCount={state.discardPile.length} prompt={turnLine} onOpenRules={onOpenRules} />
```

- [ ] **Step 3c: Add the trigger to Home**

In `apps/web/src/components/Home.tsx`, add the prop and a text trigger that is always rendered (in every offer state).

Change the imports and props type (lines 3-6):

```tsx
import { InstallButton } from './InstallButton'
import { RulesButton } from './RulesButton'
import { useInstallOffer } from '../pwa/useInstallOffer'

type HomeProps = { onPlay: () => void, onOpenRules: () => void }
```

Change the component signature (line 25):

```tsx
export const Home = ({ onPlay, onOpenRules }: HomeProps) => {
```

Add the trigger just before the closing `</div>` of the outer container (after the `offer.installed ? ... : ...` block, still inside the flex column):

```tsx
      <div style={{ marginTop: 22 }}>
        <RulesButton onClick={onOpenRules} variant="text" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3d: Add the trigger to Setup**

In `apps/web/src/components/Setup.tsx`, add the prop and an icon trigger pinned top-right, honouring the safe area.

Change the imports and props type (lines 4-8):

```tsx
import { seatColor, theme } from '../theme'
import { colorLabel } from '../format'
import { safeBottom, safeTop } from '../layout'
import { RulesButton } from './RulesButton'

type SetupProps = { onStart: (kindList: PlayerKind[], ringSize: number) => void, onOpenRules: () => void }
```

Change the component signature (line 17):

```tsx
export const Setup = ({ onStart, onOpenRules }: SetupProps) => {
```

Make the outer container positioned and add the button as its first child. Change the outer `<div>` (line 32) to add `position: 'relative'`, then insert the button right after it:

```tsx
    <div style={{ position: 'relative', maxWidth: 360, margin: '0 auto', paddingTop: safeTop(26), paddingRight: 20, paddingBottom: safeBottom(22), paddingLeft: 20, display: 'flex', flexDirection: 'column', minHeight: '100dvh', color: theme.ink }}>
      <div style={{ position: 'absolute', top: safeTop(12), right: 14 }}>
        <RulesButton onClick={onOpenRules} />
      </div>
```

- [ ] **Step 3e: Own the state in App and render the overlay**

In `apps/web/src/components/App.tsx`, add the state, render the overlay, and pass `onOpenRules` to the three screens.

Add to the imports:

```tsx
import { RulesOverlay } from './RulesOverlay'
```

Add the state next to the other `useState` calls (near line 20-21):

```tsx
  const [rulesOpen, setRulesOpen] = useState(false)
```

Pass `onOpenRules` in the three screen constructions inside the `screen` IIFE:

```tsx
    if (!entered && !state) return { key: 'home', cover: false, node: <Home onPlay={() => setEntered(true)} onOpenRules={() => setRulesOpen(true)} /> }
    if (!state) return { key: 'setup', cover: false, node: <Setup onStart={(kindList, ringSize) => start(kindList, ringSize)} onOpenRules={() => setRulesOpen(true)} /> }
```

and the game screen:

```tsx
    return { key: 'game', cover: false, node: <GameScreen state={state} logList={logList} humanSeatIds={humanIdList} commitMove={commitAndPass} onOpenRules={() => setRulesOpen(true)} /> }
```

Render the overlay as a sibling of `<UpdateBanner />`:

```tsx
  return (
    <>
      <ScreenTransition screenKey={screen.key} cover={screen.cover}>{screen.node}</ScreenTransition>
      <RulesOverlay open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <UpdateBanner />
    </>
  )
```

- [ ] **Step 4: Run the new test and the full web suite**

Run: `pnpm --filter @tock/web test tests/rulesAccess.test.tsx`
Expected: PASS (3 tests).

Run: `pnpm --filter @tock/web test`
Expected: PASS — all web tests green, no regression in existing App/Home/Setup/StatusBar/GameScreen tests.

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm -r typecheck`
Expected: clean across all packages.

```bash
git add apps/web/src/components/App.tsx apps/web/src/components/Home.tsx apps/web/src/components/Setup.tsx apps/web/src/components/StatusBar.tsx apps/web/src/components/GameScreen.tsx apps/web/tests/rulesAccess.test.tsx
git commit -m "feat(web): reach the rules overlay from Home, Setup and in-game"
```

---

### Task 5: Full-suite verification and manual check

Confirm the whole workspace is green and the overlay behaves in a real browser from every entry point.

**Files:** none (verification only).

- [ ] **Step 1: Run the full workspace suite and typecheck**

Run: `pnpm -r test`
Expected: every package green — core 132, terminal 65, web now 186 + the new tests (rulesContent 4, rulesButton 2, rulesOverlay 5, rulesAccess 3 = 200).

Run: `pnpm -r typecheck`
Expected: clean.

- [ ] **Step 2: Manual smoke test**

Run: `pnpm --filter @tock/web dev`, open the app, and verify:
- Home shows a "Règles" button; tapping it opens the overlay; ✕ / backdrop / Escape close it and leave you on Home.
- Setup shows the "?" button top-right; it opens the overlay and closes back to Setup.
- In a game, the "?" in the StatusBar opens the overlay; closing it leaves the board and the current turn exactly as they were (no state change).
- The card list shows `A K Q J 7 5 4` and the number cluster with correct effects; the goal and the three special moves read correctly.
- Toggle OS "reduce motion" and confirm the overlay appears/disappears without the rise animation.

- [ ] **Step 3: Update CLAUDE.md**

Add `RulesOverlay.tsx` / `RulesButton.tsx` and `rulesContent.ts` to the `apps/web` file-layout list in `CLAUDE.md`, and note the rules page in the shipped-features paragraph. Commit:

```bash
git add CLAUDE.md
git commit -m "docs: note the rules page in CLAUDE.md"
```

---

## Self-Review

**Spec coverage:**
- One overlay owned by `App`, above `ScreenTransition` → Task 4 (Step 3e). ✓
- Three access points (Home text, Setup icon, in-game StatusBar icon) → Task 4 (Steps 3a–3d) + `rulesAccess.test.tsx`. ✓
- Shared `RulesButton` → Task 2. ✓
- Card-first content (goal, 13 ranks, 3 special moves) from pure data → Task 1 + rendered in Task 3. ✓
- Rank glyphs match the cards (A K Q J) → Global Constraints + Task 1 data. ✓
- Close via ✕ / backdrop / Escape, `role="dialog"`, `aria-modal`, `aria-labelledby`, focus close button → Task 3. ✓
- Motion via `motion.ts` tokens, gated by `prefersReducedMotion`; safe-area via `safeTop`/`safeBottom`; theme tokens only → Task 3. ✓
- No trigger on PassInterstitial/GameOver → Task 4 only wires Home/Setup/GameScreen. ✓
- Tests: `rulesContent.test.ts`, `rulesOverlay.test.tsx`, `rulesAccess.test.tsx` (+ `rulesButton.test.tsx`) → Tasks 1–4. ✓
- `@tock/core` / `apps/terminal` untouched → all tasks are `apps/web` only. ✓

**Placeholder scan:** No TBD/TODO; every code and test step contains the actual content. ✓

**Type consistency:** `onOpenRules: () => void` is used identically across `Home`, `Setup`, `StatusBar`, `GameScreen`; `RulesButton` props `{ onClick, variant }` match every call site; `RulesOverlay` props `{ open, onClose }` match App's render; `CardRule` / `SpecialMove` names match between `rulesContent.ts` and `RulesOverlay.tsx`. ✓

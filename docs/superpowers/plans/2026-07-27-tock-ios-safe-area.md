# iOS Safe-Area Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the iOS status bar painting over the game header, and stop the hint chip and 7-split panel colliding with the card fan, in the installed iOS web app.

**Architecture:** Route both safe-area insets through two CSS custom properties declared once in `index.css`, composed into inline styles by a new pure `src/layout.ts` module that also owns the bottom-chrome constants and their reservation invariant. Four call sites consume it. No user-agent sniffing and no global wrapper — `env()` is already the "iPhone and installed" conditional, and it resolves to 0 everywhere else, so nothing changes visually outside the installed iOS app.

**Tech Stack:** TypeScript (strict), React 19, Vite, Vitest + jsdom + @testing-library/react, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-07-27-tock-ios-safe-area-design.md` — read it before starting. It carries the measured root-cause arithmetic that these tasks encode.

## Global Constraints

- Scope is `apps/web` only. `@tock/core` and `apps/terminal` must not be touched.
- **Node:** tool shells default to Node 18, which cannot run this toolchain. Prefix every `pnpm` command with `export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"; `.
- Run commands from the repo root, targeting the package: `pnpm --filter @tock/web test`.
- **Baseline: 170 passing tests in 34 files.** This plan adds 13 tests, ending at 183. No existing test may be deleted or weakened.
- Code style (from `CLAUDE.md`): no semicolons, no trailing commas, no `function` keyword — const arrow functions only. **No non-null assertions (`!`) in production code**; tests may use them.
- All code and comments in **English**, regardless of the language of the conversation. User-facing copy stays **French**.
- Variables are camelCase and never pluralised with a bare `s` (`inputList`, not `inputs`). Module-level constants stay `SCREAMING_SNAKE_CASE`, matching the existing `BOARD_BOTTOM_CLEARANCE` and `BOT_DELAY_MS`.
- **Do not change any authored pixel value.** `HAND_HEIGHT` stays 130, `BOARD_BOTTOM_CLEARANCE` stays 110, card height stays 86, lift stays 20, gaps stay 18 / 26 / 22 / 16. This change must be a no-op on every platform without safe-area insets.

## Three environment facts these tests depend on

All three were measured in this repo, not assumed. They dictate the shape of the production code, so do not "simplify" against them:

1. **A bare `env()` in an inline style is dropped by jsdom** (`style.paddingTop` reads back `""`), while `var(--x)` and any `calc()` wrapping either are preserved. This is why insets go through custom properties: with a bare `env()`, a regression would be invisible because the assertion would run against an empty string.
2. **jsdom does not expand a `padding` shorthand that contains `calc()`** — `style.padding` keeps the full string but `style.paddingTop` reads back `""`. This is why Task 4 converts `Setup` to padding longhands.
3. **Vite statically rewrites `new URL('<string literal>', import.meta.url)`** into an asset reference, so it resolves to `http://localhost:3000/...` and `fileURLToPath` rejects it with "The URL must be of scheme file". `import.meta.url` itself is a normal `file://` URL — it is the wrapping pattern that gets rewritten. Any test resolving a path from its own module location must avoid that exact syntax; `join(dirname(fileURLToPath(import.meta.url)), rel)` is safe because it never forms the pattern. **This corrects Task 1 Step 1's code**, which used the rewritten form.

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/index.css` (modify) | Declares `--safe-top` / `--safe-bottom` on `:root`. The only place an `env()` expression appears. |
| `apps/web/src/layout.ts` (create) | Pure layout tokens: the two inset composers, plus the bottom-chrome constants and the documented reservation invariants. |
| `apps/web/tests/layout.test.ts` (create) | Composer shapes, the `index.css` ↔ composer linkage, and reservation invariant 1 as arithmetic. |
| `apps/web/src/components/Hand.tsx` (modify) | Reserved box grows with the inset; card geometry reads the shared tokens. Fixes the bottom collision. |
| `apps/web/src/components/GameScreen.tsx` (modify) | Column root gains the top inset. Loses its local `BOARD_BOTTOM_CLEARANCE` to `layout.ts`. Fixes the status-bar overlap. |
| `apps/web/src/components/Setup.tsx` (modify) | Top inset for the header, bottom inset for the pinned CTA. |
| `apps/web/src/components/UpdateBanner.tsx` (modify) | Bottom inset so the toast clears the home indicator. |

---

### Task 1: Layout tokens and the CSS custom properties

Foundation for every later task. Produces the module the other three import.

**Files:**
- Create: `apps/web/src/layout.ts`
- Create: `apps/web/tests/layout.test.ts`
- Modify: `apps/web/src/index.css:1`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `safeTop(extra: number): string` → `` `calc(${extra}px + var(--safe-top))` ``
  - `safeBottom(extra: number): string` → `` `calc(${extra}px + var(--safe-bottom))` ``
  - `CARD_HEIGHT = 86`, `CARD_SELECTED_LIFT = 20`, `HAND_BOTTOM_GAP = 18`, `HAND_HEIGHT = 130`, `BOARD_BOTTOM_CLEARANCE = 110` — all `number`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/layout.test.ts`:

```tsx
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BOARD_BOTTOM_CLEARANCE, CARD_HEIGHT, CARD_SELECTED_LIFT, HAND_BOTTOM_GAP, HAND_HEIGHT, safeBottom, safeTop
} from '../src/layout'

describe('safe-area composers', () => {
  it('adds the call site spacing to the top inset', () => {
    expect(safeTop(26)).toBe('calc(26px + var(--safe-top))')
  })

  it('keeps the calc wrapper at zero so every call site has the same shape', () => {
    expect(safeTop(0)).toBe('calc(0px + var(--safe-top))')
  })

  it('adds the call site spacing to the bottom inset', () => {
    expect(safeBottom(18)).toBe('calc(18px + var(--safe-bottom))')
  })
})

describe('index.css backs the custom properties the composers reference', () => {
  // The composers emit var(--safe-top) / var(--safe-bottom); those properties are
  // only ever defined in index.css. Renaming either side without the other would
  // silently resolve to nothing, so assert the link rather than trusting it.
  const css = readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8')

  it('derives --safe-top from the top inset, with a 0px fallback', () => {
    expect(css).toMatch(/--safe-top:\s*env\(safe-area-inset-top,\s*0px\)/)
  })

  it('derives --safe-bottom from the bottom inset, with a 0px fallback', () => {
    expect(css).toMatch(/--safe-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/)
  })

})

describe('bottom-chrome reservation invariants', () => {
  // Invariant 1. The hand band must reserve the card fan's full footprint,
  // selected lift included. This is the invariant the iOS bottom inset broke:
  // it took the left-hand side to 130 - 18 - 34 = 78pt against a 106pt
  // footprint, and the 28pt of overflow is what reached the split panel.
  it('reserves at least the selected card footprint inside the hand band', () => {
    expect(HAND_HEIGHT - HAND_BOTTOM_GAP).toBeGreaterThanOrEqual(CARD_HEIGHT + CARD_SELECTED_LIFT)
  })

  // Invariant 2 (BOARD_BOTTOM_CLEARANCE >= the overlay column's height) cannot be
  // computed: Hint and SplitControls size themselves from font metrics and jsdom
  // has no layout engine. This floor preserves the guard that gameScreen.test.tsx
  // already had on the rendered value.
  it('keeps a floor under the overlay band reserved in the board stage', () => {
    expect(BOARD_BOTTOM_CLEARANCE).toBeGreaterThanOrEqual(32)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm --filter @tock/web test tests/layout.test.ts
```

Expected: FAIL — `Failed to resolve import "../src/layout"`.

- [ ] **Step 3: Create the layout module**

Create `apps/web/src/layout.ts`:

```ts
// Layout tokens for how the game column reserves space.
//
// The env() expressions live once, in index.css, as --safe-top / --safe-bottom;
// this module only composes them with each call site's own spacing. The custom
// property indirection is deliberate: jsdom drops a bare env() from an inline
// style, so an unwrapped inset could not be asserted in any test. The calc()
// wrapper at zero is for a uniform shape across call sites.
export const safeTop = (extra: number): string => `calc(${extra}px + var(--safe-top))`
export const safeBottom = (extra: number): string => `calc(${extra}px + var(--safe-bottom))`

// Bottom chrome of the game column. Two bands stack there: the hand's own box,
// and the band reserved inside the board stage so the hint chip and the 7-split
// gauge clear the board. Each band must be at least as tall as what it reserves
// space for -- see the invariants in tests/layout.test.ts.
//
// HAND_HEIGHT is authored, not derived. CARD_HEIGHT + CARD_SELECTED_LIFT +
// HAND_BOTTOM_GAP would be 124, which would shrink the hand by 6pt on every
// platform for the sake of a tidier formula; the slack is deliberate breathing
// room, and the invariant test is what keeps it honest.
//
// BOARD_BOTTOM_CLEARANCE reserves the overlay column's ~105pt as rendered (hint
// chip + 8pt gap + split gauge). Its invariant cannot be machine-checked because
// that height is intrinsic to the two components' font metrics.
export const CARD_HEIGHT = 86
export const CARD_SELECTED_LIFT = 20
export const HAND_BOTTOM_GAP = 18
export const HAND_HEIGHT = 130
export const BOARD_BOTTOM_CLEARANCE = 110
```

- [ ] **Step 4: Declare the custom properties**

In `apps/web/src/index.css`, replace line 1:

```css
:root { color-scheme: dark; }
```

with:

```css
/* Safe-area insets, declared once. iOS resolves these to 59px (Dynamic Island)
   or 47px (notch) in the installed app, and to 0 in a Safari tab, on Android and
   on desktop -- so they are the "iPhone and installed" conditional, with no
   user-agent check. Consumed through src/layout.ts. The 0px fallback keeps the
   declaration valid where env() is unsupported. No horizontal insets: the
   manifest pins orientation: portrait. */
:root {
  color-scheme: dark;
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm --filter @tock/web test tests/layout.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Typecheck**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm -r typecheck
```

Expected: clean, no output errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/layout.ts apps/web/tests/layout.test.ts apps/web/src/index.css
git commit -m "feat(web): safe-area custom properties and layout tokens

The env() expressions live once on :root; src/layout.ts composes them with
each call site's spacing. The custom property indirection is what makes the
insets assertable -- jsdom drops a bare env() from an inline style.

Also brings the bottom-chrome constants together with reservation invariant
1 (hand band >= card footprint) asserted as arithmetic. That is the
invariant the iOS bottom inset breaks."
```

---

### Task 2: Hand reserves its true footprint

This is the bottom half of the reported bug. `Hand` currently sets `height: 130` **and** a bottom padding carrying the inset; with the global `box-sizing: border-box` the padding shrinks the content box instead of growing the element, so the flex column under-reserves the hand by the inset while the cards overflow upward into the hint/split overlay.

**Files:**
- Modify: `apps/web/src/components/Hand.tsx:18` (root box), `:23` (selected lift), `:33` (card height)
- Test: `apps/web/tests/hand.test.tsx`

**Interfaces:**
- Consumes: `safeBottom`, `CARD_HEIGHT`, `CARD_SELECTED_LIFT`, `HAND_BOTTOM_GAP`, `HAND_HEIGHT` from `../layout` (Task 1).
- Produces: nothing new. `Hand`'s props are unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/tests/hand.test.tsx`. Extend the existing import block with the layout tokens — the file already imports `render`, `screen`, `userEvent`, `describe/expect/it/vi`, `Card` and `Hand`:

```tsx
import { CARD_HEIGHT, CARD_SELECTED_LIFT, HAND_BOTTOM_GAP, HAND_HEIGHT, safeBottom } from '../src/layout'
```

Then add these three tests inside the existing `describe('Hand', ...)` block:

```tsx
  it('grows its reserved box with the bottom inset so the cards stay inside it', () => {
    const { container } = render(<Hand hand={hand} playableList={[true, true]} selectedIndex={-1} onSelect={() => {}} />)
    const root = container.firstElementChild as HTMLElement
    // Height AND padding must both carry the inset so it cancels: the content box
    // left for the cards stays a device-independent HAND_HEIGHT - HAND_BOTTOM_GAP.
    // Asserting only the height would still pass if the padding's inset were
    // dropped -- which is the exact shape of the bug being fixed.
    expect(root.style.height).toBe(safeBottom(HAND_HEIGHT))
    expect(root.style.paddingBottom).toBe(safeBottom(HAND_BOTTOM_GAP))
  })

  it('sizes cards from the shared CARD_HEIGHT token', () => {
    render(<Hand hand={hand} playableList={[true, true]} selectedIndex={-1} onSelect={() => {}} />)
    expect(screen.getByLabelText('card-A-clubs').style.height).toBe(`${CARD_HEIGHT}px`)
  })

  it('lifts the selected card by the CARD_SELECTED_LIFT token', () => {
    render(<Hand hand={hand} playableList={[true, true]} selectedIndex={0} onSelect={() => {}} />)
    expect(screen.getByLabelText('card-A-clubs').style.transform).toContain(`translateY(${-CARD_SELECTED_LIFT}px)`)
  })
```

The last two tests matter beyond tidiness: the invariant asserted in Task 1 is only real if the card geometry and the reserved band read from the *same* tokens. If `Hand` kept its own literal 86 and 20, the invariant test would pass while the component drifted.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm --filter @tock/web test tests/hand.test.tsx
```

Expected: 3 FAIL, 4 PASS. The first new test fails with `expected "130px" to be "calc(130px + var(--safe-bottom))"`.

- [ ] **Step 3: Consume the tokens in Hand**

In `apps/web/src/components/Hand.tsx`, add the import below the existing `theme` import:

```tsx
import { CARD_HEIGHT, CARD_SELECTED_LIFT, HAND_BOTTOM_GAP, HAND_HEIGHT, safeBottom } from '../layout'
```

Replace the root div (line 18):

```tsx
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 130, paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}>
```

with:

```tsx
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: safeBottom(HAND_HEIGHT), paddingBottom: safeBottom(HAND_BOTTOM_GAP) }}>
```

Replace the lift (line 23):

```tsx
        const lift = selected ? -20 : Math.abs(index - mid) * 2
```

with:

```tsx
        const lift = selected ? -CARD_SELECTED_LIFT : Math.abs(index - mid) * 2
```

And in the card button's style object (line 33), replace `height: 86,` with `height: CARD_HEIGHT,`. Leave `width: 62` and every other value alone.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm --filter @tock/web test tests/hand.test.tsx
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Run the full web suite for regressions**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm --filter @tock/web test
```

Expected: 180 passed (170 baseline + 7 from Task 1 + 3 here). Nothing else asserts on the hand's box.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/Hand.tsx apps/web/tests/hand.test.tsx
git commit -m "fix(web): make the hand reserve its footprint including the iOS inset

height: 130 plus a bottom padding carrying the inset does not grow the box
under border-box -- it shrank the content box to 78pt against a 106pt card
footprint, so the cards overflowed 28pt upward into the hint/split overlay.

Putting the inset on the height as well makes it cancel against the
padding: the content box is a device-independent 112pt, and the band the
flex column reserves finally grows with the inset. Card geometry now reads
the same tokens the reservation invariant is asserted against."
```

---

### Task 3: GameScreen clears the iOS status bar

The top half of the reported bug. Also relocates `BOARD_BOTTOM_CLEARANCE` so both bottom-chrome bands are described in one module.

**Files:**
- Modify: `apps/web/src/components/GameScreen.tsx:30-33` (delete the local constant), `:140` (column root)
- Test: `apps/web/tests/gameScreen.test.tsx`

**Interfaces:**
- Consumes: `safeTop`, `BOARD_BOTTOM_CLEARANCE` from `../layout` (Task 1).
- Produces: a `data-testid="game-column"` hook on the column root, for this test and any future layout assertion.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/tests/gameScreen.test.tsx`. Extend its import block with:

```tsx
import { safeTop } from '../src/layout'
```

Then add this test next to the existing `reserves bottom clearance…` test, inside the same outermost `describe`:

```tsx
  it('insets the column top so the iOS status bar does not paint over the header', () => {
    const state = setHand(createGame(['human', 'bot'], 48), 0, [card('A', 'clubs')])
    render(<GameScreen state={state} logList={[]} humanSeatIds={[0]} commitMove={vi.fn()} />)
    // Standalone iOS gives the web view the whole screen under the translucent
    // status bar, so the column must inset itself or StatusBar starts at y=0.
    expect(screen.getByTestId('game-column').style.paddingTop).toBe(safeTop(0))
  })
```

`createGame`, `setHand`, `card`, `render`, `screen` and `vi` are already imported by this file — do not re-import them.

Leave the existing `reserves bottom clearance so the hint does not overlap the board` test exactly as it is. Its `>= 32` assertion on the rendered value still passes and still has value; Task 1 added the matching floor on the constant itself.

- [ ] **Step 2: Run the test to verify it fails**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm --filter @tock/web test tests/gameScreen.test.tsx
```

Expected: FAIL — `Unable to find an element by: [data-testid="game-column"]`.

- [ ] **Step 3: Apply the inset and relocate the constant**

In `apps/web/src/components/GameScreen.tsx`, add to the import block:

```tsx
import { BOARD_BOTTOM_CLEARANCE, safeTop } from '../layout'
```

Delete lines 30-33 entirely — the comment now lives in `layout.ts`:

```tsx
// Bottom space reserved in the board stage for the overlay column (hint chip, and
// the taller split gauge) so it clears the board. The board stays vertically
// centred in the space that remains above this reserved band.
const BOARD_BOTTOM_CLEARANCE = 110
```

Replace the column root (line 140):

```tsx
    <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
```

with:

```tsx
    <div data-testid="game-column" style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', paddingTop: safeTop(0) }}>
```

The root keeps `height: '100dvh'`. Under `border-box` the padding shrinks the flex column's content box rather than overflowing it, and the board's SVG rescales to fit — do **not** change the height unit to compensate.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm --filter @tock/web test tests/gameScreen.test.tsx
```

Expected: PASS, all tests in the file, including the untouched clearance test.

- [ ] **Step 5: Typecheck, to prove the constant relocation is complete**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm -r typecheck
```

Expected: clean. A leftover reference to the deleted local constant would surface here.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/GameScreen.tsx apps/web/tests/gameScreen.test.tsx
git commit -m "fix(web): inset the game column below the iOS status bar

viewport-fit=cover plus the black-translucent status bar style hands the
installed app the whole screen, with the clock drawn over it. Nothing
applied the top inset, so StatusBar began its padding at y=0.

BOARD_BOTTOM_CLEARANCE moves to src/layout.ts so both bottom-chrome bands
are described in one place."
```

---

### Task 4: The two remaining inset call sites

Neither was in the reported screenshots, but both place interactive elements in an inset zone: `Setup`'s "Lancer la partie" CTA is pushed to the bottom by a `flex: 1` spacer with 22px beneath it, landing in the home-indicator gesture zone, and its TOCK header starts 26px from the top, under the clock. `UpdateBanner` is `position: fixed; bottom: 16` — outside any parent's reach, which is one of the reasons a global `#root` wrapper was rejected.

**Files:**
- Modify: `apps/web/src/components/Setup.tsx:31` (root padding), `apps/web/src/components/UpdateBanner.tsx:14` (bottom offset)
- Test: `apps/web/tests/setup.test.tsx`, `apps/web/tests/updateBanner.test.tsx`

**Interfaces:**
- Consumes: `safeTop`, `safeBottom` from `../layout` (Task 1).
- Produces: nothing.

- [ ] **Step 1: Write the failing tests**

In `apps/web/tests/setup.test.tsx`, add to the import block:

```tsx
import { safeBottom, safeTop } from '../src/layout'
```

and add this test inside the existing `describe('Setup', ...)`:

```tsx
  it('insets both edges: the header clears the status bar, the CTA clears the home indicator', () => {
    const { container } = render(<Setup onStart={vi.fn()} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.paddingTop).toBe(safeTop(26))
    // "Lancer la partie" is pushed to the bottom by a flex spacer, so without the
    // bottom inset it sits inside the home-indicator gesture zone.
    expect(root.style.paddingBottom).toBe(safeBottom(22))
    // Horizontal padding is untouched: the app is portrait-locked.
    expect(root.style.paddingLeft).toBe('20px')
    expect(root.style.paddingRight).toBe('20px')
  })
```

In `apps/web/tests/updateBanner.test.tsx`, add to the import block:

```tsx
import { safeBottom } from '../src/layout'
```

and add this test inside the existing `describe('UpdateBanner', ...)`:

```tsx
  it('lifts the toast above the home indicator', () => {
    Object.assign(state, { needRefresh: true, offlineReady: false })
    render(<UpdateBanner />)
    // position: fixed resolves against the viewport, so no parent inset reaches
    // this banner -- it has to carry the inset itself.
    expect(screen.getByRole('status').style.bottom).toBe(safeBottom(16))
  })
```

- [ ] **Step 2: Run both test files to verify they fail**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm --filter @tock/web test tests/setup.test.tsx tests/updateBanner.test.tsx
```

Expected: 2 FAIL. Setup fails with `expected "" to be "calc(26px + var(--safe-top))"` — jsdom does not expand the `padding` shorthand, which Step 3 addresses. UpdateBanner fails with `expected "16px" to be "calc(16px + var(--safe-bottom))"`.

- [ ] **Step 3: Apply the insets**

In `apps/web/src/components/Setup.tsx`, add to the import block:

```tsx
import { safeBottom, safeTop } from '../layout'
```

Replace the root div (line 31):

```tsx
    <div style={{ maxWidth: 360, margin: '0 auto', padding: '26px 20px 22px', display: 'flex', flexDirection: 'column', minHeight: '100dvh', color: theme.ink }}>
```

with:

```tsx
    <div style={{ maxWidth: 360, margin: '0 auto', paddingTop: safeTop(26), paddingRight: 20, paddingBottom: safeBottom(22), paddingLeft: 20, display: 'flex', flexDirection: 'column', minHeight: '100dvh', color: theme.ink }}>
```

The shorthand must become longhands: jsdom keeps a `padding` shorthand containing `calc()` as one opaque string and reads back `""` for `paddingTop`, so the shorthand form cannot be asserted at all. The four longhands are equivalent in the browser and identical in rendered pixels.

In `apps/web/src/components/UpdateBanner.tsx`, add to the import block:

```tsx
import { safeBottom } from '../layout'
```

and in the banner's style object replace `bottom: 16,` with `bottom: safeBottom(16),`.

- [ ] **Step 4: Run both test files to verify they pass**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm --filter @tock/web test tests/setup.test.tsx tests/updateBanner.test.tsx
```

Expected: PASS in both files.

- [ ] **Step 5: Full workspace verification**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm -r test && pnpm -r typecheck
```

Expected: **183 passing web tests in 35 files** (170 baseline + 13), core and terminal unchanged, typecheck clean. Do not proceed to Task 5 with anything failing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/Setup.tsx apps/web/src/components/UpdateBanner.tsx apps/web/tests/setup.test.tsx apps/web/tests/updateBanner.test.tsx
git commit -m "fix(web): inset the setup screen edges and the update toast

Setup's CTA is pushed to the bottom by a flex spacer with 22px beneath it,
landing in the home-indicator gesture zone, and its header started 26px
from the top, under the clock. UpdateBanner is position: fixed, so no
parent inset can reach it.

Setup's padding shorthand becomes longhands: jsdom keeps a shorthand
containing calc() as one opaque string, so the inset would be unassertable."
```

---

### Task 5: Manual verification on the device

No test can close this out. jsdom has no layout engine, so the suite locks the intent and the arithmetic but cannot prove the cards stop overlapping the split panel. The installed app on a physical iPhone is the only ground truth.

**Files:** none.

- [ ] **Step 1: Build and confirm the bundle is clean**

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm --filter @tock/web build
```

Expected: build succeeds, no warnings about `layout.ts`.

- [ ] **Step 2: Deploy, then force the service worker to update**

Deploy as usual for this project (GitHub Pages). Then, on the iPhone, **open the installed app and accept the "Nouvelle version — Recharger" banner**. This step is easy to miss and will otherwise waste a verification round: `vite-plugin-pwa` is configured with `registerType: 'prompt'`, so a cached service worker keeps serving the old bundle until the user accepts the update. If the banner does not appear, delete the installed app and re-add it to the Home screen.

- [ ] **Step 3: Check the four call sites, in the installed app and not in Safari**

The whole point is behaviour that only exists in standalone mode, so verify from the Home-screen icon:

1. **Game screen, top** — "À toi de jouer" and the Pioche / Défausse pills sit fully below the clock and the Dynamic Island, with a small gap. Nothing is struck through.
2. **Game screen, bottom** — play a 7 to open the split panel. "Annuler" / "Jouer le 7" and the pip gauge sit entirely above the card fan, including when a card is selected and lifted. This is the collision from the original screenshots.
3. **Setup screen** — the TOCK logo clears the clock; "Lancer la partie" sits above the home indicator and is comfortable to tap.
4. **Update toast** — visible on the next deploy; it should clear the home indicator.

- [ ] **Step 4: Confirm nothing moved elsewhere**

Open the same build in a Safari **tab** and, if available, on desktop. Both insets resolve to 0 there, so the layout must be pixel-identical to before this change. Any visible shift means an inset leaked into a platform that has none.

- [ ] **Step 5: Update the project docs**

`CLAUDE.md` lists the web app's test count and the `apps/web/src/` module inventory. Add `layout.ts` beside `theme.ts` / `motion.ts` in the `apps/web/src/` listing, described as layout tokens (safe-area composers + bottom-chrome constants). Refresh the counts: the current text says "364 passing tests ... web 167", which was already stale at 170 before this plan; the accurate figure after Task 4 is **web 183**. Recount core and terminal with `pnpm -r test` rather than trusting the existing numbers, and update the total to match.

```bash
git add CLAUDE.md
git commit -m "docs: note src/layout.ts and refresh the web test count"
```

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: §1 custom properties and §2 the module → Task 1; §3 call sites → Tasks 2, 3, 4; §4 the top padding's safety → Task 3 Step 3's note on keeping `100dvh`; §5 the bottom arithmetic → Task 2; §6 untouched screens → covered by omission, with Task 5 Step 4 verifying nothing moved; §7 constants and invariants → Task 1 (invariant 1 asserted, invariant 2 documented with the floor guard); Testing → the per-task test steps plus Task 5 for the limitation the spec calls out.

**Type consistency.** `safeTop` / `safeBottom` take `number` and return `string` in Task 1 and are called with numbers throughout. `CARD_HEIGHT`, `CARD_SELECTED_LIFT`, `HAND_BOTTOM_GAP`, `HAND_HEIGHT`, `BOARD_BOTTOM_CLEARANCE` keep the same names in the module, the tests, and the components. The `data-testid="game-column"` introduced in Task 3 Step 3 is the same string asserted in Task 3 Step 1.

**Known-stale figure.** `CLAUDE.md`'s "web 167" is already wrong at 170 today; Task 5 Step 5 corrects it rather than propagating it.

# Tock — iOS safe-area layout in the installed web app

Date: 2026-07-27
Scope: `apps/web` only (`src/index.css`, a new `src/layout.ts`, and four layout
call sites). `@tock/core` and `apps/terminal` are untouched.

## Motivation

Screenshots from the installed app on an iPhone show two layout defects that do
not appear in a Safari tab, on Android, or on desktop:

1. **The iOS status bar paints over the app header.** The clock, wifi and battery
   glyphs sit on top of `StatusBar`'s "À toi de jouer" line.
2. **The hint chip and the 7-split panel collide with the card fan.** The hand
   itself looks correctly placed, but the overlay column above it is drawn behind
   the cards — "Annuler" / "Jouer le 7" end up under the selected card.

Both are safe-area defects, but they have *different* root causes, and only one
of them is a missing inset.

### Root cause — the top

`apps/web/index.html` combines `viewport-fit=cover` with
`apple-mobile-web-app-status-bar-style: black-translucent`. In standalone display
mode iOS therefore hands the web view the **entire** screen and draws the status
bar glyphs over it. No screen applies `env(safe-area-inset-top)`, so
`StatusBar` (`src/components/StatusBar.tsx:9`) begins its 12px padding at y=0.

In a Safari tab the browser chrome already reserves that band, which is why the
defect is invisible outside the installed app.

### Root cause — the bottom

Not a missing inset: an inset applied where it cannot take effect.

`src/components/Hand.tsx:18` sets `height: 130` **and**
`paddingBottom: calc(18px + env(safe-area-inset-bottom))`. With the global
`box-sizing: border-box` (`src/index.css:2`), that padding does not grow the
element — it shrinks its content box:

| Device | inset-bottom | Hand padding | Hand content box |
| --- | --- | --- | --- |
| iPhone with home indicator | 34pt | 52pt | 130 − 52 = **78pt** |
| Safari tab / Android / desktop | 0pt | 18pt | 130 − 18 = **112pt** |

Cards are 86pt tall with `transformOrigin: bottom center`, and the selected card
adds `translateY(-20px)`. Against a 78pt content box with `alignItems: flex-end`,
a selected card's top edge lands **28pt above** the Hand's own box.

Meanwhile the hint/split overlay is absolutely positioned at `bottom: 8` of
`board-stage` (`src/components/GameScreen.tsx:159`). For an absolutely positioned
child the offset resolves against the containing block's *padding box*, so the
overlay's bottom edge sits 8pt above the Hand box's top edge — squarely inside
the 28pt of card overflow. Total collision: **36pt**.

The flex column reserves a fixed 130pt for the hand no matter the device, while
the hand's visual footprint grows with the inset. That mismatch is the bug.

## Approach

Use `env(safe-area-inset-*)`, not a device check.

The inset *is* the "iPhone and installed" conditional, resolved by the OS: 59pt
on Dynamic Island devices, 47pt on notched ones, and 0pt in a Safari tab, on
Android and on desktop. No user-agent sniffing, no `isStandalone()` in the render
path, no hard-coded per-device table to maintain.

Rejected alternatives:

- **`isStandalone()` from `src/pwa/platform.ts` plus a fixed margin.** A single
  number is wrong on every device but one, and wrong again on the next device.
- **Switching the status bar to `black`.** iOS would reserve the band itself and
  the inset would fall to 0, but the felt gradient would stop bleeding under the
  clock — a hard black band above the app.
- **A global `padding-top` on `#root`.** Rejected on two grounds that survive
  scrutiny. First, it leaks: `PassInterstitial` (`position: fixed; inset: 0`) and
  `UpdateBanner` (`position: fixed; bottom: 16`) resolve against the viewport,
  not `#root`'s content box, so a wrapper does not reach them. Second, it does
  not fix the bottom at all — `Hand`'s border-box arithmetic needs a component
  edit either way. It would also require converting four screens from `100dvh` to
  `100%` to avoid overflowing by the inset, and it couples `index.css` to every
  screen's height unit at a distance.

### Why CSS custom properties rather than bare `env()`

To be precise about what this is fixing: no call site in this codebase ever used
a bare `env()`. The pre-existing bottom inset was already
`calc(18px + env(safe-area-inset-bottom))` (`Hand.tsx:18`, before this branch),
and jsdom preserves that fine — see the measured table below. So the case for
custom properties is not "the old form was broken."

The real justification is a **single source of truth**. Without `--safe-top` /
`--safe-bottom`, the `env(safe-area-inset-*)` expression would need to be
repeated, `calc()` wrapper and all, at every call site that needs it — four
places today, more as the app grows. One place (`index.css`) declares the
expression once; every call site composes it through `src/layout.ts`'s
`safeTop` / `safeBottom` instead of re-typing it. That is what keeps the layout
points from drifting apart from each other.

A secondary benefit falls out of the same indirection: a bare `env()` would not
be assertable in this test suite. jsdom silently **drops a bare `env()`** from
an inline style, but preserves `var(--x)` and any `calc()` that wraps either.
Measured:

| Written | Read back in jsdom |
| --- | --- |
| `env(safe-area-inset-top)` | `""` — dropped |
| `calc(18px + env(safe-area-inset-bottom))` | preserved |
| `calc(130px + var(--safe-bottom))` | preserved |
| `var(--safe-bottom)` | preserved |

Had a future call site been written against a bare `env()` directly, a test
would assert against an empty property and a regression there would be
invisible. Routing every inset through a custom property keeps all call sites
assertable — but that is a benefit of the single-source-of-truth design, not
the reason for it.

## Design

### 1. Single source of truth — `src/index.css`

```css
:root {
  color-scheme: dark;
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

The `0px` fallback keeps the declaration valid where `env()` is unsupported, so
the failure mode is today's behaviour rather than an invalid rule.

Horizontal insets are deliberately omitted: the manifest pins
`orientation: portrait` (`apps/web/vite.config.ts`), so `--safe-left` /
`--safe-right` would always be 0.

### 2. Layout tokens — `src/layout.ts`

One new module owns everything about how the game column reserves space: the
inset composers and the bottom-chrome constants. They are consumed together at
the same call sites — `Hand` needs both `safeBottom` and `HAND_HEIGHT` in one
declaration — so splitting them would scatter a single concern. This follows the
`theme.ts` (design tokens) / `motion.ts` (motion tokens) precedent: a small pure
module, unit-tested, imported by components.

```ts
// The env() expressions live once, in index.css, as --safe-top / --safe-bottom.
// This module owns only the arithmetic that combines them with each call site's
// own spacing, so the layout points cannot drift apart.
export const safeTop = (extra: number): string => `calc(${extra}px + var(--safe-top))`
export const safeBottom = (extra: number): string => `calc(${extra}px + var(--safe-bottom))`
```

Wrapping even the zero case in `calc()` is not for jsdom's sake -- a bare
`var(--safe-top)` reads back fine from a jsdom inline style, measured below. The
real reason is a uniform shape across call sites: every composer call looks the
same whether `extra` is zero or not, so no call site is a special case to read or
to maintain.

### 3. Call sites

| File | Change |
| --- | --- |
| `src/components/GameScreen.tsx:140` | add `paddingTop: safeTop(0)` to the column root |
| `src/components/Setup.tsx:31` | top and bottom of the `padding` shorthand become `safeTop(26)` and `safeBottom(22)` |
| `src/components/Hand.tsx:18` | `height: safeBottom(HAND_HEIGHT)`, `paddingBottom: safeBottom(HAND_BOTTOM_GAP)`, and the card's own `height` / selected lift read from `CARD_HEIGHT` / `CARD_SELECTED_LIFT` |
| `src/components/UpdateBanner.tsx:14` | `bottom: safeBottom(16)` |

`Setup` needs the **bottom** inset as well as the top: its "Lancer la partie"
button is pushed to the bottom by a `flex: 1` spacer with only 22px beneath it,
which places it inside the home-indicator gesture zone.

### 4. Why the top padding is safe

`GameScreen`'s root is `height: 100dvh` in border-box, so the padding shrinks the
flex column's content box rather than overflowing it. `StatusBar`'s existing 12px
top padding then supplies the gap below the status bar glyphs — 59 + 12 = 71pt
from the physical top on a Dynamic Island device.

The board absorbs the loss without squeezing. Its SVG is `width: 100%;
height: 100%` over a `viewBox` (`src/components/Board.tsx:105`), so the default
`preserveAspectRatio: xMidYMid meet` rescales it to fit whichever dimension
binds. Budget on a 393×852pt Dynamic Island iPhone, with both insets applied:
StatusBar ≈44 + GameLog ≈34 + Hand `130 + 34` (`HAND_HEIGHT` plus the 34pt
bottom inset `safeBottom` adds) = 242pt of chrome, leaving `852 − 59 − 242 =
551pt` of stage for a board needing ≈393pt plus the 110pt
`BOARD_BOTTOM_CLEARANCE` = 503pt. Roughly **48pt** of slack — comfortable, but
notably less than a budget that forgets the bottom inset also grows the hand
band would suggest.

### 5. Why the bottom fix resolves the collision

`safeBottom(HAND_HEIGHT)` makes the reserved box grow with the inset, so the
content box becomes 130 − 18 = **112pt on every device**:

| Device | Hand box | content box | selected card top, relative to box top |
| --- | --- | --- | --- |
| iPhone with home indicator, today | 130pt | 78pt | −28pt (outside, above) |
| iPhone with home indicator, fixed | 164pt | 112pt | +6pt (inside) |
| No inset, today and fixed | 130pt | 112pt | +6pt (inside) |

The overlay's bottom edge sits 8pt above the Hand box top, so a selected card
clears it by 14pt. The no-inset column is identical before and after: **nothing
changes visually outside the installed iOS app.**

### 6. Screens left untouched, deliberately

`Home`, `GameOver` and `PassInterstitial` centre their content vertically with
ample margin, so no element collides with either inset. They are left alone to
keep the regression surface small.

### 7. Bottom-chrome constants and their invariants

The bug is a violated space reservation, so the reservation is made explicit
rather than left as magic numbers.

First, a correction to how this was initially framed: `Hand`'s `height: 130` and
`GameScreen`'s `BOARD_BOTTOM_CLEARANCE = 110` are **not** coupled to each other.
They reserve space for two different things — 110pt for the overlay column (hint
chip + gap + split gauge, ≈105pt as rendered), 130pt for the card fan's
footprint. Changing one does not imply changing the other, and no derivation
should pretend otherwise.

What is real is a pair of *reservation invariants*, each pairing a magic number
with a rendered height:

| # | Invariant | Today |
| --- | --- | --- |
| 1 | `HAND_HEIGHT − HAND_BOTTOM_GAP + SPLIT_OVERLAY_GAP` ≥ `CARD_HEIGHT × CARD_SELECTED_SCALE + CARD_SELECTED_LIFT` | 120 ≥ 112.02 ✓ |
| 2 | `BOARD_BOTTOM_CLEARANCE` ≥ overlay column height | 110 ≥ ≈105 ✓ |

Invariant 1 is what the iOS inset silently broke: the inset ate 34pt of the
left-hand side, taking it to 78 against a footprint above 106 — false by well
over 28pt, which is exactly the overflow that reaches the split panel.

Getting the right-hand side right took a second pass. The selected card's style
is `transform: rotate(0deg) translateY(-20px) scale(1.07)` with
`transformOrigin: 'bottom center'` (`Hand.tsx`). CSS composes a `transform` list
right-to-left in the order written but applies the transform functions to the
element's own box first — concretely, the card's local top edge at
`y = -CARD_HEIGHT` is scaled *before* it is translated: `-86 × 1.07 = -92.02`,
then `-92.02 - 20 = -112.02`. The visual footprint above the card's bottom edge
is therefore **112.02pt**, not the 106pt that modelling only rotation +
translation would suggest — that reading stops one function short of `scale`.

The band alone (`HAND_HEIGHT − HAND_BOTTOM_GAP` = 130 − 18 = 112pt) is 0.02pt
short of 112.02pt. Nothing is visibly broken — the card grazes the band's top
edge — but the invariant as originally written (`HAND_HEIGHT − HAND_BOTTOM_GAP`
≥ `CARD_HEIGHT + CARD_SELECTED_LIFT`, i.e. 112 ≥ 106) would stay green through a
scale bump (e.g. to `1.2`, footprint 123.2pt) that reintroduces the collision.
What actually makes the invariant hold today is the split overlay's own 8pt gap
above the band (`SPLIT_OVERLAY_GAP`): `112 + 8 = 120 ≥ 112.02`. That gap belongs
in the invariant, not just the band.

The fan also rotates its non-selected cards (`Hand.tsx`, up to 16° for the
outermost of five) and pushes them *down* by up to 4pt. Rotating an 86×62pt card
16° about its bottom-centre lifts its top corner to
`62/2·sin16° + 86·cos16° ≈ 91pt`, still under the selected card's 112.02pt, so a
rotated card never dominates the invariant.

`src/layout.ts` gains the named constants, with the authored values preserved
exactly so no pixel moves on any platform:

```ts
// Bottom chrome of the game column. Two bands stack there: the hand's own box,
// and the overlay band reserved inside the board stage so the hint chip and the
// 7-split gauge clear the board. Each band must be at least as tall as what it
// reserves for — see the invariants asserted in tests/layout.test.ts.
export const CARD_HEIGHT = 86
export const CARD_SELECTED_LIFT = 20
export const CARD_SELECTED_SCALE = 1.07
export const HAND_BOTTOM_GAP = 18
export const HAND_HEIGHT = 130
export const BOARD_BOTTOM_CLEARANCE = 110
export const SPLIT_OVERLAY_GAP = 8
```

`HAND_HEIGHT` stays an authored 130 rather than a computed
`CARD_HEIGHT + CARD_SELECTED_LIFT + HAND_BOTTOM_GAP` (= 124). Deriving it would
shrink the hand by 6pt on every platform — a visual regression in service of a
tidier formula. The 6pt is deliberate breathing room; the invariant test, not the
arithmetic, is what keeps it honest.

`BOARD_BOTTOM_CLEARANCE` moves from `GameScreen.tsx:33` into the module so both
bands are described in one place.

Invariant 2 cannot be machine-checked. The overlay column's height is
*intrinsic* — `Hint` and `SplitControls` size themselves from font metrics and
inline padding, and jsdom has no layout engine to measure them. Giving them
explicit heights to make the sum computable would risk clipping text at larger
font scales, which is worse than the magic number. So invariant 2 is documented
with its measured breakdown and its floor is raised to that measured height
(105pt) directly, while the existing `gameScreen.test.tsx` assertion on the
rendered `paddingBottom` guards against the clearance being dropped altogether.

One coupling that needs no constant: the overlay's `bottom: SPLIT_OVERLAY_GAP`
is relative to the board stage, whose bottom edge *is* the hand's top edge. That
relationship is structural in the flex column, so the overlay follows any change
to `HAND_HEIGHT` automatically.

## Testing

New `apps/web/tests/layout.test.ts` covers the module:

- The composers: emitted string shape for a positive extra and for zero, and that
  each references its matching custom property.
- **Reservation invariant 1**, asserted as arithmetic:
  `HAND_HEIGHT - HAND_BOTTOM_GAP + SPLIT_OVERLAY_GAP >= CARD_HEIGHT * CARD_SELECTED_SCALE + CARD_SELECTED_LIFT`.
  This is the one test that would have caught the class of bug being fixed, and a
  paired test proves it is not vacuous by asserting the same comparison fails at
  an inflated scale (`1.2`) — so a future "make selection pop more" tweak cannot
  reintroduce the collision with the suite still green.

One assertion added per call site, in the existing suites — `gameScreen.test.tsx`,
`setup.test.tsx`, `hand.test.tsx`, `updateBanner.test.tsx` — checking that the
element's inline style carries the inset expression on the correct property.

For `Hand` the assertion that carries real meaning is the **cancellation**, not
the literal: `height` and `paddingBottom` must *both* reference `--safe-bottom`,
so the inset cancels and the content box stays a device-independent 112pt. A test
that only pinned `height` would still pass if someone dropped the padding's inset
and reintroduced the bug.

Limitations to state plainly. jsdom has no layout engine, so no test can prove the
cards stop overlapping the split panel, and reservation invariant 2 (the overlay
band) cannot be asserted at all — see §7. These tests lock the intent and the
arithmetic, not the rendered geometry. The only ground truth is the installed app
on a physical iPhone, which must be verified manually after deploy.

## Out of scope

- Landscape and horizontal insets — the app is portrait-locked.
- The Capacitor native wrap (M4), which brings its own inset handling.

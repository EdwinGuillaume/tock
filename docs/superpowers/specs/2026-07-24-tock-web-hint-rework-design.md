# Tock web — hint rework (extraction + card-aware guidance)

**Date:** 2026-07-24
**Scope:** `apps/web` only. `@tock/core` and `apps/terminal` are untouched.

## 1. Problem

The turn hint in the web app is built inline inside
`apps/web/src/components/GameScreen.tsx`: a ternary chain (lines ~108–112)
computes the string, and an inline absolutely-positioned `<div>` (lines ~133–135)
renders the chip. Two issues:

1. **Not scalable / messy** — the wording logic is entangled with the component's
   render, so every new case grows the ternary and there is no unit under test.
2. **Not card-aware** — the hint is chosen purely by *interaction phase*
   (`pickCard` / `ghosts` / `swapTarget` / `split` / `onlyDiscards`), so a `5`, a
   `4`, and a `Queen` all read the same generic "choisis où poser ta bille". It
   does little to teach the player what each card does.

## 2. Goals

- Extract the hint into its own **component** and move the wording into a
  **pure function** exposed through a **hook** (`hintFor` + `useHint`), so the
  logic is testable in isolation and easy to extend.
- Make the hint text **card-aware and teaching**: it names the card and states
  its mechanic, then the action — e.g. the `5` "fait avancer un adversaire", the
  `4` "recule de 4 cases". This drives a new player instead of just labelling the
  current step.
- Make the **7-split hint progressive** (guides each allocation step) and give it
  room above the split gauge.

Non-goals: the terminal UI (it has its own separate hint code); any engine or
rules change; hover/desktop affordances.

## 3. Architecture

Three new units, all under `apps/web`:

| File | Responsibility |
|---|---|
| `apps/web/src/hint.ts` | `HintContext` type + **pure** `hintFor(ctx: HintContext): string` — the single source of truth for all hint wording |
| `apps/web/src/hooks/useHint.ts` | thin `useHint(ctx: HintContext): string` = `hintFor(ctx)` (matches the codebase's hook shape; keeps `GameScreen` declarative) |
| `apps/web/src/components/Hint.tsx` | `<Hint text />` — renders the felt chip; returns `null` when `text` is empty |

`GameScreen.tsx` is edited to:

- drop the inline `hint` ternary and the inline chip `<div>`;
- build a `HintContext` from its existing state (`humanTurn`, `onlyDiscards`,
  `interaction`, `hand`, and `movesForCard(card, legalMoves)` from
  `moveSelection.ts`);
- call `useHint(context)` and render `<Hint text={hint} />`.

`hintFor` depends only on `@tock/core` types (`Card`, `Move`) plus its own
`HintContext` — it does **not** import `GameScreen`'s `Interaction` type, so the
boundary is clean and the wording function is unit-testable without React.

### 3.1 `HintContext` (discriminated union, defined in `hint.ts`)

```ts
export type HintContext =
  | { kind: 'idle' }                                  // not the human's turn
  | { kind: 'onlyDiscards' }                          // hand is fully stuck
  | { kind: 'pickCard' }
  | { kind: 'ghosts', card: Card, moves: Move[] }     // moves = movesForCard(card, legalMoves)
  | { kind: 'swapSource' }                            // Jack, own marble not yet chosen
  | { kind: 'swapTarget' }                            // Jack, opponent marble to pick
  | { kind: 'split', focused: boolean, remaining: number }
```

`GameScreen` maps its `Interaction` phases onto this:

- not `humanTurn` → `{ kind: 'idle' }`
- `onlyDiscards` → `{ kind: 'onlyDiscards' }`
- `phase: 'pickCard'` → `{ kind: 'pickCard' }`
- `phase: 'ghosts'` → `{ kind: 'ghosts', card, moves: movesForCard(card, legalMoves) }`
- `phase: 'swapTarget'` with `marbleId === null` → `{ kind: 'swapSource' }`
- `phase: 'swapTarget'` with a source chosen → `{ kind: 'swapTarget' }`
- `phase: 'split'` → `{ kind: 'split', focused: focusMarbleId !== null, remaining: splitRemaining(draft) }`

## 4. Wording table (French, explanatory / teaching)

`hintFor` returns these strings. Ordering of checks matters where noted.

### Base phases
| Context | Text |
|---|---|
| `idle` | `''` |
| `pickCard` | `choisis une carte` |
| `onlyDiscards` | `aucun coup — touche une carte pour la défausser` |

### `ghosts` — decided by card rank, refined by which move types are present
The step count `N` is read from the actual move objects (so `Q` yields 12, not
`NaN`), not from a re-implemented rank→steps map. `hasExit` /`hasMove` are derived
from `moves` (`hasExit = moves.some(m => m.type === 'exit')`,
`hasMove = moves.some(m => m.type !== 'exit' && m.type !== 'discard')`).

| Card / condition | Text                                                    |
|---|---------------------------------------------------------|
| `5` | `avance un adversaire de 5 — choisis lequel`            |
| `4` | `recule ta bille de 4 cases — choisis laquelle`    |
| `7` (single-marble degenerate — reaches the ghosts flow, not the panel) | `avance ta bille de 7`                                  |
| `A`, exit **and** move | `l'As sort une bille ou l'avance de 1`                  |
| `A`, exit only | `l'As fait sortir une bille`                            |
| `A`, move only | `avance ta bille de 1`                                  |
| `K`, exit **and** move | `le Roi sort une bille ou l'avance de 13`               |
| `K`, exit only | `le Roi fait sortir une bille`                          |
| `K`, move only | `avance ta bille de 13`                                 |
| `2` `3` `6` `8` `9` `10` `Q` | `avance ta bille de N` (N from the move: 2,3,6,8,9,10,12) |

Note: the `5` always maps to a `push` move and `4` to a backward `move`, so those
rows key on rank directly. The single-marble `7` is routed through the ghosts flow
(per `isSplitCard` in `moveSelection.ts`), so its ghosts-phase hint is the plain
"avance ta bille de 7" — the split panel wording (§ below) never applies to it.

### Jack
| Context | Text |
|---|---|
| `swapSource` | `échange 2 billes — choisis la tienne` |
| `swapTarget` | `choisis la bille adverse à échanger` |

### `split` (progressive)
| Condition | Text |
|---|---|
| nothing assigned yet (`remaining === 7`, not focused) | `le 7 se répartit — choisis une bille` |
| a marble is focused (`focused === true`) | `choisis jusqu'où avancer` |
| part(s) assigned, budget left (`0 < remaining < 7`, not focused) | `continue — répartis les {n} pas restants` (singular `le pas restant` when `n === 1`) |
| budget spent (`remaining === 0`, not focused) | `''` (the gauge's `0 ✓` + `Jouer le 7` button carry it) |

## 5. Layout

Today, two separate absolutely-positioned blocks both anchor at `bottom: 8` of the
board container: the hint chip and the split overlay. With a progressive split hint
they would collide. Changes:

- **Unify** the two blocks into a single bottom-centered flex **column**
  (`display: flex, flexDirection: column, alignItems: center, gap: 8`,
  `pointerEvents: 'none'`) that stacks `<Hint>` above `<SplitControls>`. The split
  controls render inside this column only during the split phase (with
  `pointerEvents: 'auto'` on the interactive wrapper, as today). The hint chip thus
  naturally sits just above the gauge.
- **Shift the board upward so the bottom overlay never overlaps it.** The board is
  vertically centered in a `flex: 1` container that has ample empty space above it;
  the fix reclaims part of that top space to guarantee bottom clearance for the
  overlay. Mechanism: reserve bottom clearance on the board container (e.g. a
  `paddingBottom`, or by reducing the centering slack / the gap under `GameLog`,
  whose `margin` is currently `'2px 16px 4px'`) so the board's bottom edge sits
  **above** the overlay. Minimum clearance = **hint chip height + 8px** (the board
  must not overlap the hint chip in any phase). Recommended: reserve the full
  unified-column height (hint chip + 8px gap + split gauge) so the taller split
  gauge also clears the board *and* the board's vertical position stays stable when
  entering/leaving the split phase (no jump) — this is comfortably ≥ the minimum.
  Exact px are measured against the built app with a visual check; the board must
  not overlap the overlay, and the space above the board absorbs the shift.
- **`<Hint>` chip**: keep the existing felt styling (translucent background,
  hairline border, `theme.radius.sm`, dimmed ink) and `pointerEvents: 'none'`, but
  **drop `whiteSpace: 'nowrap'`** and constrain to a `max-width` with centered text
  (`textAlign: 'center'`), so the longer teaching lines wrap instead of clipping.
  Because the chip is bottom-anchored, wrapping grows it upward over the board and
  never reflows the layout. Render `null` when `text` is `''`.

## 6. Testing

- **`apps/web/tests/hint.test.ts`** — exhaustive unit tests of `hintFor` across
  every `HintContext` branch: `idle` → `''`; `pickCard`; `onlyDiscards`; `ghosts`
  for `5`, `4`, single-marble `7`, `A` (exit+move / exit-only / move-only), `K`,
  `Q` (asserts 12), a plain forward rank; `swapSource`; `swapTarget`; and the four
  `split` stages including the `n === 1` singular.
- **`apps/web/tests/hint.test.tsx`** — `<Hint>` renders its text; renders nothing
  (returns `null`) when `text` is empty.
- **`apps/web/tests/gameScreen.test.tsx`** — update the two swap-hint assertions
  (currently `choisis ta bille à échanger` / `choisis la bille adverse`) to the new
  strings; add a card-specific ghost check (tap a `5` → the push line) and a
  progressive split-hint check (first → `le 7 se répartit — choisis une bille`;
  after focusing a marble → `choisis jusqu'où avancer`). The `onlyDiscards` string
  is unchanged, so that assertion stays.

## 7. Out of scope / YAGNI

- No terminal changes.
- No icon/emoji in the chip (text only, as today).
- No per-card hint during `pickCard` (nothing is selected yet — stays generic).
- No "prêt — joue ton 7" nudge on a fully-spent split (the gauge already signals
  readiness); the hint is empty there.

# The 5 as a "push an opponent" card — Design document

- **Date**: 2026-07-17
- **Status**: approved (brainstorming), ready for the implementation plan
- **Author**: eguillaume

## 1. Context & goal

The engine, the "Normal" bot, and the Ink TUI are built, tested, and merged. The
authoritative rules live in `docs/superpowers/specs/2026-07-15-tock-terminal-design.md`
(the game) and `docs/superpowers/specs/2026-07-16-tock-ai-design.md` (the bot).

This document designs a **rule change**: the **5** stops advancing your own
marbles and instead becomes an **offensive card that moves an opponent's marble
forward by 5**. The change touches all three layers — engine, AI, and UI — and
the bot must be able to *decide* to push an opponent (to capture a third player's
marble, or to force an opponent to overshoot its finish entry).

The architectural constraints are unchanged (terminal spec §3–§4): the engine
stays isomorphic and JSON-serializable, `applyMove` stays immutable, and both the
human and the bot choose only from `getLegalMoves`.

## 2. The rule (decided)

- The **5 no longer advances the player's own marbles**. Playing a 5 moves **one
  opponent marble forward exactly 5** on the ring. It is opponent-only.
- **Eligible targets**: opponent marbles **on the ring (`track`)** that are **not
  protected**. A marble sitting on **its own start cell** is protected and cannot
  be pushed (consistent with capture, pass-over, and Jack-swap protection —
  terminal spec §7). Marbles in a nest (`home`) or a finish lane (`finish`) are
  not on the ring and cannot be pushed.
- **Forward only, exactly 5.** There is no backward push and no split.
- **Ring-only — the pushed marble never enters its finish.** When the push crosses
  the pushed marble's **own lane mouth**, the marble **stays on the ring and
  overshoots** it. This is the point of the card: you can force an opponent past
  its finish entry so it must loop again. (A marble enters its finish only under
  its owner's control, never when shoved by an opponent.)
- **Captures during the push** follow the normal rules, computed relative to the
  **marble that is physically moving** (the pushed one):
  - It **cannot pass over** a protected marble, nor **land on** one (that push is
    illegal and is not offered).
  - It **cannot land on another marble of its own owner** (blocked — illegal).
  - Landing exactly on any **other** marble **captures** it (sends it home). This
    includes a **third** player's marble (the tactical goal) and, in principle,
    one of the **actor's own** marbles — a legal but self-harming outcome the bot
    never chooses.
- **No legal target ⇒ discard only.** If a 5 has no eligible opponent marble (all
  opponents home/finish, all protected, or every landing illegal), the 5 is
  playable only as a `discard`, via the existing empty-result fallback.
- **A push never ends the game.** It cannot move the actor's marbles into their
  finish, so it cannot trigger the win condition.

## 3. Engine changes

### 3.1 Move contract (`types.ts`)

Add one variant to the `Move` union:

```ts
| { type: 'push', card: Card, marbleId: MarbleId, steps: number }
```

- `marbleId` is the **opponent** marble being pushed. This is the **only** move
  whose `marbleId` is not one of the actor's own marbles.
- `steps` is always `5` for the 5-card. It is stored for uniformity with `move`
  (self-describing; read by previews and labels) even though it is currently
  constant.

### 3.2 Card value (`cards.ts`)

`moveSteps('5')` returns **`null`**. The 5 joins `J` (swap) and `7` (split) as a
"special" card with no plain self-advance value; its behaviour is generated
specially in `moves.ts`. `canExit('5')` stays `false`. The single production
consumer of `moveSteps` is `moves.ts`, so the normal self-move loop simply stops
generating self-moves for the 5.

### 3.3 Move generation (`getLegalMoves`, `moves.ts`)

- The existing self-move loop is gated on `moveSteps(rank) !== null`, so the 5 no
  longer produces `move` entries.
- New branch for `rank === '5'`: for every marble on the **track** owned by a
  **different** player that is **not** protected on its own start cell, compute the
  landing with the existing resolver and, if legal, emit a push:

  ```ts
  const to = resolveDestination(state, opponentMarble, PUSH_STEPS, false)
  if (to) result.push({ type: 'push', card: playedCard, marbleId: opponentMarble.id, steps: PUSH_STEPS })
  ```

  `PUSH_STEPS = 5`. Passing `enterLane: false` makes `resolveDestination` return
  the **ring** landing (`reach.ring`) and never the finish, which is exactly the
  ring-only rule. `resolveDestination` already applies `pathClear` (no passing a
  protected marble) and `canLandOn` (no landing on a protected marble, no landing
  on the pushed marble's own-owner marble). The protection check on the target
  itself is added in this branch (skip a target where `isProtected(marble)`).

- The empty-result discard fallback is unchanged.

### 3.4 Applying a push (`applyMove`, `moves.ts`)

```ts
if (move.type === 'push') {
  const forced = findMarble(state, move.marbleId)
  const to = resolveDestination(state, forced, move.steps, false)
  if (!to) throw new Error('illegal push passed to applyMove')
  return withTurnDone(state, actor, move, relocate(state.marbleList, forced, to), random)
}
```

`relocate(marbleList, forced, to)` sends home any marble on `to` whose owner is
**not** `forced.owner`. Because the physically-moving marble is the opponent's,
this correctly captures a third player's marble (or the actor's own) sitting on
the landing cell, and leaves the pushed marble in place. `withTurnDone` discards
the played 5, draws the actor's replacement card, and advances the turn. No win
check is needed (a push cannot park a marble in a finish).

### 3.5 Board geometry (`board.ts`)

No change. The ring-only landing is obtained by calling the existing
`resolveDestination` / `ringDestinations` with `enterLane: false`; the
forward-only lane-entry logic is simply never exercised for a push.

## 4. AI changes (`score.ts`)

The heuristic currently sums only the **bot's own** advancement plus flat capture
/ finish / exit bonuses minus exposure. A push moves an **opponent**, which the
current score ignores except via captures and exposure. Add one term so the bot
can weigh helping vs. hurting an opponent.

### 4.1 New term: opponent progress

The term is evaluated **only for `push` moves** — the one move a player makes to
*deliberately* relocate an opponent. It is `0` for every other move type.

```
opponentProgressDelta = (move.type === 'push')
  ? Σ over opponent marbles NOT captured this move
      of ( advancement(after) − advancement(before) )
  : 0

score −= WEIGHTS.opponentProgress · opponentProgressDelta
```

- **Gated on `push`, not on "did an opponent move".** A Jack **swap** also
  relocates an opponent marble, but that displacement is incidental (the point of
  a swap is the *own* marble's jump, already scored by `progress`). Folding swap's
  opponent displacement into this term would change existing swap valuations —
  and the `advancement` scalar is not even monotonic for an arbitrary swap
  relocation, so the number would be meaningless. A push, by contrast, always
  moves the pushed marble **forward exactly 5**, so its advancement delta is
  meaningful (positive normally, sharply negative on a wrap-past-mouth overshoot).
  Gating on `push` keeps the term principled and the swap tests unchanged.
- **Exclusion of captured marbles avoids double-counting.** A marble the push
  sends home is already rewarded by the `capture` term (+`WEIGHTS.capture`);
  including its large negative advancement delta here as well would count the
  benefit twice, so captured opponents (`after.zone === 'home'` while
  `before.zone !== 'home'`) are skipped in this sum.
- New weight `WEIGHTS.opponentProgress` — **`1.5`**, slightly above own
  `progress` (`1`) so the bot is a touch *more* wary of advancing an opponent than
  it is eager to advance itself. As with all weights, the **ordering is the
  contract** and the exact value is tunable against the comparative tests.
- **Half-integer scores are fine for the tie-break.** `opponentProgressDelta` is
  an integer, so `1.5 · delta` is a multiple of `0.5` — exactly representable in
  IEEE-754 — and the exact-equality tie-break (`score === bestScore`) stays
  reliable. Only push moves can produce a non-integer score; every non-push move
  keeps an integer score. The AI spec's "all terms use integer arithmetic" note
  (§5.1) gains this caveat.

### 4.2 Why this single term is sufficient

- **Helping an opponent is penalised.** Pushing an opponent forward raises its
  advancement scalar ⇒ positive delta ⇒ negative score contribution. The bot is
  reluctant to push for no gain.
- **Forcing an overshoot is rewarded.** The advancement scalar is
  `1 + (index − startCell + ringSize) % ringSize`. A marble near its mouth (large
  distance) pushed past its own start **wraps**, so its distance — and its
  advancement — **drops sharply**. That negative delta becomes a **bonus**,
  rewarding exactly "make them overshoot their finale".
- **Capturing a third player is rewarded** by the existing `capture` term, with
  the captured marble excluded from the progress term.
- **Self-endangerment is penalised** by the existing `exposure` term: a push that
  parks an opponent right behind one of the bot's marbles raises exposure.
- **Self-capture is penalised** by the existing own-advancement delta: pushing an
  opponent onto one of the bot's own marbles drops that marble's advancement to
  0, a strong negative.

### 4.3 No regression

The new term is gated on `move.type === 'push'`, so `opponentProgressDelta = 0`
for every existing move type (`move`, `exit`, `split7`, `swap`, `discard`) and
their scores are unchanged. The term activates only for pushes.

## 5. UI changes

The push reuses the pick-card → pick-marble path, with the twist that the marble
being picked belongs to an **opponent**. The flow is: pick the **5**, then pick an
**opponent marble** to push; there is a single outcome, so it commits immediately
(no destination step).

- **`selection.ts`**
  - `marbleChoices` includes `push` moves, so their `marbleId` (an opponent
    marble) is offered in the marble-selection step.
  - `optionMoves` includes `push` for the chosen `marbleId`. There is exactly one
    push per target (forward 5, ring-only), so `enterMarble` sees a single option
    and commits — no `pickDestination`/`pickTarget` step.
- **`useTurnInput.ts`** — the `pickMarble` highlight already resolves
  `cellOf(marble.owner, …)` and previews landings via `optionMoves`, so it renders
  the selected opponent marble in place plus its landing square, unchanged.
- **`format.ts`** — `moveLabel` gets a `push` branch, e.g.
  `blue plays 5 — pushes red 12→17` (with `, captured!` when a marble went home),
  because the generic diff only inspects the **actor's own** marbles and a push
  moves an opponent's.
- **`Hand.tsx`** — no change; an unplayable 5 (no eligible target) is dimmed
  through the existing `playable[]` derived from `getLegalMoves`. There is no
  card-meaning legend to update.

## 6. Testing strategy

### 6.1 New engine tests (`tests/engine/push.test.ts`)

- A 5 offers one push per eligible opponent track marble.
- No push is offered for: a protected opponent (on its own start), an opponent
  whose 5-landing is blocked/illegal, or when no opponent marble is on the ring
  (then the 5 is a `discard`).
- `applyMove` moves the opponent marble forward exactly 5.
- **Ring-only overshoot**: a push whose path crosses the pushed marble's own mouth
  leaves it on the ring (never `finish`).
- A push captures a **third** player's marble (that marble → `home`).
- Immutability: the input state is unchanged.

### 6.2 Test migration (existing suite)

The 5 was used across the suite as the canonical "plain forward move" card.
Migrate those cases to a neutral rank (default **`6`**), preserving each test's
intent and geometry (adjust indices/steps where 5 was chosen to reach a specific
cell). Known touch-points: `tests/engine/cards.test.ts` (`moveSteps('5')` → null,
generic case → `6`), `lane.test.ts`, `apply-move.test.ts`, `legal-moves.test.ts`,
`rounds.test.ts`, `protection.test.ts`, `tests/ui/*` (`format`, `selection`,
`layout`, `useTurnInput`), and `tests/ai/*` (`score`, `bot`).

### 6.3 AI tests

- A push that only advances an opponent scores **below** a `discard` (no gain).
- A push that **captures** a third player's marble scores **above** a `discard`.
- A push that forces a near-mouth opponent to **wrap past its start** scores
  **above** a `discard` (overshoot bonus).
- `pickMove` selects a capturing / overshoot push over a pointless one.

### 6.4 UI tests

- Selection: pick the 5 → pick an opponent marble → commits the `push` move.

## 7. Documentation to update

- **Terminal spec** (`2026-07-15-tock-terminal-design.md`): §6.1 card table (5 =
  push an opponent forward 5), §6.2 `Move` union (add `push`), §7 detailed rules
  (a "Push (5)" paragraph: opponent-only, forward 5, ring-only/never enters the
  finish, respects protection and path/landing rules, may capture a third
  marble).
- **AI spec** (`2026-07-16-tock-ai-design.md`): §5 (the `opponentProgress` term
  and weight, with the wrap-past-mouth nuance).
- **`CLAUDE.md`**: the `Move` union bullet and the card-effects summary.

## 8. Decisions defaulted (not open questions)

- **Move type name**: `push`.
- **`steps` field kept** on `push` for uniformity with `move`, though always 5.
- **Self-capture via push** (landing on your own marble) is legal; the bot never
  chooses it.
- **Neutral replacement rank in migrated tests**: `6`.

## 9. Out of scope

- No new bot difficulty; the change is folded into the single "Normal" heuristic.
- No backward push, no split push, no multi-target push.
- No change to any other card.

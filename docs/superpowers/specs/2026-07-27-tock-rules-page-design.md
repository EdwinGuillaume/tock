# Tock — a rules page in the mobile web app

Date: 2026-07-27
Scope: `apps/web` only. Three new source files, five modified components/screens,
new tests under `apps/web/tests/`. `@tock/core` and `apps/terminal` are
untouched. All copy is French (the app's language); identifiers and comments are
English (Code Style).

## Motivation

The in-game hints (`apps/web/src/hint.ts`) teach one move at a time and are well
liked, but a new player has nowhere to read the rules as a whole — the goal of
the game, what each card does, and the special moves (capture, start-square
protection, entering the finish lane). This spec adds a **rules page**, reachable
from everywhere a player might want it, without changing the game engine or the
existing hint system (the two are complementary: hints coach the current move,
the rules page explains the whole game).

## Overview

A single **overlay panel** (`RulesOverlay`) that floats above whatever screen is
showing. It is opened from three places — Home, Setup, and, during play, a "?"
button in the `StatusBar` — and closed with a ✕, a tap on the backdrop, or the
Escape key, returning the player exactly where they were. Because it is an
overlay rather than a routed screen, **opening it during a game never touches the
game state**.

The content is a **card-first reference**, in the warm, concise tone of the
existing hints: a one-line goal, a scannable list of the 13 card ranks each with
its effect, and a short "special moves" section.

## Behaviour — one overlay owned by `App`

`RulesOverlay` is rendered in `App.tsx` as a sibling of `<UpdateBanner />`, i.e.
**above** `<ScreenTransition>`, so it layers over any screen. `App` owns a single
piece of state, `rulesOpen: boolean`, with `openRules` / `closeRules` handlers.

Each screen that offers the trigger receives an `onOpenRules: () => void`
callback:

- `Home` (via its existing props),
- `Setup` (via its existing props),
- `GameScreen` → threads it to `StatusBar`.

This keeps the overlay a single, well-bounded unit reachable from anywhere, and
keeps every screen ignorant of the overlay's internals — they only fire a
callback. `PassInterstitial` and `GameOver` do **not** get a trigger (the handoff
cover must stay opaque; the win screen has its own flow).

Rationale for an overlay over a routed screen: the rules must be reachable from
three different screens and, in-game, must not disturb `GameState` or the
pass-and-play handoff logic. A routed screen would need a new entry in `App`'s
screen state machine plus explicit "return to where I was" plumbing for each
origin; an overlay needs neither.

## Triggers — the three access points

A small shared component `RulesButton` renders a round gold "?" pill in the
"Feutrine & or" style (`theme.ts` tokens), so the affordance looks identical
everywhere and its styling lives in one place. It takes `onClick` and an
`aria-label` ("Ouvrir les règles").

- **Home** — a discreet "Règles" text button below the CTA area, present in
  **all** offer states (play CTA, install offer, installed note), so the rules
  are reachable even once the app is installed. On Home the label reads "Règles"
  rather than a bare "?", since there is room and no board to compete with.
- **Setup** — a `RulesButton` ("?") in the screen's top area, so a first-time
  player can read the rules before starting.
- **In-game** — a `RulesButton` ("?") added to `StatusBar`, to the right of the
  Pioche / Défausse pills. `StatusBar` gains an `onOpenRules` prop; `GameScreen`
  passes it through.

## Content — a card-first reference

A pure data module `apps/web/src/rulesContent.ts` holds the copy, so it is
testable in isolation and the component stays presentational. It is derived from
`docs/superpowers/specs/2026-07-15-tock-terminal-design.md` §5 and verified
against the engine (`packages/core/src/engine/{cards,moves}.ts`). Structure:

1. **But** (goal) — one line: *ramène tes 4 billes dans ton couloir* (be the
   first to bring all four marbles home into your finish lane).

2. **Les cartes** — the 13 ranks, one line each, matching the engine's
   `moveSteps` / `canExit`. Card faces reuse the suited mini-card look from
   `Hand.tsx`:
   - **A** — sortir une bille *ou* avancer de 1
   - **K** — sortir une bille *ou* avancer de 13
   - **D (Q)** — avancer de 12
   - **V (J)** — échanger deux billes (une tienne, une adverse)
   - **7** — répartir 7 pas entre tes billes (une ou plusieurs)
   - **5** — avancer une bille *adverse* de 5
   - **4** — reculer de 4 (ne fait jamais entrer dans la maison)
   - **2 · 3 · 6 · 8 · 9 · 10** — avancer du nombre indiqué

3. **Coups spéciaux** — three short entries:
   - **Capture** — atterrir sur une bille adverse sur l'anneau la renvoie à son
     nid (une bille à toi sur la case bloque le déplacement).
   - **Protection** — une bille sur sa propre case de départ ne peut être ni
     capturée ni échangée (défense uniquement).
   - **Entrée dans la maison** — une bille entre dans son couloir en franchissant
     sa bouche vers l'avant ; il faut le compte exact pour s'y poser.

The exact wording is finalized during implementation from spec §5, cross-checked
against `moveSteps`, `canExit`, the capture rule (`moves.ts` — track-only,
opponent-only, own marble blocks) and `isProtected` (own start cell, defensive
only). The data shape is a small typed record per section so the test can assert
all 13 ranks are present with non-empty effect strings.

## Style & accessibility

- **Look** — "Feutrine & or": a dark scrim over the current screen and a felt
  panel with rounded corners (`theme.radius`), a header row (title "Règles" +
  ✕), and a **scrollable** body. Reuses `theme.ts` tokens only — no new tokens.
- **Safe areas** — the panel honours `safeTop` / `safeBottom` (`layout.ts`) so
  the header and the last line clear the iOS status bar and home indicator.
- **Motion** — enter/leave via `motion/react` using `motion.ts` durations/easings
  (scrim fade + panel rise), gated by `prefersReducedMotion` (instant, no
  transform) exactly like `ScreenTransition`.
- **A11y** — `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on the title;
  Escape and backdrop tap close; focus moves to the ✕ button on open. The body
  scrolls independently of the (frozen) screen behind it.

## Files

New (`apps/web/src/`):
- `rulesContent.ts` — pure content data (goal line, card list, special-move
  entries) + its types.
- `components/RulesOverlay.tsx` — the dialog: scrim + felt panel, header, scrollable
  body rendering `rulesContent`, motion, a11y.
- `components/RulesButton.tsx` — shared gold "?"/"Règles" trigger pill.

Modified:
- `components/App.tsx` — `rulesOpen` state + `open`/`close` handlers; render
  `<RulesOverlay>` beside `<UpdateBanner>`; pass `onOpenRules` to Home, Setup,
  GameScreen.
- `components/Home.tsx` — "Règles" trigger below the CTA, in every offer state.
- `components/Setup.tsx` — a `RulesButton` in the top area.
- `components/StatusBar.tsx` — accept `onOpenRules`; render a `RulesButton` after
  the pile pills.
- `components/GameScreen.tsx` — thread `onOpenRules` into `StatusBar`.

## Testing (`apps/web/tests/`, jsdom + @testing-library/react)

- `rulesContent.test.ts` — all 13 ranks present, every effect string non-empty,
  the three special-move entries present (pure-data invariants).
- `rulesOverlay.test.tsx` — renders the goal, the card list and the special-move
  section when open; nothing when closed; `role="dialog"` present; closes via the
  ✕ button, a backdrop tap, and the Escape key (each fires `onClose`).
- `rulesAccess.test.tsx` — Home, Setup, and `StatusBar` each render a rules
  trigger whose activation calls the injected `onOpenRules`.

`pnpm -r typecheck` and `pnpm -r test` stay green; no test count regression.

## Out of scope

- No general in-game **settings menu** — only a rules trigger. (A settings menu
  is a possible later host for this same button.)
- No changes to `@tock/core`, the engine, the bot, or `apps/terminal`.
- No changes to the hint system — the rules page complements it.
- No new theme or motion tokens; reuse the existing ones.

# Tock web — visual & UX redesign ("Feutrine & or") — Design document

- **Date**: 2026-07-22
- **Status**: approved (brainstorming), ready for the implementation plan
- **Author**: eguillaume

## 1. Context & goal

The mobile web app (`apps/web`) is functionally complete (M1 solo-vs-bots + M2
pass-and-play, 66 tests) but visually and ergonomically weak: the menu is
unstyled default browser buttons, the board reads as flat "drilled holes", cards
show only a rank with no suit, the game log eats the top of the screen, and there
is no motion or feedback anywhere. The goal is a **full visual + ergonomic
redesign** that is beautiful, practical, and enjoyable — worthy of a portfolio
shareable link.

**Aesthetic north star: _Balatro_** — colorful yet elegant, unmistakably
**adult** (never childish, never cold), with constant, tasteful **"juice"**
(micro-animations and feedback that make the game feel alive). The chosen
direction is **"Feutrine & or"** (warm felt & gold): a dark warm felt table, a
restrained gold accent, jewel-toned marbles, and dosed motion.

**Scope boundary — `apps/web` only.** `@tock/core` (engine, bot, and the
`board2d` grid geometry) is **not touched**. Every change lives under
`apps/web/src`. The board's abstract geometry is unchanged; only its *rendering*
and the web-local `homeSlotCenter` layout helper change. This preserves the
package boundary that makes the project maintainable (CLAUDE.md "non-negotiable
constraints").

This is a **visual + ergonomics** redesign (the two problems the user named).
Explicitly out of scope: new game features (sound, settings screen, tutorial,
light theme), PWA/native work (M3/M4 roadmap), and any rules/bot change.

## 1bis. Visual reference (validated mockups) — the source of truth

The design was validated screen-by-screen in brainstorming against interactive
mockups, kept in
[`2026-07-22-tock-web-visual-redesign-mockups/`](./2026-07-22-tock-web-visual-redesign-mockups/)
(committed next to this document, with its own `README.md`). Those files are the
**authoritative visual reference** — the implementation must match them, and they
exist specifically to prevent drift. This prose spec and the mockups are meant to
be read together: the spec gives the tokens, rules, and rationale; the mockups
show the exact intended look, layout, and motion. Where the prose and a mockup
appear to disagree, treat the mockup as authoritative for *look and motion* and
the spec as authoritative for *tokens, geometry rules, and scope*.

Mockup → screen map: `menu.html` (§5.1), `game-screen.html` (§5.2–5.3),
`board.html` (§4), `interactions.html` (§5.4), `endgame.html` (§5.5–5.6),
`transitions.html` (§7).

## 2. Design direction — "Feutrine & or"

A warm dark felt background, a **single** restrained gold accent, jewel marbles,
and generous spacing. The guardrails below keep it "chic, not garish"
(the user's explicit worry about "design grossier"):

- **Gold is rationed.** Gold appears only on: the logo, section labels, the one
  hero button, selected/active states, the board's finish threads + centre
  emblem, and destination echoes. Everything else is warm-neutral text on felt.
- **Depth is soft.** Hairline dividers (1px, low-opacity gold), soft layered
  shadows, carved (recessed) sockets — no thick clumsy outlines.
- **One hero button only.** The chunky, "pushable" 3D button (bottom-lip shadow,
  presses down on `:active`) is used exclusively for the primary call to action
  on a screen (menu "Lancer la partie", GameOver "Rejouer", Pass "Révéler ma
  main"). Secondary controls stay refined-flat.

## 3. Design tokens (`apps/web/src/theme.ts`)

`theme.ts` is rewritten from the current wood palette to the tokens below. Values
are authoritative; the implementation should read from these rather than
inlining literals.

### 3.1 Colour

```
felt (background)   radial-gradient(130% 90% at 50% 45%, #1f5147 0%, #0c211d 72%)
feltPanel           #173e35   (the ring channel / raised felt)
socket gradient     radial 50%/42% r62%: #05100d -> #0a201b (55%) -> #1b4d42
gold                #ffd873   (bright accent, emblem, threads, echoes)
goldButton          linear-gradient(#ffcf5f, #e6a636)   (hero CTA face)
goldButtonLip       #9c6b1e   (hero CTA bottom-lip shadow)
goldDim             #d8b871   (section labels)
ink (text)          #e8eaf0
inkDim              #9aa2b4
hairline            rgba(255,216,115,.14)
cardFace            #f5ecd6
cardInk             #2a2320
cardInkRed          #c8323a   (hearts/diamonds)
cardBack            linear-gradient(135deg,#3a2a12,#1c1408) + gold hairline border
```

Seat colours (marble radial gradient `light -> dark`, keyed by `Color`):

```
red     #ff8a8f -> #c02b31
green   #86e6a0 -> #2e8a4a
yellow  #ffe79a -> #d29a1e
blue    #93b6ff -> #345fd0
```

Each seat also derives a `soft` rgba (e.g. `229,72,77`) for glows, home-pod
tints, and finish-socket rims.

### 3.2 Type, radius, shadow, motion

```
fontDisplay   'Fredoka', sans-serif        (logo, titles, ranks, section headings, weights 600-700)
fontUi        'Inter', system-ui, sans-serif (body/UI, weights 400-600)

radius        sm 8 · md 12 · lg 16 · pill 20 · card 10
shadowCard    0 8px 14px rgba(0,0,0,.45)
shadowFloat   0 16px 26px rgba(0,0,0,.5)
glowGold      0 0 22px rgba(255,216,115,.6)

motion.fast   0.16s   motion.base 0.3s
ease.accel    cubic-bezier(.7,0,.84,0)      (draw/discard, transitions — "sudden acceleration")
ease.spring   cubic-bezier(.34,1.56,.64,1)  (card lift / marble settle)
echo.duration 3.2s                           (slow, calm)
```

### 3.3 Fonts

Self-host **Fredoka** and **Inter** via `@fontsource/fredoka` and
`@fontsource/inter` (added to `apps/web`), imported once in `main.tsx`. Self-host
(not a CDN link) so there is no layout shift and the app stays offline-ready for
the M3 PWA milestone. Update `index.html` `<meta name="theme-color">` from the
wood `#5c3a17` to a felt tone (`#0c211d`).

## 4. Board rendering (`Board.tsx`, `svgGeometry.ts`)

The abstract geometry (`board2d`: `ringCoord`, `finishCoord`, `cellOf`, and the
ring walk) is **unchanged**. Only the drawing changes, from per-cell wood tiles
to a felt track. The ordered ring is obtained by mapping indices
`0..ringSize-1` through `ringCoord`.

- **Main ring = continuous felt channel (style "B").** Stroke the closed
  polyline through the ordered ring-cell centres as one rounded channel
  (`feltPanel` stroke, round joins/caps, plus a faint `hairline` overlay stroke).
  This replaces the individual `Tile` rects so the track reads as one continuous
  path around the cross.
- **Sockets = carved recesses.** Each ring / finish / home cell draws a socket:
  the `socket` radial gradient (dark centre, lighter rim) + an inner-shadow ring
  (`rgba(0,0,0,.5)`) + a thin bottom light-rim arc (`rgba(255,255,255,.13)`) so
  it reads concave. **Sockets are small relative to the cell pitch** so felt
  breathes around each one (no overlap — the fix for the "cramped" first pass).
  Target ratio: socket radius ≈ 0.33 × pitch, marble radius ≈ 0.30 × pitch,
  channel width ≈ 2 × socket radius + a small margin.
- **Finish lanes = gold thread (style "C").** Not a felt channel. A thin **gold
  thread** runs from each arm's lane mouth **to the centre emblem circle and
  stops there** (it does not cross or pass the emblem), linking that seat's four
  finish sockets. The finish sockets carry a **seat-colour rim** for ownership.
  This detaches the finish lanes from the heavy ring channel (the fix for
  "lanes glued to the track").
- **Home nests = tinted corner pods, rotated clockwise.** 2×2 seat-tinted pods
  in the board corners, each on the side of that seat's start square. This
  requires changing `homeSlotCenter`'s corner map so homes rotate one corner
  clockwise vs today:

  | seat (`sideOf`) | today | new |
  |---|---|---|
  | 0 bottom (red) | bottom-right | **bottom-left** |
  | 1 left (green) | bottom-left | **top-left** |
  | 2 top (yellow) | top-left | **top-right** |
  | 3 right (blue) | top-right | **bottom-right** |

  i.e. the corner map becomes `bottom {near,far}`, `left {near,near}`,
  `top {far,near}`, `right {far,far}`. Homes are off-grid (cosmetic only —
  `cellOf` returns `null` for the home zone), so this is a pure rendering change,
  isolated to the web app.
- **Start squares.** A seat-colour ring around each seat's start ring-cell.
- **Centre emblem.** A gold circle with a "T" glyph; the four finish threads
  converge on it.
- **Marbles (`Marble.tsx`).** Glossy: the seat radial gradient + a white
  specular highlight dot + a soft drop-shadow ellipse beneath. The **selected**
  marble gets a steady gold ring. Movement is a spring tween along the path
  (see §6).

## 5. Screens

### 5.1 Setup / menu (`Setup.tsx`)

Warm felt screen, top to bottom:

1. **Header** — "TOCK" logo (Fredoka, gold, layered shadow) + tagline
   ("course de billes") + a gold hairline divider.
2. **Section label** "Joueurs" (uppercase, `goldDim`).
3. **Four seat rows**, each carrying the seat's **marble colour** dot:
   - Seat 0 = **"Vous"**, locked human, shown with a gold "JOUEUR" chip (no
     toggle).
   - Opponent seats use the **empty-slot "chairs"** model:
     - **Absent** = a dashed placeholder row "＋ Ajouter <couleur>"; tapping it
       seats a player (defaults to **Bot**).
     - **Present** = marble + name + a **segmented control** [Humain | Bot] +
       a small "×" to remove (return to absent). The segmented control is used
       **only** for the human/bot choice (selected segment = gold gradient).
   - Seat names use **colour names** (Vert, Jaune, Bleu) to reinforce the
     marble identity.
4. **Section label** "Plateau" + two selectable cards: "Standard · 48 · vif" and
   "Grand · 72 · long" (selected = gold-tinted border + faint inner glow).
5. **Hero CTA** "Lancer la partie" (the one pushable gold button).

Rationale (ergonomics): every seat's state is always visible (no blind "cycle"
button); presence (in/out of the game) and role (human/bot) are separated;
the "chairs" metaphor reads better than a stack of iOS-style switches.

### 5.2 Game screen (`GameScreen.tsx`)

Layout order, top to bottom (the board is the hero, given the most space):

1. **Top bar (`StatusBar.tsx`)** — left: a turn indicator (a gently bobbing
   marble-colour dot + "À toi de jouer" / "<couleur> réfléchit…"); right: two
   small gold-outlined pill chips "Pioche N" and "Défausse N".
2. **Log ticker (`GameLog.tsx`)** — demoted from the current ~130px scrolling
   block to a **single line** showing the last action, with a "▾" affordance that
   expands the full history on demand. Frees vertical space for the board.
3. **Board** — centred, largest element.
4. **Hint chip** — the turn prompt as a **discreet** chip (reduced opacity ~.62,
   thin border, very light fill, small) — never the large centred text that made
   the screen feel childish.
5. **Hand (`Hand.tsx`)** — see §5.3.

### 5.3 Hand & cards (`Hand.tsx`)

- Cards show **rank + suit** (♥ ♦ ♠ ♣): corner rank+pip (top-left, mirrored
  bottom-right) and a large centre pip. Red suits use `cardInkRed`.
- Fanned (rotation + slight lift by distance from centre), larger than today.
- **Selected** card lifts, scales up, straightens, and gets a gold glow (spring
  easing). **Unplayable** cards are dimmed (~.42) and disabled.
- Card-first interaction is kept: tap a playable card → its destinations appear
  as echo ghosts on the board → tap a ghost to commit (the existing
  `moveSelection` flow, restyled).

### 5.4 Special interactions

- **The 7 (split).** On selecting a 7: a budget gauge of **7 pips** (spent =
  hollow, remaining = gold) with a "Reste N" readout, "Annuler", and "Jouer le 7"
  (enabled only at 0). Tap a candidate marble (candidates glow) → tap a
  destination (echo ghosts **labelled with the step count**) → the pips deplete;
  repeat until 0, then play. (`SplitControls.tsx` restyled; the split-allocation
  state machine in `splitAllocation.ts` is unchanged.)
- **The Jack (swap).** Tap J → tap your marble (gold ring) → valid targets show a
  "⇄" echo marker → tap one to permute.
- **Discard.** When no move is playable, all cards dim and the hint reads "Aucun
  coup — touche une carte pour la défausser". Tapping a card discards it with the
  **reverse of the draw animation** (the card lifts up out of the hand, short and
  fast, `ease.accel`, fading) — deliberately minimal, no fly-to-pile arc.

### 5.5 GameOver (`GameOver.tsx`)

Warm felt, a small "TOCK", the **winner's marble** (seat colour) gently popping,
"<Couleur> gagne !" in the seat colour, a subtitle, the hero "Rejouer" button, and
a discreet "Retour au menu" text link. **Dosed confetti** (gold + seat colours)
that fires **once the screen has settled** (not during the transition).

### 5.6 PassInterstitial (`PassInterstitial.tsx`)

Warm felt: a "passe le téléphone" label, the next player's **marble** (colour)
glowing, "À <Couleur> de jouer", and the hero "Révéler ma main" button. The hand
stays **hidden** (card backs) until the tap — the privacy guarantee of
pass-and-play.

## 6. Motion & juice

All motion is **adult and dosed**, and every animation has a
`prefers-reduced-motion` fallback (near-instant / no ambient loops).

| Effect | Behaviour |
|---|---|
| Destination markers | **Echo/ripple**: a steady gold ring + expanding-and-fading echo rings (`echo.duration` 3.2s, calm). **Not** a pulse (rejected as crude). |
| Card draw | Card arrives from just **above** the hand (~44px), **fast**, with a **sudden acceleration** (`ease.accel`, ~0.3s). |
| Card play / discard | The **reverse** of the draw (lifts up and out, fast, `ease.accel`, fades). |
| Marble move | Spring tween along the travelled path (`ease.spring`). |
| Capture ("prise") | The captured marble pops/returns home + a small screen-shake + a floating "PRISE !" label. |
| Card selection | Lift + scale + straighten + gold glow (`ease.spring`). |
| Turn change | The active seat's colour accent asserts itself (dot + subtle banner). |
| Win | Confetti on the GameOver screen (post-transition). |

**Library.** CSS-first for ambient and simple motion (echoes, draw/discard,
selection, hover, glow, confetti, screen transitions). Recommend adding
**Framer Motion** (`motion/react`) for the physics-y pieces (marble spring
movement, capture pop + screen-shake, "PRISE !" pop) — it orchestrates
interruptions cleanly and honours `prefers-reduced-motion` out of the box. Final
call left to the implementation plan; the bundle cost is acceptable for a
portfolio piece. This is the one open technical decision (§11).

## 7. Screen transitions (`App.tsx`)

A transition wrapper sits at the routing level (Setup → GameScreen → GameOver,
plus the PassInterstitial gate).

- **Default** — crossfade + lively acceleration (`ease.accel`, ~0.3s).
- **GameOver entry** — fade + accel; confetti fires **after** the screen settles.
- **PassInterstitial entry** — a **fast opaque cover** (`motion.fast` ~0.16s):
  the felt veil must reach full opacity quickly so the previous player's board /
  hand never bleeds through a translucent crossfade (a real privacy leak). The
  content ("À X de jouer") then fades in. **Exit** (Révéler ma main) uses the
  standard fade + accel back to the game.
- `prefers-reduced-motion` → transitions are near-instant.

## 8. Implementation impact — file map (`apps/web/src`)

Rewritten / substantially changed:

- `theme.ts` — new token set (§3).
- `svgGeometry.ts` — socket/marble/channel sizing constants; the continuous ring
  channel path; finish gold-thread geometry (stops at emblem); `homeSlotCenter`
  clockwise rotation (§4).
- `Board.tsx` — channel + carved sockets + finish threads + tinted home pods +
  start rings + centre emblem (replaces `Tile`).
- `Marble.tsx` — gloss (highlight + shadow), selected gold ring, spring movement.
- `Ghost.tsx` — echo/ripple destination marker (replaces dashed circle); step
  labels for the 7; "⇄" for swaps.
- `Setup.tsx` — chairs + segmented + board-size cards + hero CTA (§5.1).
- `StatusBar.tsx` — turn indicator + pile pill chips.
- `GameLog.tsx` — single-line ticker + expandable history.
- `Hand.tsx` — rank+suit cards, fan, selection spring, draw/discard animation.
- `GameScreen.tsx` — hint chip, layout wiring, discard flow.
- `SplitControls.tsx` — 7-pip budget gauge styling.
- `GameOver.tsx` — winner marble + confetti + CTA.
- `PassInterstitial.tsx` — hidden hand + CTA.
- `App.tsx` — transition wrapper (§7).
- `index.css` — felt background, base type.
- `index.html` — `theme-color` → felt; `main.tsx` — font imports.

New:

- A small `motion.ts` (durations/easings, `prefers-reduced-motion` helper).
- A `Confetti` component.
- A transition wrapper component (or Framer Motion `AnimatePresence`).

`@tock/core` and `apps/terminal`: **no changes**.

## 9. Testing impact (`apps/web/tests`)

The redesign preserves the game logic, so most behavioural tests stand; the
changes are to structure/labels of restyled controls. The plan must keep or
update these **stable accessible hooks** so tests remain deterministic:

- **Preserved**: card `aria-label` `card-<rank>-<suit>`, marble `data-testid`
  `marble-<id>`, ghost `aria-label` `ghost-<label>`, the `game-log` test id.
- **Changed → tests updated**:
  - Setup: the cycling `seat N: kind` button is replaced by the chairs +
    segmented model. Define new accessible names (e.g. an "Ajouter <couleur>"
    button, a `seat <n> role` group with "Humain"/"Bot" segment buttons, a
    "retirer <couleur>" button) and rewrite `setup`/`handoff` selectors against
    them.
  - The "Start" button becomes "Lancer la partie"; GameOver "Play again" →
    "Rejouer"; Pass "Tap to reveal your hand" → "Révéler ma main". Update the
    tests that query those names.
- **Animations are not asserted.** Tests run with motion effectively disabled
  (respecting reduced-motion), and assert end-state DOM/positions, not
  in-flight animation frames.

The current suite is 66 tests; expect the counts to shift as Setup/StatusBar/
GameLog assertions are rewritten, not drop in coverage.

## 10. Non-goals

- No changes to `@tock/core` (engine, bot, `board2d`) or `apps/terminal`.
- No new game features: sound, settings screen, onboarding/tutorial, light/dark
  toggle. (Candidates for a later spec.)
- No PWA/native work (M3/M4 remain roadmap).
- Board sizes (48/72), solo-vs-bots (M1), and pass-and-play (M2) keep their
  current behaviour; only their look and interaction polish change.

## 11. Open item for the plan

- **Animation library**: recommendation is CSS-first + **Framer Motion** for the
  spring/particle pieces (§6). To be confirmed when the plan is written; nothing
  else in this design depends on the choice.

# Audio assets

Provide each clip as **`.mp3`** — the single shipped format. mp3 plays in every
target browser (Chrome/Firefox/Safari/iOS), and it sidesteps a Howler pitfall:
Howler picks a source by codec support, not by file existence, and does not fall
back on a 404 — so a missing `.webm` listed next to an `.mp3` would load nothing.
Filenames are the pool entries in `src/audio/sounds.ts`; a `-N` suffix is just a
variety variant of the same cue (the engine picks one at random per play, so they
should sound like siblings, not different events). Volumes live in `sounds.ts`.

Real CC0 clips are now in place (see **Provenance** below); the engine still
swallows load errors and stays silent if a file is missing, so any cue can be
swapped for another clip by dropping in a same-named `.mp3`.

## What each cue is

| Files | Fires when | Suggested character |
|---|---|---|
| `exit-1`, `exit-2` | A marble leaves its home nest onto its start square (an Ace or King **exit**). | Bright, positive "pop" / launch — a marble entering play. |
| `move-1`, `move-2`, `move-3` | A marble advances along the ring or **within** the finish lane (also a backward 4), without crossing the lane mouth. The **most frequent** cue — 3 variants to avoid repetition. | Soft, short marble "tick" / hop — one peg moving. Keep it subtle. |
| `lane-entry-1` | A marble **crosses into its finish lane** (the audible twin of the lane-entry animation; a plain move replaces its `move` cue, a 7-split layers this on top). | A marked "home-stretch" beat — a chime/swoosh as the marble turns for home. |
| `push-1`, `push-2` | The **5** shoves an opponent's marble 5 forward. | Firmer "knock" / shove — heavier than `move`, implies contact. |
| `swap-1` | The **Jack** swaps the mover's marble with another. | Quick "whoosh" / swap — two things trading places. |
| `split7-1` | The **7** is split across marbles. | Light "shuffle" / sprinkle — several small movements at once. |
| `discard-1`, `discard-2` | A card is discarded (no legal move / forced discard). | Soft card "flick" / toss — paper, not a marble. |
| `capture-1`, `capture-2` | Any marble is sent home (a **capture**). **Layered on top** of the move cue that caused it. | Satisfying "thunk" / knock-out — the sting of sending someone home. The loudest SFX. |
| `win-1` | A player wins (all their marbles home). Fires once, **layered** over the last move. | Short triumphant flourish / jingle — the game-over beat (pairs with the confetti). |
| `draw-1`, `draw-2` | A **human** mover draws their fresh replacement card (continuous draw), after their own move only — never on a bot's turn. | Very soft card "deal" / slide — subtle, it fires every human turn. |
| `tap-1`, `tap-2` | A primary navigation button is pressed: **Nouvelle partie**, **Lancer la partie**, **Rejouer**. Not on gameplay taps or secondary buttons. | Clean UI "click" — a confident button press, distinct from the marble cues. |

## Music bed

`music-loop.webm` / `music-loop.mp3` — the background bed, looping continuously
in the installed app (starts on the first gesture, pauses when the tab is
hidden). Warm, low-key ambient loop matching the "Feutrine & or" (felt & gold)
mood; **must loop seamlessly** (no click/gap at the seam) and stay compressed
(it is precached by the service worker — keep it under the 4 MB precache cap).

## Sourcing notes

- One consistent tonal family across the SFX so they read as one instrument set.
- Keep SFX short (~100–300 ms); `capture`/`win` may be a touch longer.
- `move` / `push` / `swap` / `split7` / `exit` / `discard` fire one-per-move;
  `capture` and `win` stack on top of them, so they must sit well in a mix
  played simultaneously.
- Master mute and the install gate are handled in code — deliver dry clips at
  natural level; per-cue balance is set by the `volume` in `sounds.ts`.

## Provenance

All shipped SFX are from **Kenney's game-audio packs**, released under
**CC0 1.0** (public domain — no attribution required, none of the clips need
crediting). Sourced via the browsable mirror at `gamesounds.xyz` and transcoded
from the original `.ogg` to `.mp3` (dry, no volume change — balance stays in
`sounds.ts`). `split7-1` is `cardShuffle` trimmed to ~0.85 s with a short
fade-out (the full riffle is 3 s — too long for a layered accent).

| File | Source clip (Kenney) | Pack |
|---|---|---|
| `exit-1`, `exit-2` | `impactWood_light_000`, `impactWood_light_002` | Impact Sounds |
| `move-1`, `move-2` | `pluck_001`, `pluck_002` | Interface Sounds |
| `lane-entry-1` | `glass_001` | Interface Sounds |
| `tap-1`, `tap-2` | `click_001`, `click_002` | Interface Sounds |
| `push-1`, `push-2` | `impactWood_medium_000`, `impactWood_medium_001` | Impact Sounds |
| `capture-1`, `capture-2` | `impactPunch_heavy_000`, `impactPunch_heavy_001` | Impact Sounds |
| `swap-1` | `woosh1` | Foley Sounds |
| `split7-1` | `cardShuffle` (trimmed) | Casino Audio |
| `discard-1` | `cardShove1` | Casino Audio |
| `draw-1`, `draw-2` | `cardSlide1`, `cardSlide2` | Casino Audio |
| `win-1` | `jingles-pizzicato_05` | Music Jingles |

`music-loop.mp3` (the background bed) predates this set and is unchanged.

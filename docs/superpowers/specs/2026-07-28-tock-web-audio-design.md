# Tock — Web audio (sound effects + music) design

**Date:** 2026-07-28
**Scope:** `apps/web` only (`@tock/core` untouched)
**Status:** design approved, ready for an implementation plan

## 1. Goal

Give the web app a sense of tactility and atmosphere: a short **sound effect on
every game action** (and on the two "strong moments" — captures and victory —
plus a soft **draw** cue), over a **looping background music bed**. The player
can mute everything from a single speaker button, and the preference persists.

This is a presentation-layer feature. Audio *reacts* to state transitions; it
never participates in the rules. The engine (`@tock/core`) is not touched, in
keeping with the strict engine/UI package boundary that already lets one engine
back both front-ends.

### In scope

- SFX for each committed move: `exit`, `move`, `push`, `swap`, `split7`, `discard`.
- Accent SFX layered on top when the transition warrants it: `capture`, `win`.
- A soft `draw` cue when a **human** draws their fresh card (continuous draw).
- One looping music bed, continuous across screens, started on first gesture.
- A **variety pool** per SFX: each sound draws one clip at random from a small
  pool so the same clip is not heard on every repeat ("éviter la redondance").
- A single master **mute** (speaker + slash icon), persisted in `localStorage`.
- **Install gate:** audio is dormant until the app runs as the installed PWA
  (`isStandalone()`); a normal browser tab stays silent (see §2, Install gate).
- Offline support: audio assets precached by the existing service worker.

### Out of scope / YAGNI (noted, not built)

- Separate music vs. SFX volume sliders — one master mute only.
- Music **ducking** under the victory jingle (a fixed lower music volume is fine).
- A distinct sound for a backward `move` (the 4) — it reuses the `move` pool.
- Final audio assets — the manifest defines **slots + placeholders**; sourcing
  royalty-free final sounds is a separate follow-up task (§13).

## 2. Architecture

Everything lives under a new `apps/web/src/audio/` module. Four layers, each
with one purpose and a clean seam:

| Layer | File | Purpose | Pure? |
|---|---|---|---|
| Catalogue | `audio/sounds.ts` | manifest: `SoundId → { pool, volume }`, formats, music track | data |
| Mapping | `audio/soundForMove.ts` | `(before, after, move) → SoundId[]` — the semantic layer | ✅ pure |
| Engine | `audio/AudioEngine.ts` | Howler wrapper behind a small interface (load / unlock / play / music / mute) | no (Howler) |
| React | `audio/AudioProvider.tsx` + `audio/useAudio.ts` | provider: first-gesture unlock, persistence, visibility, the `play` API | no |

Plus:
- `audio/gameEvents.ts` — `capturedColorList(before, after)` extracted from
  `format.ts` so `moveLabel` and `soundForMove` share one capture-detection
  source of truth.
- `components/MuteButton.tsx` + an inline `SpeakerIcon` (speaker + slash).
- `public/audio/*` — placeholder clips (`move-1.webm`/`.mp3`, …, `music-loop.*`).

### The single trigger site (validated: Option A)

SFX are fired from **`App.commitAndPass`** (`components/App.tsx`), which already
computes `next = applyMove(state, move)` for the handoff decision and knows the
mover (`state.currentPlayer`). It is the one place every move — human and bot —
passes through, so wiring audio there sonifies both without a second seam:

```ts
const commitAndPass = useCallback((move: Move) => {
  if (!state) return
  const before = state
  const previous = before.currentPlayer
  commitMove(move)
  const next = applyMove(before, move)
  // audio (mute-gated inside the engine)
  soundForMove(before, next, move).forEach(id => play(id))
  if (humanIdList.includes(previous)) play('draw')   // pioche: human mover only
  if (needsHandoff(previous, next, humanSeatIds(next))) setAwaitingHandoff(true)
}, [state, humanIdList, commitMove, play])
```

`play` comes from `useAudio()` (App is rendered inside `AudioProvider`). The
engine no-ops when muted, so callers never check mute state.

**Invariant:** `play` must be referentially **stable** (a `useCallback` over an
engine held in a ref — see §6). `commitAndPass` lists it as a dependency, and the
existing code relies on `commitAndPass`'s identity changing only when `state`
changes so `useBotAutoplay` re-arms its timer exactly once per state, not per
render. A stable `play` preserves that invariant.

### Install gate — audio only when running as the installed app

**No sound or music plays until the app is installed.** The whole audio
subsystem is dormant in a normal browser tab and wakes only when the app runs as
the installed PWA.

- **Signal:** `isStandalone()` from `pwa/platform.ts` — true exactly when
  launched from the home screen in standalone display mode (it already covers
  iOS via `navigator.standalone`). This is the only *reliable, universally
  supported* proxy for "installed": a plain browser tab cannot dependably detect
  whether the PWA is installed elsewhere, and installing mid-session leaves the
  current tab non-standalone. Standalone is also exactly the immersive context
  where ambient audio belongs.
- **Dev/QA override:** `import.meta.env.DEV` forces audio on under `pnpm dev`
  (otherwise the dev server — a browser tab — would be silent and the feature
  undevelopable). A `?audio=1` query flag additionally forces it on for any build
  (to hear it in `pnpm preview`). So: dev server = audible, production browser
  tab = silent, production standalone = audible.
- **Effect when gated off** (`enabled === false`): `AudioProvider` attaches no
  first-gesture listener, never starts music, `play` is a no-op, and
  `MuteButton` renders `null` (nothing to mute). The gate is evaluated once at
  provider mount.

  ```ts
  const enabled = isStandalone() || import.meta.env.DEV ||
    new URLSearchParams(window.location.search).has('audio')
  ```

**Tradeoff — decided (intended).** Most people opening the shareable portfolio
link do so in a browser, where they will hear **nothing**; only visitors who
install the PWA get the audio. This is deliberate on two counts: (1) it avoids
surprising a first-time link visitor with unexpected audio, keeping the browser
preview clean, and (2) the missing audio becomes a reason to install — the
installed app is opened deliberately "to see more", and that is where the full,
immersive experience (audio included) lives. Accepting that casual link visitors
do not hear the audio work is the intended cost.

## 3. Data model — `audio/sounds.ts`

```ts
export type SoundId =
  | 'exit' | 'move' | 'push' | 'swap' | 'split7' | 'discard'  // move types
  | 'capture' | 'win'                                         // accents
  | 'draw'                                                    // pioche

// A pool is a list of clip base names; the engine appends formats and picks one
// at random per play. Two array concepts are deliberately separate:
//   - `pool`     : distinct clip variants for one SoundId (variety)
//   - AUDIO_FORMATS : codec fallbacks for one clip (Safari/Chrome coverage)
export const soundManifest: Record<SoundId, { pool: string[]; volume: number }> = {
  exit:    { pool: ['exit-1', 'exit-2'],       volume: 0.6 },
  move:    { pool: ['move-1', 'move-2', 'move-3'], volume: 0.5 },
  push:    { pool: ['push-1', 'push-2'],       volume: 0.7 },
  swap:    { pool: ['swap-1'],                 volume: 0.6 },
  split7:  { pool: ['split7-1'],               volume: 0.6 },
  discard: { pool: ['discard-1', 'discard-2'], volume: 0.45 },
  capture: { pool: ['capture-1', 'capture-2'], volume: 0.85 },
  win:     { pool: ['win-1'],                  volume: 0.9 },
  draw:    { pool: ['draw-1', 'draw-2'],       volume: 0.4 }
}

// iOS Safari is the constraint: AAC/MP3 are safe; webm/opus is smaller where
// supported. Each clip ships both; Howler picks the first playable src.
export const AUDIO_FORMATS = ['webm', 'mp3'] as const
export const musicTrack = { name: 'music-loop', volume: 0.35 }
export const AUDIO_BASE = 'audio'  // resolved against import.meta.env.BASE_URL
```

Placeholder clips fill every slot at first; the pool sizes above are the target
variety, not a hard requirement (a pool of one is valid).

## 4. The mapping — `audio/soundForMove.ts` (pure)

```ts
import { capturedColorList } from './gameEvents'

export const soundForMove = (before: GameState, after: GameState, move: Move): SoundId[] => {
  const list: SoundId[] = [move.type]            // move-type names double as SoundIds
  if (capturedColorList(before, after).length > 0) list.push('capture')
  if (after.winner !== null) list.push('win')
  return list
}
```

- The `Move` union member names (`exit`/`move`/`push`/`swap`/`split7`/`discard`)
  are reused verbatim as `SoundId`s — the type system keeps them in lockstep.
- Capture is detected by the same before/after diff `moveLabel` uses (a push can
  even send a third player's marble home), so the two agree by construction.
- Multiple ids per call are the **superposition** case (`['move','capture']`);
  Howler plays them concurrently.
- `draw` is **not** produced here — it is a seat/UI concern (human mover), added
  at the App layer. This keeps `soundForMove` a pure function of move semantics.

### `audio/gameEvents.ts`

`capturedColorList(before, after): Color[]` moves out of `format.ts` into this
shared pure module; `format.ts` imports it for `moveLabel`. No behaviour change,
one source of truth.

## 5. The engine — `audio/AudioEngine.ts`

A thin wrapper that is the only file aware of Howler. Behind an interface so it
is swappable and injectable in tests:

```ts
export type AudioEngine = {
  unlock: () => void                 // first gesture: resume context, allow playback
  play: (id: SoundId) => void        // random clip from the pool (no-op if muted)
  startMusic: () => void
  stopMusic: () => void
  pauseMusic: () => void             // tab hidden
  resumeMusic: () => void            // tab visible (respects mute)
  setMuted: (muted: boolean) => void
}

export const createAudioEngine = (random: () => number = Math.random): AudioEngine => { … }
```

- **Variety pick (injected RNG):** `pool[Math.floor(random() * pool.length)]` —
  same injected-RNG pattern as `pickMove`, so tests pass a seeded RNG. Extract a
  pure `pickSample(pool, random)` helper for direct unit testing.
- **Format fallback:** each clip is `new Howl({ src: AUDIO_FORMATS.map(f =>
  \`${base}/${name}.${f}\`), volume })`; Howler chooses the first playable codec.
- **Mute:** `setMuted` calls Howler's global `Howler.mute(bool)` — one switch
  covers SFX and music.
- **Music:** one looping `Howl({ loop: true })`, not autoplayed; started by the
  provider on first gesture.
- **Lazy loading:** clips are created/preloaded on first `unlock()` (or lazily
  per id) so nothing touches `AudioContext` before the user gesture.

## 6. React layer — `audio/AudioProvider.tsx` + `useAudio.ts`

`main.tsx` wraps the app: `<StrictMode><AudioProvider><App/></AudioProvider></StrictMode>`.

The provider owns:

0. **The install gate** — `enabled` is computed once at mount (§2, Install gate).
   When `false`, every item below is skipped: no listeners, no engine work,
   `play` no-ops, and the context reports `audioEnabled: false`.
1. **The engine** — created once (in a ref), only when `enabled`. Accepts an
   optional `engine` prop so tests inject a fake/spy instead of the
   Howler-backed one (dependency injection, no Howler mocking needed in
   component tests).
2. **First-gesture unlock** — when `enabled`, a one-shot `pointerdown` listener on `window`:
   ```ts
   const onFirst = () => { engine.unlock(); if (!muted) engine.startMusic() }
   window.addEventListener('pointerdown', onFirst, { once: true })
   ```
   Music therefore starts on the **very first tap anywhere** — the earliest the
   autoplay policy permits (see §10).
3. **Mute persistence** — read `localStorage['tock.muted']` on mount (default
   `false` = sound on), apply to the engine; `toggleMuted` writes it back.
4. **Visibility** — pause music on `document.visibilitychange` → hidden, resume
   on visible unless muted (basic good manners for background audio).
5. **StrictMode safety** — every listener/Howl is created with a matching
   cleanup so the dev double-mount is idempotent.

Context value: `{ audioEnabled: boolean; muted: boolean; toggleMuted: () => void; play: (id: SoundId) => void }`.
`useAudio()` is the `useContext` hook consumed by `App` (for `play`) and
`MuteButton` (for `audioEnabled` / `muted` / `toggleMuted`).

## 7. The mute control — `components/MuteButton.tsx`

State is **global** (in `AudioProvider`); the button is **contextual** and reads
the context, so no prop threading. Visual twin of `RulesButton` — same 22×22
"socket" circle, gold on dark — with an inline `SpeakerIcon` (speaker + slash
when muted), the "Barré" variant chosen from the icon exploration:

```tsx
export const MuteButton = () => {
  const { audioEnabled, muted, toggleMuted } = useAudio()
  if (!audioEnabled) return null   // browser tab: nothing to mute (see §2 gate)
  return (
    <button type="button" aria-label={muted ? 'Activer le son' : 'Couper le son'}
      aria-pressed={muted} onClick={toggleMuted} style={socketIconStyle}>
      <SpeakerIcon muted={muted} />
    </button>
  )
}
```

Because `MuteButton` self-nulls when audio is gated off, both placement sites can
render `<MuteButton />` unconditionally — no per-site `audioEnabled` check.

`SpeakerIcon` (24×24 viewBox, `currentColor` so it inherits the button's gold):
filled speaker body + two wave arcs; when `muted`, the waves are hidden and a
diagonal slash is drawn over a dark halo for legibility on the socket. The exact
paths are the "Barré" variant validated in the icon exploration (mockup saved at
`docs/superpowers/mockups/2026-07-28-mute-icon.html`):

```tsx
const SpeakerIcon = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
    <path d="M4 9H7.6L12 5V19L7.6 15H4Z" fill="currentColor" />
    {!muted && (
      <>
        <path d="M15 9.4Q17.3 12 15 14.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M17.2 7.3Q20.7 12 17.2 16.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    )}
    {muted && (
      <>
        {/* dark halo first, then the gold slash on top */}
        <line x1="4.5" y1="4" x2="19.5" y2="20" stroke={theme.socketDark} strokeWidth="4" strokeLinecap="round" />
        <line x1="4.5" y1="4" x2="19.5" y2="20" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </>
    )}
  </svg>
)
```

### Placement

- **In game:** inside the `StatusBar` right-hand cluster, immediately after
  `RulesButton` — `StatusBar.tsx` gains one `<MuteButton />` line, no new prop
  (it reads context). The felt board stays untouched.
- **Home / Setup / GameOver:** rendered by `App` as a **fixed top-right** sibling
  (like `UpdateBanner`) shown only when `screen.key !== 'game'` and not during
  the pass interstitial — the game screen provides its own in the StatusBar, so
  the two never collide. Positioned above the safe-area inset (`safeTop`).

## 8. PWA / offline — `vite.config.ts`

- Add audio extensions to precache: `globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,mp3,webm}']`.
- A music loop can exceed workbox's ~2 MB default precache limit — set
  `maximumFileSizeToCacheInBytes` accordingly, and keep the loop short and
  compressed. (If it grows large, switch music to a runtime `CacheFirst` route
  instead of precache; precache is the v1 default.)
- Formats: ship `.webm` (Opus) + `.mp3` per clip for Chrome/Safari coverage;
  iOS Safari is the binding constraint, `.mp3` guarantees it.

## 9. Browser constraints (recap)

- **Autoplay policy:** audible playback is blocked until a user gesture; an
  `AudioContext` starts `suspended`. Hence the first-gesture unlock in §6.2 —
  there is no way to start music at page open (confirmed for iOS/standalone).
- **Reduced motion is *not* coupled to sound:** there is no reduced-sound media
  query; audio defaults on and is muted manually. `prefers-reduced-motion` keeps
  governing animation only.

## 10. Testing (`apps/web/tests/`)

- `soundForMove.test.ts` — pure: move type → id; capture appends `'capture'`;
  win appends `'win'`; superposition (`['move','capture']`). Uses the rig in
  `tests/support.ts` to build states.
- `gameEvents.test.ts` — capture detection across move/push/exit/split7 (moved
  from the implicit coverage in the existing log tests).
- `pickSample.test.ts` — pure pool selection with a seeded RNG (deterministic).
- `muteButton.test.tsx` — renders inside `AudioProvider` with a fake engine;
  toggles `aria-pressed`, calls `setMuted`, shows the slash when muted.
- `audioProvider.test.tsx` — first `pointerdown` calls `unlock` + `startMusic`
  once; mute read/write to `localStorage`; visibility pause/resume; StrictMode
  double-mount stays idempotent (fake engine spy).
- `installGate.test.tsx` — with `isStandalone` stubbed **false** (and not DEV/no
  `?audio`): a `pointerdown` triggers no `unlock`/`startMusic`, `play` is a
  no-op, and `MuteButton` renders `null`. Stubbed **true**: the subsystem is
  active. `isStandalone` reads `window.matchMedia`/`navigator`, both stubbable in
  jsdom (the pattern the existing pwa tests already use).
- `audioWiring.test.tsx` — a committed human move drives `play` with the
  expected id list + `'draw'`; a bot move drives the move ids but **no** `'draw'`
  (fake engine injected via `AudioProvider`).

Howler itself is never exercised under jsdom: component tests inject a fake
engine; a lightweight `howler` mock in `tests/setup.ts` is the safety net so the
real path cannot construct an `AudioContext` in tests.

## 11. Dependencies

- `howler` (runtime) + `@types/howler` (dev), added to `apps/web/package.json`
  via `pnpm --filter @tock/web add howler` / `-D @types/howler`.

## 12. Files touched / added

**Added:** `audio/sounds.ts`, `audio/gameEvents.ts`, `audio/soundForMove.ts`,
`audio/AudioEngine.ts`, `audio/AudioProvider.tsx`, `audio/useAudio.ts`,
`components/MuteButton.tsx` (holds the inline `SpeakerIcon`), `public/audio/*`
(placeholders), the test files above. The validated icon mockup is already saved
at `docs/superpowers/mockups/2026-07-28-mute-icon.html`.

**Reused (imported, not modified):** `pwa/platform.ts` (`isStandalone` for the
install gate).

**Modified:** `format.ts` (import `capturedColorList` from `gameEvents`),
`components/App.tsx` (wrap is in `main.tsx`; wire `play` in `commitAndPass`;
render the fixed `MuteButton` off-game), `components/StatusBar.tsx` (add
`<MuteButton />`), `main.tsx` (wrap in `AudioProvider`), `vite.config.ts`
(precache globs + size), `package.json` (howler).

## 13. Follow-ups (separate tasks)

- **Asset sourcing** — replace placeholders with royalty-free final clips +
  a seamless music loop; validate licensing. This is the one hard external
  dependency and is deliberately decoupled from the code work.
- Optional later: music ducking under `win`, a distinct backward-`move` sound,
  per-channel volume, a subtle sound on the pass-and-play reveal.
- Optional later: since audio is an install-only reward (§2 gate, decided),
  the install copy could name it as an incentive ("installe pour le son"). Not
  in this scope, but a natural pairing with the gate.

---

## Addendum (2026-07-28) — UI tap sound on primary CTAs

A follow-up to the base feature: a short tap sound when the player presses a
**primary navigation button** — "Nouvelle partie" (Home), "Lancer la partie"
(Setup), "Rejouer" (GameOver). Scope is deliberately narrow (primary CTAs only,
not every chrome/menu button) to keep the earlier "no UI-sound bavardage"
intent from §1; secondary buttons (Règles, add/remove opponent, segmented
Humain/Bot, board-size, mute) stay silent.

- **New `SoundId: 'tap'`** in `sounds.ts` — a UI cue fired directly (like
  `draw`), NOT produced by `soundForMove`. Pool `['tap-1','tap-2']`, volume 0.5.
- **Eager preload.** "Nouvelle partie" is often the very first gesture, and the
  first gesture is what lazy-loads Howler — so a tap fired on that click would be
  dropped before the engine is ready. To avoid it, the engine gains a
  `preload()` method (kick off `import('howler')` WITHOUT resuming the audio
  context, since there's no gesture yet) and `AudioProvider` calls it at mount
  when audio is enabled. `unlock()` (first gesture) still loads-and-resumes. The
  chunk split from the base feature is preserved: a gated-off browser tab, which
  never mounts an enabled provider, still downloads nothing.
- **Wiring stays out of the screens.** Home/Setup/GameOver remain audio-agnostic;
  `App` owns `play` and their callbacks, so `play('tap')` is fired in App's
  `onPlay` / `onStart` / `handleRestart` wrappers.
- Install gate and mute apply unchanged (the tap only sounds in the installed,
  unmuted app). Assets remain placeholder slots (`tap-1`/`tap-2`).

---

## Addendum (2026-07-28) — distinct lane-entry cue

Split the `move` cue in two: a classic displacement keeps `move`, but the moment
a marble **crosses into its finish lane** gets its own `'laneEntry'` cue — the
audible twin of the existing lane-entry animation.

- **Same trigger as the animation.** Detection reuses `laneEntries(before, after)`
  from `apps/web/src/laneFx.ts` (the pure before/after diff the animation's
  `useLaneEntryFx` already uses), NOT the `Move.enterLane` flag. So the cue fires
  exactly when the animation fires — move-type-agnostic and seat-agnostic. A move
  *within* the lane (already `finish` before and after) does not re-trigger, so
  only the entry itself sounds ("première entrée").
- **New `SoundId: 'laneEntry'`**, pool `['lane-entry-1']`, volume 0.7 — a marked
  "home-stretch" beat.
- **Mapping in `soundForMove`:**
  - a plain `move` that enters the lane → `'laneEntry'` **instead of** `'move'`;
  - a `split7` whose part enters the lane → `'split7'` **plus** a layered
    `'laneEntry'` (decided: fully consistent with the animation, which also fires
    on a 7-split entry);
  - a classic displacement or a within-lane advance → `'move'` unchanged;
  - `capture` / `win` accents keep layering as before.
- Assets remain placeholder slots (`lane-entry-1`).

---

## Correction (2026-07-29) — mp3-only formats + per-screen mute placement

Two fixes from real in-browser testing (`pnpm dev`):

**1. Audio was silent — root cause: format fallback assumption was wrong.**
The base design shipped each clip as `.webm` + `.mp3`, expecting Howler to fall
back to mp3 if webm was absent. It does not: Howler picks a source by *codec
support* (Chrome supports webm/opus), not by file existence, and does not retry
on a load error. With only `.mp3` files present, Chrome requested the missing
`.webm`; the Vite dev server's SPA fallback answered `200 text/html` (index.html),
Howler tried to decode HTML as audio and failed → total silence, music included.
**Fix:** `AUDIO_FORMATS = ['mp3']` (universally supported: Chrome/Firefox/Safari/
iOS). Single format, no fallback trap. `sourcesFor` and the README/manifest are
updated; the webm size optimisation is dropped as not worth the footgun.

**2. Mute button placement.** The off-game mute button was an `App`-level
`position: fixed` sibling rendered outside `ScreenTransition`, so it appeared to
"wander" across screen crossfades. **Fix:** each off-game screen now renders its
own `<MuteButton />` inside its own chrome so it transitions with the screen —
on **Setup** beside the rules button (top-right cluster, as requested), and
top-right on **Home** and **GameOver**. `MuteButton` still self-nulls when audio
is gated off, so screens stay audio-agnostic.

**Asset note:** the supplied `music-loop.mp3` is ~5.7 MB, above the SW precache
cap (`maximumFileSizeToCacheInBytes: 4 MB`). Dev playback is unaffected; for the
production PWA it should be compressed (a seamless loop can be well under 1 MB)
or the cap raised — compression is recommended over precaching a 5.7 MB file.

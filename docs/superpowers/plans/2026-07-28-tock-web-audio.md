# Tock Web Audio (SFX + Music) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `apps/web` per-action sound effects (with capture/win/draw accents) over a looping music bed, muteable and persisted, active only when the app runs as the installed PWA.

**Architecture:** A new `apps/web/src/audio/` module. A pure mapping (`soundForMove`) turns a committed move into `SoundId[]`; a Howler-backed `AudioEngine` behind a swappable interface plays them (random clip from a per-sound pool via an injected RNG); an `AudioProvider` owns the install gate, first-gesture unlock, mute persistence, and tab-visibility pausing, exposing a stable `play`. Audio is wired at the single existing choke point, `App.commitAndPass`. `@tock/core` is untouched.

**Tech Stack:** TypeScript (strict), React 19, Vite, Vitest + jsdom + @testing-library/react, Howler.js, vite-plugin-pwa (workbox).

## Global Constraints

- **Node:** the Bash tool inherits Node 18; prefix every `pnpm`/`node` command with `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; ` (project needs Node ≥ 22).
- **Package boundary:** changes are `apps/web`-only. Do **not** touch `@tock/core` (`packages/core`).
- **Code style:** no semicolons, no trailing commas, no `function` keyword (const arrow functions only), **no non-null `!` in production code** (tests may use it), English identifiers/comments, camelCase non-plural names, ESLint max-warnings 0.
- **Audio install gate:** audio is enabled only when `isStandalone() || import.meta.env.DEV || ?audio` is present. A plain browser tab stays silent by design.
- **Audio formats:** every clip ships `.webm` + `.mp3`; iOS Safari is the binding constraint.
- **Reduced motion is NOT coupled to sound** — `prefers-reduced-motion` governs animation only.
- **Commit after every task.** Tests live flat in `apps/web/tests/` (Vitest `include` is `tests/**/*.test.{ts,tsx}`).
- **Spec:** `docs/superpowers/specs/2026-07-28-tock-web-audio-design.md`. Validated icon mockup: `docs/superpowers/mockups/2026-07-28-mute-icon.html`.

## File Structure

**Created (source):**
- `apps/web/src/audio/gameEvents.ts` — `capturedColorList` (extracted from `format.ts`), the shared capture-detection source of truth.
- `apps/web/src/audio/sounds.ts` — `SoundId`, `soundManifest`, `AUDIO_FORMATS`, `musicTrack`, `AUDIO_BASE`, pure `pickSample`.
- `apps/web/src/audio/soundForMove.ts` — pure `soundForMove` + `soundsForCommit` (adds the human-only `draw`).
- `apps/web/src/audio/enabled.ts` — pure `computeAudioEnabled` + `audioForced`.
- `apps/web/src/audio/AudioEngine.ts` — Howler wrapper: `AudioEngine` type, pure `sourcesFor`, `createAudioEngine`.
- `apps/web/src/audio/AudioProvider.tsx` — provider: gate, unlock, persistence, visibility, `play`.
- `apps/web/src/audio/useAudio.ts` — the `useAudio` hook (inert default when no provider).
- `apps/web/src/components/MuteButton.tsx` — button + inline `SpeakerIcon` (speaker + slash).
- `apps/web/public/audio/README.md` — the expected clip filenames (asset slots).

**Created (tests + helper):**
- `apps/web/tests/audioFake.ts` — `createFakeEngine()` test double.
- `apps/web/tests/gameEvents.test.ts`, `sounds.test.ts`, `soundForMove.test.ts`, `audioEnabled.test.ts`, `audioEngine.test.ts`, `audioProvider.test.tsx`, `muteButton.test.tsx`, `audioWiring.test.tsx`.

**Modified:**
- `apps/web/src/format.ts` — import `capturedColorList` from `./audio/gameEvents`.
- `apps/web/tests/setup.ts` — global `howler` mock.
- `apps/web/src/main.tsx` — wrap `<App/>` in `<AudioProvider>`.
- `apps/web/src/components/App.tsx` — wire `play` in `commitAndPass`; render the off-game fixed `MuteButton`.
- `apps/web/src/components/StatusBar.tsx` — add `<MuteButton />` to the cluster.
- `apps/web/vite.config.ts` — precache audio globs + max file size.
- `apps/web/package.json` — add `howler` + `@types/howler`.

**Reused (imported, not modified):** `apps/web/src/pwa/platform.ts` (`isStandalone`).

---

### Task 1: Extract `capturedColorList` into `audio/gameEvents.ts`

Pure refactor: move the private capture-diff out of `format.ts` so `soundForMove` and `moveLabel` share one source of truth. No behaviour change.

**Files:**
- Create: `apps/web/src/audio/gameEvents.ts`
- Modify: `apps/web/src/format.ts` (remove local `capturedColorList`, import it)
- Test: `apps/web/tests/gameEvents.test.ts`

**Interfaces:**
- Produces: `capturedColorList(before: GameState, after: GameState): Color[]`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/gameEvents.test.ts
import { describe, expect, it } from 'vitest'
import type { GameState } from '@tock/core'
import { colorOf } from '@tock/core'
import { capturedColorList } from '../src/audio/gameEvents'

describe('capturedColorList', () => {
  it('lists the colour of a marble that went from off-home to home', () => {
    const before = { marbleList: [{ id: 'p1-0', owner: 1, position: { zone: 'ring' } }] } as unknown as GameState
    const after = { marbleList: [{ id: 'p1-0', owner: 1, position: { zone: 'home' } }] } as unknown as GameState
    expect(capturedColorList(before, after)).toEqual([colorOf(1)])
  })

  it('is empty when nothing returned home', () => {
    const before = { marbleList: [{ id: 'p1-0', owner: 1, position: { zone: 'ring' } }] } as unknown as GameState
    const after = { marbleList: [{ id: 'p1-0', owner: 1, position: { zone: 'ring' } }] } as unknown as GameState
    expect(capturedColorList(before, after)).toEqual([])
  })

  it('ignores marbles already home before the move', () => {
    const before = { marbleList: [{ id: 'p2-0', owner: 2, position: { zone: 'home' } }] } as unknown as GameState
    const after = { marbleList: [{ id: 'p2-0', owner: 2, position: { zone: 'home' } }] } as unknown as GameState
    expect(capturedColorList(before, after)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/gameEvents.test.ts`
Expected: FAIL — cannot resolve `../src/audio/gameEvents`.

- [ ] **Step 3: Create `gameEvents.ts` with the extracted function**

```ts
// apps/web/src/audio/gameEvents.ts
import type { Color, GameState } from '@tock/core'
import { colorOf } from '@tock/core'

// A capture is any marble that was off its home nest before the move and is back
// home after — true for a plain move, a 7-split, an exit, and the push (which can
// even send a third player's or the mover's own marble home). Detected by diffing
// states, so it is agnostic to move type.
export const capturedColorList = (before: GameState, after: GameState): Color[] => {
  const result: Color[] = []
  for (const marble of before.marbleList) {
    if (marble.position.zone === 'home') continue
    const post = after.marbleList.find(candidate => candidate.id === marble.id)
    if (post && post.position.zone === 'home') result.push(colorOf(marble.owner))
  }
  return result
}
```

- [ ] **Step 4: Rewire `format.ts` to import it**

In `apps/web/src/format.ts`, delete the local `capturedColorList` definition (the `const capturedColorList = (before, after) => {...}` block) and add the import near the top, after the existing `@tock/core` import:

```ts
import { capturedColorList } from './audio/gameEvents'
```

Leave `moveLabel` unchanged — it already calls `capturedColorList(before, after)`.

- [ ] **Step 5: Run the audio test and the full web suite**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/gameEvents.test.ts`
Expected: PASS.

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test`
Expected: PASS (existing log/format tests still green — behaviour unchanged).

- [ ] **Step 6: Typecheck + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web typecheck
git add apps/web/src/audio/gameEvents.ts apps/web/src/format.ts apps/web/tests/gameEvents.test.ts
git commit -m "refactor(web): extract capturedColorList into audio/gameEvents"
```

---

### Task 2: Sound catalogue — `audio/sounds.ts`

The manifest (data), the pure pool-picker, and the asset-slot README.

**Files:**
- Create: `apps/web/src/audio/sounds.ts`
- Create: `apps/web/public/audio/README.md`
- Test: `apps/web/tests/sounds.test.ts`

**Interfaces:**
- Produces:
  - `type SoundId = 'exit' | 'move' | 'push' | 'swap' | 'split7' | 'discard' | 'capture' | 'win' | 'draw'`
  - `soundManifest: Record<SoundId, { pool: string[]; volume: number }>`
  - `AUDIO_FORMATS: readonly ['webm', 'mp3']`
  - `musicTrack: { name: string; volume: number }`
  - `AUDIO_BASE: string`
  - `pickSample(pool: string[], random: () => number): string`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/sounds.test.ts
import { describe, expect, it } from 'vitest'
import { pickSample, soundManifest, type SoundId } from '../src/audio/sounds'

describe('pickSample', () => {
  it('picks by index = floor(random * length)', () => {
    expect(pickSample(['a', 'b', 'c'], () => 0)).toBe('a')
    expect(pickSample(['a', 'b', 'c'], () => 0.5)).toBe('b')
  })

  it('clamps when random returns 1', () => {
    expect(pickSample(['a', 'b', 'c'], () => 0.999999)).toBe('c')
  })

  it('throws on an empty pool', () => {
    expect(() => pickSample([], () => 0)).toThrow()
  })
})

describe('soundManifest', () => {
  it('gives every SoundId a non-empty pool', () => {
    ;(Object.keys(soundManifest) as SoundId[]).forEach(id => {
      expect(soundManifest[id].pool.length).toBeGreaterThan(0)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/sounds.test.ts`
Expected: FAIL — cannot resolve `../src/audio/sounds`.

- [ ] **Step 3: Create `sounds.ts`**

```ts
// apps/web/src/audio/sounds.ts
export type SoundId =
  | 'exit' | 'move' | 'push' | 'swap' | 'split7' | 'discard'
  | 'capture' | 'win'
  | 'draw'

// `pool` = distinct clip variants for one SoundId (variety, picked at random).
// AUDIO_FORMATS = codec fallbacks for a single clip (Safari/Chrome coverage).
export const soundManifest: Record<SoundId, { pool: string[]; volume: number }> = {
  exit: { pool: ['exit-1', 'exit-2'], volume: 0.6 },
  move: { pool: ['move-1', 'move-2', 'move-3'], volume: 0.5 },
  push: { pool: ['push-1', 'push-2'], volume: 0.7 },
  swap: { pool: ['swap-1'], volume: 0.6 },
  split7: { pool: ['split7-1'], volume: 0.6 },
  discard: { pool: ['discard-1', 'discard-2'], volume: 0.45 },
  capture: { pool: ['capture-1', 'capture-2'], volume: 0.85 },
  win: { pool: ['win-1'], volume: 0.9 },
  draw: { pool: ['draw-1', 'draw-2'], volume: 0.4 }
}

export const AUDIO_FORMATS = ['webm', 'mp3'] as const
export const musicTrack = { name: 'music-loop', volume: 0.35 }
export const AUDIO_BASE = 'audio'

// Pick one clip base name from the pool. Injected RNG (default Math.random) keeps
// it testable, mirroring pickMove in @tock/core. Clamps in case random() === 1.
export const pickSample = (pool: string[], random: () => number): string => {
  const first = pool[0]
  if (first === undefined) throw new Error('empty sound pool')
  const index = Math.min(Math.floor(random() * pool.length), pool.length - 1)
  return pool[index] ?? first
}
```

- [ ] **Step 4: Create the asset-slot README**

```markdown
<!-- apps/web/public/audio/README.md -->
# Audio assets

Each clip must be provided as **both** `.webm` and `.mp3` (iOS Safari needs mp3).
Filenames are the pool entries in `src/audio/sounds.ts`:

exit-1, exit-2, move-1, move-2, move-3, push-1, push-2, swap-1, split7-1,
discard-1, discard-2, capture-1, capture-2, win-1, draw-1, draw-2

Plus the looping bed: `music-loop.webm` / `music-loop.mp3`.

Until real clips land here the engine swallows load errors and stays silent;
sourcing royalty-free finals is a separate task.
```

- [ ] **Step 5: Run the test**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/sounds.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web typecheck
git add apps/web/src/audio/sounds.ts apps/web/public/audio/README.md apps/web/tests/sounds.test.ts
git commit -m "feat(web): audio sound manifest + variety pool picker"
```

---

### Task 3: Move → sounds mapping — `audio/soundForMove.ts`

**Files:**
- Create: `apps/web/src/audio/soundForMove.ts`
- Test: `apps/web/tests/soundForMove.test.ts`

**Interfaces:**
- Consumes: `SoundId` (Task 2), `capturedColorList` (Task 1)
- Produces:
  - `soundForMove(before: GameState, after: GameState, move: Move): SoundId[]`
  - `soundsForCommit(before: GameState, after: GameState, move: Move, moverIsHuman: boolean): SoundId[]`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/soundForMove.test.ts
import { describe, expect, it } from 'vitest'
import type { GameState, Move } from '@tock/core'
import { soundForMove, soundsForCommit } from '../src/audio/soundForMove'

const empty = { marbleList: [], winner: null } as unknown as GameState

describe('soundForMove', () => {
  it('maps a move type to its SoundId', () => {
    expect(soundForMove(empty, empty, { type: 'exit' } as Move)).toEqual(['exit'])
    expect(soundForMove(empty, empty, { type: 'push' } as Move)).toEqual(['push'])
  })

  it('appends capture when a marble returned home', () => {
    const before = { marbleList: [{ id: 'p1-0', owner: 1, position: { zone: 'ring' } }], winner: null } as unknown as GameState
    const after = { marbleList: [{ id: 'p1-0', owner: 1, position: { zone: 'home' } }], winner: null } as unknown as GameState
    expect(soundForMove(before, after, { type: 'move' } as Move)).toEqual(['move', 'capture'])
  })

  it('appends win when the game is won', () => {
    const after = { marbleList: [], winner: 0 } as unknown as GameState
    expect(soundForMove(empty, after, { type: 'move' } as Move)).toEqual(['move', 'win'])
  })
})

describe('soundsForCommit', () => {
  it('adds draw when the mover is human', () => {
    expect(soundsForCommit(empty, empty, { type: 'move' } as Move, true)).toEqual(['move', 'draw'])
  })

  it('omits draw when the mover is a bot', () => {
    expect(soundsForCommit(empty, empty, { type: 'move' } as Move, false)).toEqual(['move'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/soundForMove.test.ts`
Expected: FAIL — cannot resolve `../src/audio/soundForMove`.

- [ ] **Step 3: Create `soundForMove.ts`**

```ts
// apps/web/src/audio/soundForMove.ts
import type { GameState, Move } from '@tock/core'
import { capturedColorList } from './gameEvents'
import type { SoundId } from './sounds'

// The Move union member names double as SoundIds, so move.type maps directly.
// Multiple ids are the superposition case (e.g. ['move','capture']) — the engine
// plays them concurrently.
export const soundForMove = (before: GameState, after: GameState, move: Move): SoundId[] => {
  const list: SoundId[] = [move.type]
  if (capturedColorList(before, after).length > 0) list.push('capture')
  if (after.winner !== null) list.push('win')
  return list
}

// The full set for one committed move: move sounds + accents, plus the soft draw
// cue when a human drew the fresh card (continuous draw). Gated here rather than
// in soundForMove because seat-humanity is a UI concern, not move semantics.
export const soundsForCommit = (before: GameState, after: GameState, move: Move, moverIsHuman: boolean): SoundId[] => {
  const list = soundForMove(before, after, move)
  if (moverIsHuman) list.push('draw')
  return list
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/soundForMove.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web typecheck
git add apps/web/src/audio/soundForMove.ts apps/web/tests/soundForMove.test.ts
git commit -m "feat(web): map committed moves to sound ids"
```

---

### Task 4: Install-gate predicate — `audio/enabled.ts`

**Files:**
- Create: `apps/web/src/audio/enabled.ts`
- Test: `apps/web/tests/audioEnabled.test.ts`

**Interfaces:**
- Produces:
  - `computeAudioEnabled(input: { standalone: boolean; dev: boolean; forced: boolean }): boolean`
  - `audioForced(): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/audioEnabled.test.ts
import { describe, expect, it } from 'vitest'
import { computeAudioEnabled } from '../src/audio/enabled'

describe('computeAudioEnabled', () => {
  it('is false in a plain browser tab', () => {
    expect(computeAudioEnabled({ standalone: false, dev: false, forced: false })).toBe(false)
  })

  it('is true when standalone (installed app)', () => {
    expect(computeAudioEnabled({ standalone: true, dev: false, forced: false })).toBe(true)
  })

  it('is true under dev or the ?audio override', () => {
    expect(computeAudioEnabled({ standalone: false, dev: true, forced: false })).toBe(true)
    expect(computeAudioEnabled({ standalone: false, dev: false, forced: true })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/audioEnabled.test.ts`
Expected: FAIL — cannot resolve `../src/audio/enabled`.

- [ ] **Step 3: Create `enabled.ts`**

```ts
// apps/web/src/audio/enabled.ts
// Audio runs only as the installed PWA (standalone), with a dev/QA escape hatch.
// Pure so the gate logic is testable without stubbing import.meta or the URL.
export const computeAudioEnabled = (input: { standalone: boolean; dev: boolean; forced: boolean }): boolean =>
  input.standalone || input.dev || input.forced

export const audioForced = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).has('audio')
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/audioEnabled.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web typecheck
git add apps/web/src/audio/enabled.ts apps/web/tests/audioEnabled.test.ts
git commit -m "feat(web): pure install-gate predicate for audio"
```

---

### Task 5: Howler engine — `audio/AudioEngine.ts`

Adds the `howler` dependency, a global test mock so jsdom never touches a real `AudioContext`, and the engine behind a swappable interface. Only the pure `sourcesFor` is unit-tested; the Howler glue is exercised through the provider/wiring tests via the injected fake.

**Files:**
- Modify: `apps/web/package.json` (add `howler`, `@types/howler`)
- Modify: `apps/web/tests/setup.ts` (global `howler` mock)
- Create: `apps/web/src/audio/AudioEngine.ts`
- Test: `apps/web/tests/audioEngine.test.ts`

**Interfaces:**
- Consumes: `soundManifest`, `musicTrack`, `AUDIO_FORMATS`, `AUDIO_BASE`, `pickSample`, `SoundId` (Task 2)
- Produces:
  - `type AudioEngine = { unlock: () => void; play: (id: SoundId) => void; startMusic: () => void; stopMusic: () => void; pauseMusic: () => void; resumeMusic: () => void; setMuted: (muted: boolean) => void }`
  - `sourcesFor(name: string, root: string): string[]`
  - `createAudioEngine(random?: () => number): AudioEngine`

- [ ] **Step 1: Add the dependency**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web add howler && pnpm --filter @tock/web add -D @types/howler`

- [ ] **Step 2: Add a global `howler` mock to `tests/setup.ts`**

Append to `apps/web/tests/setup.ts` (needs `vi`, imported from vitest):

```ts
import { vi } from 'vitest'

// jsdom has no Web Audio; mock Howler so importing AudioEngine (and any real
// createAudioEngine path) never constructs an AudioContext under test. Component
// tests inject a fake engine and never hit this, but the module still imports it.
vi.mock('howler', () => {
  class Howl {
    play() { return 0 }
    stop() {}
    pause() {}
    playing() { return false }
  }
  const Howler = { mute: () => {}, ctx: { resume: () => {} } }
  return { Howl, Howler }
})
```

- [ ] **Step 3: Write the failing test**

```ts
// apps/web/tests/audioEngine.test.ts
import { describe, expect, it } from 'vitest'
import { sourcesFor } from '../src/audio/AudioEngine'

describe('sourcesFor', () => {
  it('builds a webm+mp3 fallback list under the given root', () => {
    expect(sourcesFor('move-1', '/tock/audio')).toEqual(['/tock/audio/move-1.webm', '/tock/audio/move-1.mp3'])
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/audioEngine.test.ts`
Expected: FAIL — cannot resolve `../src/audio/AudioEngine`.

- [ ] **Step 5: Create `AudioEngine.ts`**

```ts
// apps/web/src/audio/AudioEngine.ts
import { Howl, Howler } from 'howler'
import { AUDIO_BASE, AUDIO_FORMATS, musicTrack, pickSample, soundManifest, type SoundId } from './sounds'

export type AudioEngine = {
  unlock: () => void
  play: (id: SoundId) => void
  startMusic: () => void
  stopMusic: () => void
  pauseMusic: () => void
  resumeMusic: () => void
  setMuted: (muted: boolean) => void
}

// Codec fallbacks for one clip; Howler picks the first the browser can play.
export const sourcesFor = (name: string, root: string): string[] =>
  AUDIO_FORMATS.map(format => `${root}/${name}.${format}`)

export const createAudioEngine = (random: () => number = Math.random): AudioEngine => {
  const root = `${import.meta.env.BASE_URL}${AUDIO_BASE}`
  const howlCache = new Map<string, Howl>()
  const howlFor = (name: string, volume: number): Howl => {
    const cached = howlCache.get(name)
    if (cached) return cached
    const howl = new Howl({ src: sourcesFor(name, root), volume })
    howlCache.set(name, howl)
    return howl
  }
  let music: Howl | null = null
  const ensureMusic = (): Howl => {
    if (!music) music = new Howl({ src: sourcesFor(musicTrack.name, root), volume: musicTrack.volume, loop: true })
    return music
  }
  return {
    unlock: () => { Howler.ctx?.resume?.() },
    play: id => {
      const entry = soundManifest[id]
      howlFor(pickSample(entry.pool, random), entry.volume).play()
    },
    startMusic: () => { const track = ensureMusic(); if (!track.playing()) track.play() },
    stopMusic: () => { music?.stop() },
    pauseMusic: () => { music?.pause() },
    resumeMusic: () => { const track = ensureMusic(); if (!track.playing()) track.play() },
    setMuted: muted => { Howler.mute(muted) }
  }
}
```

- [ ] **Step 6: Run test + full suite**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/audioEngine.test.ts`
Expected: PASS.

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test`
Expected: PASS (the new `howler` mock does not disturb existing tests).

- [ ] **Step 7: Typecheck + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web typecheck
git add apps/web/package.json apps/web/pnpm-lock.yaml ../../pnpm-lock.yaml apps/web/tests/setup.ts apps/web/src/audio/AudioEngine.ts apps/web/tests/audioEngine.test.ts
git commit -m "feat(web): howler-backed audio engine behind a swappable interface"
```

> Note: the lockfile lives at the repo root (`pnpm-lock.yaml`); `git add -A` from the root is a simpler alternative if the relative path above does not resolve.

---

### Task 6: Provider + hook — `audio/AudioProvider.tsx`, `audio/useAudio.ts`

The React layer: install gate, first-gesture unlock, mute persistence, tab-visibility pausing, a stable `play`. `useAudio` returns an inert default when no provider is mounted, so components (and existing App tests) work unwrapped.

**Files:**
- Create: `apps/web/tests/audioFake.ts`
- Create: `apps/web/src/audio/AudioProvider.tsx`
- Create: `apps/web/src/audio/useAudio.ts`
- Test: `apps/web/tests/audioProvider.test.tsx`

**Interfaces:**
- Consumes: `AudioEngine`, `createAudioEngine` (Task 5), `computeAudioEnabled`, `audioForced` (Task 4), `isStandalone` (`pwa/platform.ts`), `SoundId` (Task 2)
- Produces:
  - `type AudioContextValue = { audioEnabled: boolean; muted: boolean; toggleMuted: () => void; play: (id: SoundId) => void }`
  - `AudioCtx` (React context, default `null`)
  - `AudioProvider(props: { children: ReactNode; engine?: AudioEngine; enabled?: boolean })`
  - `useAudio(): AudioContextValue`
  - Test helper: `createFakeEngine(): FakeEngine`

- [ ] **Step 1: Create the fake-engine test helper**

```ts
// apps/web/tests/audioFake.ts
import type { AudioEngine } from '../src/audio/AudioEngine'
import type { SoundId } from '../src/audio/sounds'

export type FakeEngine = AudioEngine & {
  played: SoundId[]
  unlockCount: number
  musicStarted: number
  pauseCount: number
  resumeCount: number
  muted: boolean | null
}

export const createFakeEngine = (): FakeEngine => {
  const fake: FakeEngine = {
    played: [],
    unlockCount: 0,
    musicStarted: 0,
    pauseCount: 0,
    resumeCount: 0,
    muted: null,
    unlock: () => { fake.unlockCount++ },
    play: (id: SoundId) => { fake.played.push(id) },
    startMusic: () => { fake.musicStarted++ },
    stopMusic: () => {},
    pauseMusic: () => { fake.pauseCount++ },
    resumeMusic: () => { fake.resumeCount++ },
    setMuted: (value: boolean) => { fake.muted = value }
  }
  return fake
}
```

- [ ] **Step 2: Write the failing provider tests**

```tsx
// apps/web/tests/audioProvider.test.tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AudioProvider } from '../src/audio/AudioProvider'
import { useAudio } from '../src/audio/useAudio'
import { createFakeEngine } from './audioFake'

const Probe = () => {
  const { audioEnabled, play } = useAudio()
  return <button data-enabled={audioEnabled} onClick={() => play('move')}>go</button>
}

afterEach(() => { localStorage.clear() })

describe('AudioProvider — gated off (browser tab)', () => {
  it('does not unlock, play, or report enabled', async () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled={false}><Probe /></AudioProvider>)
    act(() => { window.dispatchEvent(new Event('pointerdown')) })
    await userEvent.click(screen.getByText('go'))
    expect(fake.unlockCount).toBe(0)
    expect(fake.played).toEqual([])
    expect(screen.getByText('go').dataset.enabled).toBe('false')
  })
})

describe('AudioProvider — gated on', () => {
  it('unlocks and starts music on the first pointerdown', () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><Probe /></AudioProvider>)
    act(() => { window.dispatchEvent(new Event('pointerdown')) })
    expect(fake.unlockCount).toBe(1)
    expect(fake.musicStarted).toBe(1)
  })

  it('routes play to the engine', async () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><Probe /></AudioProvider>)
    await userEvent.click(screen.getByText('go'))
    expect(fake.played).toContain('move')
  })

  it('applies a persisted mute on mount', () => {
    localStorage.setItem('tock.muted', 'true')
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><Probe /></AudioProvider>)
    expect(fake.muted).toBe(true)
  })

  it('pauses music when the tab is hidden', () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><Probe /></AudioProvider>)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(fake.pauseCount).toBe(1)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/audioProvider.test.tsx`
Expected: FAIL — cannot resolve `../src/audio/AudioProvider`.

- [ ] **Step 4: Create `AudioProvider.tsx`**

```tsx
// apps/web/src/audio/AudioProvider.tsx
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { isStandalone } from '../pwa/platform'
import { createAudioEngine, type AudioEngine } from './AudioEngine'
import { audioForced, computeAudioEnabled } from './enabled'
import type { SoundId } from './sounds'

export type AudioContextValue = {
  audioEnabled: boolean
  muted: boolean
  toggleMuted: () => void
  play: (id: SoundId) => void
}

export const AudioCtx = createContext<AudioContextValue | null>(null)

const MUTE_KEY = 'tock.muted'
const readMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true'
  } catch {
    return false
  }
}

type Props = { children: ReactNode; engine?: AudioEngine; enabled?: boolean }

export const AudioProvider = ({ children, engine, enabled }: Props) => {
  const audioEnabled = enabled ?? computeAudioEnabled({
    standalone: isStandalone(),
    dev: import.meta.env.DEV,
    forced: audioForced()
  })
  const engineRef = useRef<AudioEngine | null>(null)
  if (audioEnabled && !engineRef.current) engineRef.current = engine ?? createAudioEngine()

  const [muted, setMuted] = useState(readMuted)

  useEffect(() => {
    if (audioEnabled) engineRef.current?.setMuted(muted)
  }, [audioEnabled, muted])

  useEffect(() => {
    if (!audioEnabled) return
    const onFirst = () => {
      engineRef.current?.unlock()
      if (!readMuted()) engineRef.current?.startMusic()
    }
    window.addEventListener('pointerdown', onFirst, { once: true })
    return () => window.removeEventListener('pointerdown', onFirst)
  }, [audioEnabled])

  useEffect(() => {
    if (!audioEnabled) return
    const onVisibility = () => {
      if (document.hidden) engineRef.current?.pauseMusic()
      else if (!muted) engineRef.current?.resumeMusic()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [audioEnabled, muted])

  // Stable across renders (reads the ref) so App.commitAndPass keeps its
  // state-keyed identity and useBotAutoplay does not re-arm every render.
  const play = useCallback((id: SoundId) => { engineRef.current?.play(id) }, [])

  const toggleMuted = useCallback(() => {
    setMuted(previous => {
      const next = !previous
      try { localStorage.setItem(MUTE_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ audioEnabled, muted, toggleMuted, play }),
    [audioEnabled, muted, toggleMuted, play]
  )
  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>
}
```

- [ ] **Step 5: Create `useAudio.ts` (inert default when unwrapped)**

```ts
// apps/web/src/audio/useAudio.ts
import { useContext } from 'react'
import { AudioCtx, type AudioContextValue } from './AudioProvider'

// Inert fallback so components (and tests) render without a provider: audio off,
// play is a no-op. Production wraps App in AudioProvider (see main.tsx).
const INERT: AudioContextValue = {
  audioEnabled: false,
  muted: false,
  toggleMuted: () => {},
  play: () => {}
}

export const useAudio = (): AudioContextValue => useContext(AudioCtx) ?? INERT
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/audioProvider.test.tsx`
Expected: PASS (all five cases).

- [ ] **Step 7: Typecheck + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web typecheck
git add apps/web/src/audio/AudioProvider.tsx apps/web/src/audio/useAudio.ts apps/web/tests/audioFake.ts apps/web/tests/audioProvider.test.tsx
git commit -m "feat(web): audio provider — gate, unlock, mute persistence, visibility"
```

---

### Task 7: Mute button + speaker icon — `components/MuteButton.tsx`

**Files:**
- Create: `apps/web/src/components/MuteButton.tsx`
- Test: `apps/web/tests/muteButton.test.tsx`

**Interfaces:**
- Consumes: `useAudio` (Task 6), `theme` (`../theme`)
- Produces: `MuteButton` (default export style: named `export const MuteButton`)

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/tests/muteButton.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AudioProvider } from '../src/audio/AudioProvider'
import { MuteButton } from '../src/components/MuteButton'
import { createFakeEngine } from './audioFake'

afterEach(() => { localStorage.clear() })

describe('MuteButton', () => {
  it('renders nothing when audio is gated off', () => {
    render(<AudioProvider engine={createFakeEngine()} enabled={false}><MuteButton /></AudioProvider>)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('toggles mute, aria-pressed, and persists the choice', async () => {
    render(<AudioProvider engine={createFakeEngine()} enabled><MuteButton /></AudioProvider>)
    const button = screen.getByRole('button', { name: /couper le son/i })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(screen.getByRole('button', { name: /activer le son/i })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('tock.muted')).toBe('true')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/muteButton.test.tsx`
Expected: FAIL — cannot resolve `../src/components/MuteButton`.

- [ ] **Step 3: Create `MuteButton.tsx`**

```tsx
// apps/web/src/components/MuteButton.tsx
import { theme } from '../theme'
import { useAudio } from '../audio/useAudio'

// Socket style shared with RulesButton so the pair reads as one control cluster.
const iconStyle = {
  width: 22, height: 22, borderRadius: '50%', flex: 'none',
  border: '1px solid rgba(255,216,115,.35)', background: 'rgba(0,0,0,.25)',
  color: theme.gold, cursor: 'pointer', padding: 4,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
} as const

const SpeakerIcon = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
    <path d="M4 9H7.6L12 5V19L7.6 15H4Z" fill="currentColor" />
    {!muted && (
      <>
        <path d="M15 9.4Q17.3 12 15 14.6" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
        <path d="M17.2 7.3Q20.7 12 17.2 16.7" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      </>
    )}
    {muted && (
      <>
        <line x1="4.5" y1="4" x2="19.5" y2="20" stroke={theme.socketDark} strokeWidth={4} strokeLinecap="round" />
        <line x1="4.5" y1="4" x2="19.5" y2="20" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" />
      </>
    )}
  </svg>
)

export const MuteButton = () => {
  const { audioEnabled, muted, toggleMuted } = useAudio()
  if (!audioEnabled) return null
  return (
    <button
      type="button"
      aria-label={muted ? 'Activer le son' : 'Couper le son'}
      aria-pressed={muted}
      onClick={toggleMuted}
      style={iconStyle}
    >
      <SpeakerIcon muted={muted} />
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/muteButton.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web typecheck
git add apps/web/src/components/MuteButton.tsx apps/web/tests/muteButton.test.tsx
git commit -m "feat(web): mute button with speaker/slash icon"
```

---

### Task 8: Wire audio into the app — `main.tsx`, `App.tsx`, `StatusBar.tsx`

Mount the provider, fire sounds at the single choke point (`commitAndPass`), and place the mute button (StatusBar in game; fixed top-right elsewhere).

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/components/App.tsx`
- Modify: `apps/web/src/components/StatusBar.tsx`
- Test: `apps/web/tests/audioWiring.test.tsx`

**Interfaces:**
- Consumes: `AudioProvider` (Task 6), `useAudio` (Task 6), `soundsForCommit` (Task 3), `MuteButton` (Task 7), `safeTop` (`../layout`)

- [ ] **Step 1: Write the failing wiring test**

```tsx
// apps/web/tests/audioWiring.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/components/App'
import { AudioProvider } from '../src/audio/AudioProvider'
import { createFakeEngine } from './audioFake'

// Math.random = 0 => seat 0 hand [A,2,3,4,5] of clubs; the four Ace exits are the
// only legal moves. Tap the Ace, then the first ghost, to commit an exit as a
// human — soundsForCommit should fire ['exit', 'draw'] (no capture at game start).
describe('audio wiring', () => {
  beforeEach(() => { vi.spyOn(Math, 'random').mockReturnValue(0) })
  afterEach(() => { vi.restoreAllMocks() })

  it('plays the move + draw sounds when a human commits a move', async () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><App /></AudioProvider>)

    await userEvent.click(screen.getByRole('button', { name: /nouvelle partie/i }))
    const seat1 = await screen.findByTestId('seat-1')
    await userEvent.click(within(seat1).getByRole('button', { name: 'humain' }))
    await userEvent.click(screen.getByRole('button', { name: /lancer la partie/i }))

    expect(await screen.findByLabelText('board')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('card-A-clubs'))
    const ghostList = screen.getAllByLabelText(/^ghost-/)
    await userEvent.click(ghostList[0] as HTMLElement)

    expect(fake.played).toContain('exit')
    expect(fake.played).toContain('draw')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/audioWiring.test.tsx`
Expected: FAIL — `fake.played` is empty (App does not call `play` yet).

- [ ] **Step 3: Wrap the app in the provider — `main.tsx`**

Modify `apps/web/src/main.tsx`: import the provider and wrap `<App />`.

```tsx
import { AudioProvider } from './audio/AudioProvider'
// ...existing imports...

const root = document.getElementById('root')
if (root) createRoot(root).render(
  <StrictMode>
    <AudioProvider>
      <App />
    </AudioProvider>
  </StrictMode>
)
```

- [ ] **Step 4: Fire sounds in `commitAndPass` — `App.tsx`**

In `apps/web/src/components/App.tsx`:

Add imports:
```tsx
import { useAudio } from '../audio/useAudio'
import { soundsForCommit } from '../audio/soundForMove'
import { MuteButton } from './MuteButton'
import { safeTop } from '../layout'
```

Inside `App`, read `play` from the hook (near the other hooks):
```tsx
const { play } = useAudio()
```

Replace `commitAndPass` with the sound-firing version:
```tsx
const commitAndPass = useCallback((move: Move) => {
  if (!state) return
  const before = state
  const previous = before.currentPlayer
  commitMove(move)
  const next = applyMove(before, move)
  soundsForCommit(before, next, move, humanIdList.includes(previous)).forEach(id => play(id))
  if (needsHandoff(previous, next, humanSeatIds(next))) setAwaitingHandoff(true)
}, [state, humanIdList, commitMove, play])
```

Render a fixed top-right `MuteButton` on the non-game screens, as a sibling in the returned fragment (it self-nulls when audio is gated off):
```tsx
return (
  <>
    <ScreenTransition screenKey={screen.key} cover={screen.cover}>{screen.node}</ScreenTransition>
    {(screen.key === 'home' || screen.key === 'setup' || screen.key === 'over') && (
      <div style={{ position: 'fixed', top: safeTop(10), right: 12, zIndex: 30 }}>
        <MuteButton />
      </div>
    )}
    <RulesOverlay open={rulesOpen} onClose={() => setRulesOpen(false)} />
    <UpdateBanner />
  </>
)
```

- [ ] **Step 5: Add the in-game mute button — `StatusBar.tsx`**

In `apps/web/src/components/StatusBar.tsx`, import and place `MuteButton` after `RulesButton` in the right cluster (no new prop — it reads context):

```tsx
import { MuteButton } from './MuteButton'
// ...
      <RulesButton onClick={onOpenRules} />
      <MuteButton />
```

- [ ] **Step 6: Run the wiring test + full suite**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/audioWiring.test.tsx`
Expected: PASS (`fake.played` contains `exit` and `draw`).

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test`
Expected: PASS — existing App/StatusBar/handoff tests unchanged (unwrapped `useAudio` is inert, `MuteButton` renders null without a provider).

- [ ] **Step 7: Typecheck + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web typecheck
git add apps/web/src/main.tsx apps/web/src/components/App.tsx apps/web/src/components/StatusBar.tsx apps/web/tests/audioWiring.test.tsx
git commit -m "feat(web): wire audio into commitAndPass + place the mute button"
```

---

### Task 9: PWA precache for audio — `vite.config.ts`

Config-only; verified by a successful build (not a unit test).

**Files:**
- Modify: `apps/web/vite.config.ts`

- [ ] **Step 1: Add audio globs + a larger precache ceiling**

In `apps/web/vite.config.ts`, inside the `VitePWA({ ... workbox: { ... } })` block:

```ts
workbox: {
  globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,mp3,webm}'],
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  navigateFallback: ghPages ? '/tock/index.html' : 'index.html'
}
```

(Only `globPatterns` gains `mp3,webm` and the new `maximumFileSizeToCacheInBytes` line is added; `navigateFallback` is unchanged.)

- [ ] **Step 2: Verify the production build succeeds**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web build`
Expected: build completes; the PWA plugin logs precached entries without error. (No audio binaries exist yet, so none are listed — that is fine; the glob simply matches them once assets land.)

- [ ] **Step 3: Run the full suite once more**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/vite.config.ts
git commit -m "chore(web): precache audio assets in the service worker"
```

---

## Self-Review

**Spec coverage** (against `2026-07-28-tock-web-audio-design.md`):
- §2 module layout → Tasks 1–7 create every file; §12 file list matches.
- §2 single trigger site (commitAndPass) + `play` stability invariant → Task 8 Step 4; provider `play` is a stable `useCallback` (Task 6).
- §2 install gate (standalone/DEV/?audio), inert when off, MuteButton null → Tasks 4, 6, 7; tested in `audioProvider`/`muteButton`.
- §3 manifest, formats, pools, pickSample → Task 2.
- §4 soundForMove + capture/win; shared `capturedColorList` → Tasks 1, 3.
- §4 draw = human-mover-only, not in soundForMove → `soundsForCommit` (Task 3), gated in Task 8.
- §5 engine interface, injected RNG pool pick, format fallback, Howler global mute, lazy → Task 5.
- §6 provider: unlock on first gesture, persistence, visibility pause, StrictMode/DI → Task 6.
- §7 MuteButton (Barré icon), StatusBar in-game + fixed off-game → Tasks 7, 8.
- §8 PWA globs + size → Task 9.
- §9 constraints (autoplay unlock, reduced-motion not coupled) → provider unlock; no reduced-motion code touches audio (constraint honoured by omission).
- §10 tests → gameEvents, sounds, soundForMove, audioEnabled, audioEngine, audioProvider, muteButton, audioWiring. The spec's `installGate.test.tsx` is folded into `audioProvider` (gated-off cases) and `muteButton` (null render) to avoid duplication.
- §11 deps → Task 5 Step 1.

**Placeholder scan:** no TBD/TODO; every code step has full source; the only literal "placeholder" is the intended asset-slot README (§13 of the spec).

**Type consistency:** `SoundId`, `AudioEngine`, `AudioContextValue`, `capturedColorList`, `soundForMove`/`soundsForCommit`, `sourcesFor`, `computeAudioEnabled`, `pickSample`, `createFakeEngine` names/signatures match across the tasks that define and consume them. `play`'s stability is asserted where `commitAndPass` depends on it.

**Note for the implementer:** `apps/web/tests/setup.ts` currently has no `vitest` import; Task 5 Step 2 adds `import { vi } from 'vitest'`. If a later lint flags an unused import in any step, remove it in that same step (max-warnings 0).

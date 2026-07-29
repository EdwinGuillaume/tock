# Tock Web Audio — UI tap sound on primary CTAs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play a short tap sound when the player presses a primary navigation button (Nouvelle partie, Lancer la partie, Rejouer), with Howler eagerly preloaded so even the first tap sounds.

**Architecture:** Extends the existing `apps/web/src/audio/` module. Adds a `'tap'` SoundId fired directly from `App` (like `draw`, not via `soundForMove`), and an engine `preload()` (lazy `import('howler')` WITHOUT resuming the context) called by `AudioProvider` at mount so the engine is ready before the first click. `@tock/core` untouched.

**Tech Stack:** TypeScript (strict), React 19, Vite, Vitest + jsdom + @testing-library/react, Howler.js.

## Global Constraints

- **Node:** prefix every `pnpm`/`node` command with `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; ` (project needs Node ≥ 22).
- **Package boundary:** `apps/web` only. Do NOT touch `@tock/core`.
- **Code style:** no semicolons, no trailing commas, no `function` keyword (const arrow functions), **no non-null `!` in production code** (tests may), English identifiers/comments, camelCase non-plural, ESLint max-warnings 0. No two statements packed on one line with `;`.
- **Branch:** continue on `feat/web-audio` (unmerged; this extends the same feature).
- **Scope:** primary CTAs only — Nouvelle partie / Lancer la partie / Rejouer. Do NOT add tap sounds to secondary chrome buttons (Règles, add/remove opponent, Humain/Bot, board-size, mute) or to in-game gameplay taps (cards/ghosts already produce move sounds via `commitAndPass`).
- **Preload must NOT resume the audio context** (no user gesture yet) — only `unlock()` (first gesture) resumes.
- **Spec:** `docs/superpowers/specs/2026-07-28-tock-web-audio-design.md` (see the 2026-07-28 UI-tap addendum).
- Tests live flat in `apps/web/tests/`. Commit after every task.

## File Structure

**Modified:**
- `apps/web/src/audio/sounds.ts` — add `'tap'` to `SoundId` + a `tap` manifest entry.
- `apps/web/public/audio/README.md` — add `tap-1`, `tap-2` to the slot list.
- `apps/web/src/audio/AudioEngine.ts` — add `preload` to the `AudioEngine` type; split the loader into `ensureLib()` + `applyLoaded()` so `preload` (load only) and `unlock` (load + resume) share it.
- `apps/web/src/audio/AudioProvider.tsx` — call `engine.preload()` in a mount effect when `audioEnabled`.
- `apps/web/tests/audioFake.ts` — add `preload` + `preloadCount` to the fake.
- `apps/web/src/components/App.tsx` — fire `play('tap')` in the `onPlay` / `onStart` wrappers and in `handleRestart`.

**Test files touched:** `apps/web/tests/audioProvider.test.tsx` (preload cases), `apps/web/tests/audioWiring.test.tsx` (tap-on-CTA case).

---

### Task 1: `'tap'` sound + engine preload + provider preload-at-mount

**Files:**
- Modify: `apps/web/src/audio/sounds.ts`
- Modify: `apps/web/public/audio/README.md`
- Modify: `apps/web/src/audio/AudioEngine.ts`
- Modify: `apps/web/src/audio/AudioProvider.tsx`
- Modify: `apps/web/tests/audioFake.ts`
- Test: `apps/web/tests/audioProvider.test.tsx`

**Interfaces:**
- Produces: `SoundId` now includes `'tap'`; `AudioEngine` now has `preload: () => void`; `FakeEngine` gains `preload` + `preloadCount: number`.

- [ ] **Step 1: Add the `tap` sound to the manifest**

In `apps/web/src/audio/sounds.ts`, extend the `SoundId` union with a UI group and add the manifest entry:

```ts
export type SoundId =
  | 'exit' | 'move' | 'push' | 'swap' | 'split7' | 'discard'
  | 'capture' | 'win'
  | 'draw'
  | 'tap'
```

Add to `soundManifest` (after the `draw` entry):

```ts
  draw: { pool: ['draw-1', 'draw-2'], volume: 0.4 },
  tap: { pool: ['tap-1', 'tap-2'], volume: 0.5 }
```

(Remove the trailing comma rule: the `draw` line gains a trailing comma only because a line follows it — matching the file's existing no-trailing-comma-on-last-entry style, `tap` is now last with no trailing comma.)

- [ ] **Step 2: Add the tap slots to the asset README**

In `apps/web/public/audio/README.md`, add `tap-1, tap-2` to the filename list (same line group as the other clips).

- [ ] **Step 3: Write the failing provider preload tests**

In `apps/web/tests/audioProvider.test.tsx`, add these two tests. In the "gated on" describe block:

```tsx
  it('preloads the engine at mount so the first tap is ready', () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><Probe /></AudioProvider>)
    expect(fake.preloadCount).toBe(1)
  })
```

In the "gated off (browser tab)" describe block:

```tsx
  it('does not preload when gated off', () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled={false}><Probe /></AudioProvider>)
    expect(fake.preloadCount).toBe(0)
  })
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/audioProvider.test.tsx`
Expected: FAIL — `fake.preloadCount` is undefined / `preload` not on the fake, and the provider does not call it yet.

- [ ] **Step 5: Add `preload` to the fake engine**

In `apps/web/tests/audioFake.ts`, add the field and method:

```ts
export type FakeEngine = AudioEngine & {
  played: SoundId[]
  unlockCount: number
  preloadCount: number
  musicStarted: number
  pauseCount: number
  resumeCount: number
  muted: boolean | null
}

export const createFakeEngine = (): FakeEngine => {
  const fake: FakeEngine = {
    played: [],
    unlockCount: 0,
    preloadCount: 0,
    musicStarted: 0,
    pauseCount: 0,
    resumeCount: 0,
    muted: null,
    preload: () => { fake.preloadCount++ },
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

- [ ] **Step 6: Add `preload` to the real engine (load without resume)**

Replace the loader + returned object in `apps/web/src/audio/AudioEngine.ts`. Add `preload` to the `AudioEngine` type:

```ts
export type AudioEngine = {
  preload: () => void
  unlock: () => void
  play: (id: SoundId) => void
  startMusic: () => void
  stopMusic: () => void
  pauseMusic: () => void
  resumeMusic: () => void
  setMuted: (muted: boolean) => void
}
```

Then, inside `createAudioEngine`, replace the `load()` function (the current lines from `// Load Howler lazily…` through the end of `load`) and the returned object's `unlock` with this — introducing `wantResume` and splitting `applyLoaded()`/`ensureLib()`:

```ts
  let wantResume = false

  // Apply everything queued before Howler resolved. Resume the audio context
  // only after a real user gesture (wantResume), never on a bare preload.
  const applyLoaded = () => {
    if (!lib) return
    lib.Howler.mute(muted)
    if (wantResume) lib.Howler.ctx?.resume?.()
    if (wantMusic) playMusic()
  }
  // Kick off the lazy Howler import once; a gated-off browser tab never mounts
  // an enabled provider, so it still downloads nothing.
  const ensureLib = () => {
    if (lib) {
      applyLoaded()
      return
    }
    void import('howler').then(mod => {
      lib = mod
      applyLoaded()
    })
  }

  return {
    preload: () => { ensureLib() },
    unlock: () => {
      wantResume = true
      ensureLib()
    },
    play: id => {
      const entry = soundManifest[id]
      howlFor(pickSample(entry.pool, random), entry.volume)?.play()
    },
    startMusic: () => {
      wantMusic = true
      if (lib) playMusic()
    },
    stopMusic: () => {
      wantMusic = false
      music?.stop()
    },
    pauseMusic: () => { music?.pause() },
    resumeMusic: () => {
      wantMusic = true
      if (lib) playMusic()
    },
    setMuted: value => {
      muted = value
      lib?.Howler.mute(value)
    }
  }
```

Declare `let wantResume = false` alongside the other `let` state near the top of `createAudioEngine` (with `lib`, `muted`, `wantMusic`) rather than mid-body if you prefer — either placement is fine as long as it is in scope for `applyLoaded`. The `howlFor`, `ensureMusic`, `playMusic` helpers are unchanged.

- [ ] **Step 7: Call `preload` at provider mount**

In `apps/web/src/audio/AudioProvider.tsx`, add a mount effect (after the existing engine-creation line / before or after the mute effect — order does not matter):

```tsx
  useEffect(() => {
    if (audioEnabled) engineRef.current?.preload()
  }, [audioEnabled])
```

- [ ] **Step 8: Run the provider tests + full suite**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/audioProvider.test.tsx`
Expected: PASS (preload-at-mount = 1, gated-off = 0, plus the existing cases still green).

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test`
Expected: PASS — the new `preload` interface method is on both engines; `sourcesFor`/`audioEngine.test.ts` unaffected; the manifest loop test in `sounds.test.ts` now also covers `tap` (non-empty pool).

- [ ] **Step 9: Typecheck + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web typecheck
git add apps/web/src/audio/sounds.ts apps/web/public/audio/README.md apps/web/src/audio/AudioEngine.ts apps/web/src/audio/AudioProvider.tsx apps/web/tests/audioFake.ts apps/web/tests/audioProvider.test.tsx
git commit -m "feat(web): add tap SoundId + eager Howler preload"
```

---

### Task 2: Fire the tap sound on the three primary CTAs

**Files:**
- Modify: `apps/web/src/components/App.tsx`
- Test: `apps/web/tests/audioWiring.test.tsx`

**Interfaces:**
- Consumes: `play` from `useAudio()` (already read in `App`); `'tap'` SoundId (Task 1).

- [ ] **Step 1: Write the failing wiring test**

In `apps/web/tests/audioWiring.test.tsx`, add a test that clicking "Nouvelle partie" fires `'tap'`. Reuse the file's existing imports (`render`, `screen`, `userEvent`, `App`, `AudioProvider`, `createFakeEngine`, `vi`). Add inside the existing `describe`:

```tsx
  it('plays a tap sound when the player presses Nouvelle partie', async () => {
    const fake = createFakeEngine()
    render(<AudioProvider engine={fake} enabled><App /></AudioProvider>)
    await userEvent.click(screen.getByRole('button', { name: /nouvelle partie/i }))
    expect(fake.played).toContain('tap')
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/audioWiring.test.tsx`
Expected: FAIL — `fake.played` does not contain `'tap'` (App does not fire it yet).

- [ ] **Step 3: Fire `play('tap')` in the three CTA wrappers**

In `apps/web/src/components/App.tsx`:

- `handleRestart` — add `play('tap')` as its first statement:

```tsx
  const handleRestart = () => {
    play('tap')
    setAwaitingHandoff(false)
    restart()
  }
```

- In the `screen` builder, the Home `onPlay` — change `onPlay={() => setEntered(true)}` to:

```tsx
onPlay={() => { play('tap'); setEntered(true) }}
```

- The Setup `onStart` — change `onStart={(kindList, ringSize) => start(kindList, ringSize)}` to:

```tsx
onStart={(kindList, ringSize) => { play('tap'); start(kindList, ringSize) }}
```

Do NOT change any other button. `play` is already in scope (`const { play } = useAudio()` near the top of `App`).

- [ ] **Step 4: Run the wiring test + full suite**

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/audioWiring.test.tsx`
Expected: PASS (`fake.played` contains `'tap'`).

Run: `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test`
Expected: PASS — existing App/handoff tests unaffected (they render unwrapped, `useAudio` inert, so `play('tap')` is a harmless no-op).

- [ ] **Step 5: Typecheck + commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web typecheck
git add apps/web/src/components/App.tsx apps/web/tests/audioWiring.test.tsx
git commit -m "feat(web): play a tap sound on the primary CTAs"
```

---

## Self-Review

**Spec coverage** (against the 2026-07-28 UI-tap addendum): `'tap'` SoundId fired directly, not via `soundForMove` → Task 1 Step 1 + Task 2 (fired in App). Eager preload without context resume → Task 1 Steps 6–7 (`preload` = `ensureLib` without `wantResume`; `unlock` sets `wantResume`). Screens stay audio-agnostic → Task 2 wires only App's wrappers. Scope limited to the three CTAs → Task 2 Step 3 changes only those three. Chunk split preserved → `import('howler')` still the only value import; a gated-off provider never calls `preload` (Task 1 Step 7 guard). Install-gate/mute unchanged → no change to gate or mute logic.

**Placeholder scan:** none; every step has concrete code.

**Type consistency:** `preload: () => void` added to `AudioEngine` (Task 1 Step 6) and mirrored on `FakeEngine` (Step 5); `preloadCount` added to `FakeEngine` and asserted in the provider tests (Step 3). `'tap'` added to `SoundId` (Step 1) and consumed via `play('tap')` (Task 2). No signature drift.

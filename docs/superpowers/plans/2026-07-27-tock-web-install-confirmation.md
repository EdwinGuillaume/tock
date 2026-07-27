# Install confirmation on Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wait for the user's answer to the native install dialog before changing the Home screen, and replace the play CTA with an install confirmation note once the app is installed.

**Architecture:** `useInstallPrompt` keeps the deferred `beforeinstallprompt` event until `userChoice` resolves (so nothing moves behind the open dialog) and latches a new `installed` flag on an accepted choice or the `appinstalled` event. `useInstallOffer` relays that flag, and `Home` gains a third CTA branch that renders a note instead of any button.

**Tech Stack:** TypeScript 5.5 (strict), React 19, Vite 5, Vitest 2 + jsdom + @testing-library/react.

Spec: `docs/superpowers/specs/2026-07-27-tock-web-install-confirmation-design.md`

## Global Constraints

- Scope is `apps/web` only. `@tock/core` and `apps/terminal` are untouched.
- Code and comments in **English**; user-facing copy in **French**, tutoiement.
- No semicolons, no trailing commas.
- No `function` keyword — const arrow functions only.
- **No non-null assertions (`!`) in production code.** Tests may use them.
- Variable names are camelCase, descriptive, non-plural (`inputList`, not `inputs`).
- Non-interactive shells default to Node 18 but this repo needs Node ≥ 22.
  **Prefix every `pnpm` command with:**
  `export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; `
- `apps/web/tsconfig.json` includes `tests`, so **test files are typechecked**.
  Any change to the `InstallPrompt` / `InstallOffer` types must be reflected in
  every existing mock in `apps/web/tests/`, or `pnpm typecheck` fails.
- Exact French copy for the new note (used verbatim in Task 3):
  - Heading: `Installée !`
  - Body: `Retrouve Tock dans la liste des applications de ton téléphone.`

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `apps/web/src/pwa/useInstallPrompt.ts` | Owns the deferred Chromium event and the installed latch | Modify |
| `apps/web/src/pwa/useInstallOffer.ts` | Single source of truth for "what install affordance applies now" | Modify |
| `apps/web/src/components/Home.tsx` | Welcome screen; picks one of three CTA states | Modify |
| `apps/web/tests/useInstallPrompt.test.tsx` | Hook behaviour incl. the pending-dialog window | Modify |
| `apps/web/tests/useInstallOffer.test.tsx` | Offer derivation | Modify |
| `apps/web/tests/installButton.test.tsx` | Button rendering — only its `InstallOffer` fixture changes | Modify |
| `apps/web/tests/home.test.tsx` | Home's CTA branch selection | Modify |

`apps/web/src/components/InstallButton.tsx` is **not** modified.

---

### Task 1: `useInstallPrompt` awaits the user's choice

**Files:**
- Modify: `apps/web/src/pwa/useInstallPrompt.ts` (whole file)
- Test: `apps/web/tests/useInstallPrompt.test.tsx` (whole file)

**Interfaces:**
- Consumes: the ambient `BeforeInstallPromptEvent` interface declared in
  `apps/web/src/vite-env.d.ts` — `{ platforms: string[], userChoice:
  Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>, prompt: ()
  => Promise<void> }`.
- Produces: `useInstallPrompt(): InstallPrompt` where
  `InstallPrompt = { canInstall: boolean, installed: boolean, promptInstall: () => void }`.
  Task 2 destructures all three fields.

- [ ] **Step 1: Replace the test file with the new behaviour**

Overwrite `apps/web/tests/useInstallPrompt.test.tsx` with:

```tsx
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useInstallPrompt } from '../src/pwa/useInstallPrompt'

type Choice = { outcome: 'accepted' | 'dismissed', platform: string }

// Fires beforeinstallprompt with a userChoice that stays pending until the test
// answers it, so the window while the native dialog is open is observable.
const fireBeforeInstall = () => {
  let answer: (choice: Choice) => void = () => {}
  const userChoice = new Promise<Choice>(resolve => { answer = resolve })
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent
  Object.assign(event, { prompt: vi.fn(() => Promise.resolve()), preventDefault: vi.fn(), userChoice })
  act(() => { window.dispatchEvent(event) })
  const settle = async (outcome: 'accepted' | 'dismissed') => {
    await act(async () => { answer({ outcome, platform: 'web' }) })
  }
  return { event, settle }
}

describe('useInstallPrompt', () => {
  it('exposes canInstall once beforeinstallprompt fires', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
    fireBeforeInstall()
    expect(result.current.canInstall).toBe(true)
  })

  it('keeps offering install while the native dialog is still open', () => {
    const { result } = renderHook(() => useInstallPrompt())
    const { event } = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    expect(event.prompt).toHaveBeenCalledOnce()
    expect(result.current.canInstall).toBe(true)
    expect(result.current.installed).toBe(false)
  })

  it('prompts once when promptInstall is called twice while pending', () => {
    const { result } = renderHook(() => useInstallPrompt())
    const { event } = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    act(() => { result.current.promptInstall() })
    expect(event.prompt).toHaveBeenCalledOnce()
  })

  it('marks the app installed when the user accepts', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const { settle } = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    await settle('accepted')
    expect(result.current.installed).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('drops the offer without marking installed when the user dismisses', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const { settle } = fireBeforeInstall()
    act(() => { result.current.promptInstall() })
    await settle('dismissed')
    expect(result.current.installed).toBe(false)
    expect(result.current.canInstall).toBe(false)
  })

  it('marks the app installed on the appinstalled event', () => {
    const { result } = renderHook(() => useInstallPrompt())
    fireBeforeInstall()
    act(() => { window.dispatchEvent(new Event('appinstalled')) })
    expect(result.current.installed).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/useInstallPrompt.test.tsx
```

Expected: FAIL. `installed` is `undefined` on the current hook, and
"keeps offering install while the native dialog is still open" fails because
today's `promptInstall` clears the deferred event synchronously
(`canInstall` is already `false`).

- [ ] **Step 3: Rewrite the hook**

Overwrite `apps/web/src/pwa/useInstallPrompt.ts` with:

```ts
import { useEffect, useRef, useState } from 'react'
import { isStandalone } from './platform'

export type InstallPrompt = {
  canInstall: boolean
  installed: boolean
  promptInstall: () => void
}

// Captures Chromium's beforeinstallprompt so the UI can offer an install button
// on demand. The deferred event is held until the user answers the native
// dialog, so the page does not change behind the open dialog. `installed`
// latches on an accepted choice or on appinstalled (which also covers
// installing from the browser's own menu) and is intentionally not persisted:
// an uninstall is undetectable, so a reload starts from a clean slate. iOS has
// no such event — the button handles that case via the platform check.
export const useInstallPrompt = (): InstallPrompt => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  // A consumed event cannot be prompted twice — Chromium throws on the second
  // call — so a double tap must be a no-op while the choice is pending.
  const pending = useRef(false)

  useEffect(() => {
    const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault()
      setDeferred(event)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const canInstall = deferred !== null && !installed && !isStandalone()

  const promptInstall = () => {
    if (!deferred || pending.current) return
    pending.current = true
    void deferred.prompt()
    void deferred.userChoice.then(({ outcome }) => {
      pending.current = false
      if (outcome === 'accepted') setInstalled(true)
      setDeferred(null)
    })
  }

  return { canInstall, installed, promptInstall }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/useInstallPrompt.test.tsx
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pwa/useInstallPrompt.ts apps/web/tests/useInstallPrompt.test.tsx
git commit -m "fix(web): await the install choice before clearing the prompt"
```

Do not run the full suite yet — `useInstallOffer.test.tsx`, `home.test.tsx` and
`installButton.test.tsx` still build `InstallPrompt` / `InstallOffer` objects
without `installed` and will fail typecheck until Tasks 2 and 3 land.

---

### Task 2: `useInstallOffer` relays `installed`

**Files:**
- Modify: `apps/web/src/pwa/useInstallOffer.ts`
- Test: `apps/web/tests/useInstallOffer.test.tsx`
- Test: `apps/web/tests/installButton.test.tsx` (fixture only)

**Interfaces:**
- Consumes: `useInstallPrompt(): { canInstall: boolean, installed: boolean, promptInstall: () => void }` from Task 1.
- Produces: `InstallOffer = { canOfferInstall: boolean, canInstall: boolean, installed: boolean, iosEligible: boolean, inAppBrowser: boolean, promptInstall: () => void }`. Task 3 reads `installed` and `canOfferInstall`.

- [ ] **Step 1: Add `installed: false` to every existing mock in the offer test**

In `apps/web/tests/useInstallOffer.test.tsx`, all four `mockReturnValue` calls
currently read `{ canInstall: X, promptInstall: vi.fn() }`. Add `installed: false`
to each so they satisfy the widened `InstallPrompt` type:

```tsx
vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: true, installed: false, promptInstall: vi.fn() })
```

(lines 18, 25, 33, 40 — the first keeps `canInstall: true`, the other three keep `canInstall: false`).

- [ ] **Step 2: Add the failing test for the relayed flag**

Append inside the `describe('useInstallOffer', …)` block of the same file:

```tsx
  it('relays the installed flag and offers no further install', () => {
    vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: false, installed: true, promptInstall: vi.fn() })
    const { result } = renderHook(() => useInstallOffer())
    expect(result.current.installed).toBe(true)
    expect(result.current.canOfferInstall).toBe(false)
  })
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/useInstallOffer.test.tsx
```

Expected: FAIL — `expected undefined to be true` on `result.current.installed`.

- [ ] **Step 4: Widen the offer**

In `apps/web/src/pwa/useInstallOffer.ts`, add `installed: boolean` to the
`InstallOffer` type (between `canInstall` and `iosEligible`), then destructure
and forward it:

```ts
export type InstallOffer = {
  canOfferInstall: boolean
  canInstall: boolean
  installed: boolean
  iosEligible: boolean
  inAppBrowser: boolean
  promptInstall: () => void
}

// Single source of truth for "can we offer an install right now": the Chromium
// prompt (canInstall) or the iOS Safari add-to-home-screen path (iosEligible).
// Home keys the play/install buttons off canOfferInstall so exactly one shows,
// and takes priority over both when `installed` is set — a freshly installed
// app gets an acknowledgement instead of a CTA. inAppBrowser marks embedded web
// views (Messenger, etc.) where installing is impossible — Home nudges the user
// to reopen the link in the system browser.
export const useInstallOffer = (): InstallOffer => {
  const { canInstall, installed, promptInstall } = useInstallPrompt()
  const iosEligible = isIosSafari() && !isStandalone()
  const inAppBrowser = isInAppBrowser()
  return { canOfferInstall: canInstall || iosEligible, canInstall, installed, iosEligible, inAppBrowser, promptInstall }
}
```

- [ ] **Step 5: Add `installed: false` to the InstallButton fixture**

In `apps/web/tests/installButton.test.tsx`, the `makeOffer` base object is typed
`InstallOffer` and now misses a property. Add one line:

```tsx
const makeOffer = (over: Partial<InstallOffer>): InstallOffer => ({
  canOfferInstall: false,
  canInstall: false,
  installed: false,
  iosEligible: false,
  inAppBrowser: false,
  promptInstall: vi.fn(),
  ...over
})
```

- [ ] **Step 6: Run both test files to verify they pass**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/useInstallOffer.test.tsx tests/installButton.test.tsx
```

Expected: PASS, 5 + 3 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pwa/useInstallOffer.ts apps/web/tests/useInstallOffer.test.tsx apps/web/tests/installButton.test.tsx
git commit -m "feat(web): expose the installed flag on the install offer"
```

---

### Task 3: Home shows the install confirmation

**Files:**
- Modify: `apps/web/src/components/Home.tsx`
- Test: `apps/web/tests/home.test.tsx`

**Interfaces:**
- Consumes: `useInstallOffer(): InstallOffer` from Task 2 — reads `offer.installed` and `offer.canOfferInstall`.
- Produces: no new exports. `Home` keeps its `{ onPlay: () => void }` props.

- [ ] **Step 1: Add `installed: false` to every existing mock in the Home test**

In `apps/web/tests/home.test.tsx`, lines 16, 23 and 30 currently read
`{ canInstall: X, promptInstall: vi.fn() }`. Add `installed: false` to each, e.g.

```tsx
vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: false, installed: false, promptInstall: vi.fn() })
```

(line 23 keeps `canInstall: true`).

- [ ] **Step 2: Add the failing test for the installed branch**

Append inside the `describe('Home', …)` block of the same file:

```tsx
  it('shows the installed note and no button once the app is installed', () => {
    vi.spyOn(installHook, 'useInstallPrompt').mockReturnValue({ canInstall: false, installed: true, promptInstall: vi.fn() })
    render(<Home onPlay={vi.fn()} />)
    expect(screen.getByText(/liste des applications de ton téléphone/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /nouvelle partie/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /installer l'app/i })).not.toBeInTheDocument()
  })
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/home.test.tsx
```

Expected: FAIL — `Unable to find an element with the text: /liste des
applications de ton téléphone/i`; the play button renders instead.

- [ ] **Step 4: Add the note component to `Home.tsx`**

Insert this module-level component after the existing local `Marble` component
(after line 14, before `export const Home`):

```tsx
// Shown in place of the CTA once the app is installed: the browser tab's job is
// then to point at the installed app, not to start another game here.
const InstalledNote = () => (
  <p role="note" style={{ fontFamily: theme.fontUi, fontSize: 13, color: theme.inkDim, maxWidth: 260, lineHeight: 1.5, margin: 0 }}>
    <strong style={{ display: 'block', marginBottom: 4, color: theme.goldDim, fontSize: 15 }}>Installée !</strong>
    Retrouve Tock dans la liste des applications de ton téléphone.
  </p>
)
```

- [ ] **Step 5: Make the CTA a three-way branch**

In `Home.tsx`, replace the `{offer.canOfferInstall ? … : …}` expression
(currently lines 39–53) with the installed check first. The play-button branch
is unchanged — keep its markup exactly as it is today:

```tsx
      {offer.installed
        ? <InstalledNote />
        : offer.canOfferInstall
          ? <InstallButton offer={offer} />
          : (
            <>
              <button onClick={onPlay}
                style={{ fontFamily: theme.fontDisplay, fontWeight: 700, fontSize: 19, color: '#4a2f0c', background: `linear-gradient(${theme.goldButtonTop}, ${theme.goldButtonBottom})`, border: 'none', borderRadius: theme.radius.lg, padding: '16px 34px', boxShadow: `0 6px 0 ${theme.goldButtonLip}, 0 12px 20px rgba(0,0,0,.45)`, cursor: 'pointer' }}>
                Nouvelle partie
              </button>
              {offer.inAppBrowser && (
                <p role="note" style={{ fontFamily: theme.fontUi, fontSize: 12, color: theme.inkDim, marginTop: 16, maxWidth: 260, lineHeight: 1.4 }}>
                  Pour installer l'app, ouvre cette page dans ton navigateur.
                </p>
              )}
            </>
          )}
```

- [ ] **Step 6: Run the Home test to verify it passes**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web test tests/home.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 7: Run the whole workspace suite and the typecheck**

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm -r test && pnpm -r typecheck
```

Expected: every package's suite passes (web gains 5 net new tests: +3 in
`useInstallPrompt`, +1 in `useInstallOffer`, +1 in `home`) and `tsc
--noEmit` is clean in all three packages. If typecheck fails on an
`InstallPrompt` / `InstallOffer` object literal, a mock was missed — add
`installed: false` to it.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/Home.tsx apps/web/tests/home.test.tsx
git commit -m "feat(web): confirm the install on Home instead of showing play"
```

---

## Manual verification (after Task 3)

Not automatable in jsdom — do this on a real Android Chrome once the tasks are
done:

```bash
export PATH="$HOME/.nvm/versions/node/v24.3.0/bin:$PATH"; pnpm --filter @tock/web build && pnpm --filter @tock/web preview --host
```

1. Open the preview URL on an Android device in Chrome (the install prompt needs
   a served build with the service worker, not the dev server).
2. Tap "Installer l'app" — while the native dialog is open, the button behind it
   must still read "Installer l'app" and must not have become "Nouvelle partie".
3. Accept → the note "Installée ! Retrouve Tock dans la liste des applications
   de ton téléphone." replaces the CTA, with no play button.
4. Reload the tab → "Nouvelle partie" is back (expected: the flag is in-memory).
5. Repeat and **dismiss** the dialog instead → "Nouvelle partie" appears, no note.

# Tock — install confirmation on Home

Date: 2026-07-27
Scope: `apps/web` only (`src/pwa/`, `src/components/Home.tsx`). `@tock/core` and
`apps/terminal` are untouched.

## Motivation

On Android Chrome, tapping "Installer l'app" on the Home screen opens the native
install dialog — and the page swaps to the "Nouvelle partie" button *behind* it,
before the user has decided anything. When the dialog closes, the play button is
what greets them, with no acknowledgement that the app was installed.

Two problems:

1. **The UI moves while the dialog is open.** `promptInstall`
   (`apps/web/src/pwa/useInstallPrompt.ts`) clears the deferred
   `beforeinstallprompt` event *synchronously*, so `canInstall` flips to `false`
   immediately. `Home` keys its play/install branch off `canOfferInstall`, so it
   re-renders to the play button while the user is still looking at the dialog.
2. **A successful install is not acknowledged.** Whether the user installs or
   dismisses, the tab lands in the same state. Nothing tells them the app is now
   on their device.

## Desired behaviour

Wait for the user's answer, then branch on it:

| Moment                          | deferred event | Home shows                     |
| ------------------------------- | -------------- | ------------------------------ |
| Dialog open (choice pending)    | kept           | "Installer l'app" — unchanged, nothing moves behind the dialog |
| `accepted` / `appinstalled`     | cleared        | **install confirmation note**  |
| `dismissed`                     | cleared        | "Nouvelle partie"              |

After a successful install the browser tab is a deliberate dead end: the note
replaces the CTA and there is no "Nouvelle partie" button. The tab's job at that
point is to point the user at the installed app.

The installed flag lives in memory only — it is not persisted. On reload,
Chromium no longer fires `beforeinstallprompt` for an installed origin, so the
tab falls through to its normal state with the "Nouvelle partie" button. This is
deliberate: an uninstall is undetectable, so a persisted flag could strand the
tab on the note forever.

## Design

### `apps/web/src/pwa/useInstallPrompt.ts`

`InstallPrompt` gains an `installed: boolean` field:

```ts
export type InstallPrompt = {
  canInstall: boolean
  installed: boolean
  promptInstall: () => void
}
```

- `promptInstall` calls `deferred.prompt()` and awaits `deferred.userChoice`
  before touching state. The deferred event stays in state for the whole
  round-trip, so `canInstall` — whose formula is unchanged
  (`deferred !== null && !installed && !isStandalone()`) — stays `true` while
  the dialog is open.
- On `outcome === 'accepted'`: set `installed`, clear the deferred event.
- On `outcome === 'dismissed'`: clear the deferred event only. A consumed
  `beforeinstallprompt` cannot be re-prompted (Chromium throws on a second
  `prompt()`), so the offer is genuinely gone until the browser fires a fresh
  event; the tab correctly falls back to the play button.
- A re-entrancy guard (a `prompting` ref) makes a second `promptInstall` call a
  no-op while a choice is pending, so a double tap cannot call `prompt()` twice
  on the same event.
- The existing `appinstalled` listener also sets `installed` — it is the
  reliable signal, and it covers installing from the browser's own menu rather
  than through our button. Both paths setting `installed` is idempotent, so
  their ordering does not matter.

### `apps/web/src/pwa/useInstallOffer.ts`

`InstallOffer` relays `installed` alongside the existing fields.
`canOfferInstall` needs no new term: once installed, the deferred event is null,
so `canInstall` is false. `iosEligible` is unaffected (see iOS below).

### `apps/web/src/components/Home.tsx`

The CTA area becomes a three-way branch, in priority order:

1. `offer.installed` → the confirmation note (no buttons at all)
2. `offer.canOfferInstall` → `<InstallButton offer={offer} />` (unchanged)
3. otherwise → "Nouvelle partie", plus the existing in-app-browser note

The note is a small module-level component in `Home.tsx`, alongside the existing
local `Marble` component, styled with the "Feutrine & or" tokens
(`theme.fontUi`, `theme.inkDim`) and rendered with `role="note"` — the same
pattern as the in-app-browser and iOS hints. It occupies the position the CTA
had, so the layout does not shift.

Copy (tutoiement, matching the existing hints):

> **Installée !** Retrouve Tock dans la liste des applications de ton téléphone.

`InstallButton.tsx` is unchanged.

### iOS

Untouched. Safari fires neither `beforeinstallprompt` nor `appinstalled`, so
`installed` is always `false` there and the existing Share-sheet hint keeps
working exactly as today. Acknowledging an iOS add-to-home-screen is not
detectable and is out of scope.

## Testing (`apps/web/tests/`)

The existing rig stubs `beforeinstallprompt` by dispatching an event carrying a
`prompt` spy; it gains a `userChoice` promise the test resolves explicitly so the
pending window is observable.

- **`useInstallPrompt.test.tsx`**
  - `canInstall` stays `true` after `promptInstall` while `userChoice` is
    unresolved (the regression guard for the button changing behind the dialog).
  - `outcome: 'accepted'` ⇒ `installed` true, `canInstall` false.
  - `outcome: 'dismissed'` ⇒ `installed` false, `canInstall` false.
  - `appinstalled` ⇒ `installed` true.
  - Calling `promptInstall` twice while a choice is pending calls `prompt()`
    once.
- **`useInstallOffer.test.tsx`** — `installed` is relayed from the prompt hook.
- **`home.test.tsx`** — when installed, the note is present and neither
  "Nouvelle partie" nor "Installer l'app" is in the DOM; the existing
  offer/play/in-app-browser cases still pass.

## Out of scope

- Persisting the installed state across reloads (see rationale above).
- Any iOS install acknowledgement.
- Changes to the service worker, the update banner, or the manifest.

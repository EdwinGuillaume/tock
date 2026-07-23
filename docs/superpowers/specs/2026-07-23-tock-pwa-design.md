# Tock M3 — Installable, offline PWA — Design document

- **Date**: 2026-07-23
- **Status**: approved (brainstorming), ready for the implementation plan
- **Author**: eguillaume

## 1. Context & goal

M1 (solo vs bots) and M2 (local pass-and-play) of the mobile web app are built,
tested, and merged — `apps/web` is a Vite + React 19 app reusing `@tock/core`
unchanged, deployed as a static shareable link, and it has been through the full
"Feutrine & or" visual + UX redesign. This document covers **M3 — the PWA
milestone** from the mobile web spec
(`docs/superpowers/specs/2026-07-20-tock-mobile-web-design.md` §2), turning that
link into an **installable, offline-capable app** without losing the "single URL,
opens instantly" quality that makes it a portfolio piece.

The work is **`apps/web`-only**. `@tock/core` (engine + AI + geometry) is
**untouched** — M3 adds no rules, no bot behaviour, no engine changes. It is a
packaging + install-UX layer around the existing app.

Today only a stub exists: `apps/web/public/manifest.webmanifest` with an empty
`icons: []`, linked from `index.html`. There is no `vite-plugin-pwa`, no service
worker, and no icon assets.

## 2. Success criteria ("done")

- **Lighthouse PWA audit passes**: installable, service worker registered,
  works offline.
- **Installable on Android and iOS**: the "Le quatuor" icon on the home screen;
  launch is **full-screen** (`display: standalone`) with a felt splash.
- **Offline reload**: with the network off (airplane mode / DevTools offline),
  the installed app loads and both modes play (solo vs bots, pass-and-play) —
  the game is 100% client-side, so once the shell is cached there is nothing
  else to fetch.
- **Update path**: after a new deploy, the running app shows a discreet
  **"Nouvelle version — Recharger"** banner; reloading picks up the new version.
  No surprise reload mid-game.

## 3. Icon & assets — the frozen "Le quatuor" direction

The chosen icon (brainstormed 2026-07-23, visual companion) is **"Le quatuor"**:
the four seat-coloured marbles (red top, blue right, yellow bottom, green left)
arranged in a **cross** on the "Feutrine & or" felt. It echoes the cross board
and the four players, and its full-bleed felt background makes it an ideal
**maskable** icon.

- **Single source of truth**: the exact SVG is frozen at
  `docs/superpowers/specs/2026-07-23-tock-pwa-icon.svg`. Implementation copies it
  verbatim to **`apps/web/public/icon.svg`** — it is **not** redrawn from memory
  (anti-drift). Its colours come verbatim from `apps/web/src/theme.ts`
  (`feltGradient` + `seatColor`).
- **Maskable-safe**: the canvas is a **full-bleed 512×512 square** — rounded
  corners and the circular/squircle mask are applied by the OS, never baked in.
  The four marbles sit inside the central safe zone (farthest marble point 194px
  from centre < the 205px safe radius), so no marble is clipped by a round mask.
  The same source serves both the `any` and `maskable` icon purposes.
- **Generation**: **`@vite-pwa/assets-generator`** with the `minimal-2023`
  preset, driven from `icon.svg`, produces `pwa-192x192.png`, `pwa-512x512.png`,
  the maskable variant, `apple-touch-icon-180x180.png`, and the favicon — exactly
  the "iOS de base" asset set (no per-device splash images). Integrated through
  `vite-plugin-pwa`'s `pwaAssets` option so the icon `<link>` tags + the
  apple-touch-icon are injected automatically at build time.

## 4. Service worker & offline strategy

- **`vite-plugin-pwa`** (Workbox under the hood), **`registerType: 'prompt'`**.
- **Offline-first precache of the whole shell**: Workbox `globPatterns` cover
  `js,css,html,svg,png,woff,woff2` so the self-hosted `@fontsource` fonts
  (emitted as hashed assets) are cached too. `navigateFallback: 'index.html'`
  serves the SPA offline.
- **No runtime caching** — the app makes no network requests at play time; a
  precache is all it needs.

## 5. Update banner

- Uses the plugin's `virtual:pwa-register/react` hook (`useRegisterSW`), which
  exposes `needRefresh` and `updateServiceWorker`.
- **`UpdateBanner.tsx`** — a discreet "Feutrine & or" toast: "Nouvelle version —
  Recharger"; the button calls `updateServiceWorker(true)`. It optionally shows a
  brief "Prêt hors-ligne" note on `offlineReady`. Mounted once in `App.tsx`.
- `registerType: 'prompt'` (not `autoUpdate`) is deliberate: the player finishes
  their game; the reload only happens when they tap Recharger.

## 6. Manifest & document head

- **Manifest is defined in `apps/web/vite.config.ts`** (the plugin generates
  `manifest.webmanifest`); the current **static `public/manifest.webmanifest` is
  removed** so there is one source. Fields: `name`/`short_name` "Tock",
  `description`, `display: standalone`, `orientation: portrait`, `start_url:
  "."`, `lang: "fr"`, `categories: ["games"]`, plus the generated `icons`.
- **Colour reconciliation**: both `theme_color` and `background_color` =
  **`#0c211d`** (the dark felt). Today the manifest says `#5c3a17` and the
  `index.html` `<meta name="theme-color">` says `#0c211d`; M3 **unifies on
  `#0c211d`** so the splash and status bar are seamless with the felt.
- **iOS "de base" `<head>`** (added to `index.html`; `viewport-fit=cover` is
  already present): `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style: black-translucent` (the felt shows
  under the status bar), `apple-mobile-web-app-title: Tock`.

## 7. Install UX

- **`useInstallPrompt.ts`** — captures `beforeinstallprompt` (Android/Chrome),
  exposes `canInstall` + `promptInstall()`; hides itself on `appinstalled` and
  when already running in `display-mode: standalone`.
- **iOS** has no `beforeinstallprompt`: detect iOS-Safari-not-standalone and show
  a hint instead — "Partager → Sur l'écran d'accueil".
- **`InstallButton.tsx`** — a discreet button on the **welcome screen**
  (`Home.tsx`), placed under the "Nouvelle partie" CTA. On Android/Chrome it
  triggers the native prompt; on iOS it reveals the hint.

## 8. Component & module layout (new in `apps/web`)

```
apps/web/
├── public/icon.svg                 copied verbatim from the frozen spec SVG
├── vite.config.ts                  + VitePWA plugin (manifest, workbox, pwaAssets)
├── pwa-assets.config.ts            @vite-pwa/assets-generator preset (minimal-2023)
├── index.html                      + iOS meta tags, unified theme-color
└── src/
    ├── pwa/
    │   ├── useInstallPrompt.ts      beforeinstallprompt + standalone/iOS detection
    │   └── isIosSafari.ts           small pure helper (testable)
    └── components/
        ├── InstallButton.tsx        on Home.tsx
        └── UpdateBanner.tsx         on App.tsx (useRegisterSW)
```

## 9. Testing (`apps/web/tests/`)

- **Unit (jsdom + RTL)**:
  - `useInstallPrompt`: firing `beforeinstallprompt` → `canInstall` true;
    `appinstalled` and `display-mode: standalone` (mocked `matchMedia`) → hidden.
  - `isIosSafari` pure helper → drives the iOS hint.
  - `UpdateBanner`: with `needRefresh` true it renders and the button calls
    `updateServiceWorker`. The `virtual:pwa-register/react` module is **mocked**
    in tests (it does not resolve under Vitest otherwise).
- **Not unit-testable** in jsdom: the service worker / Workbox precache itself.
  Verified via `pnpm --filter @tock/web build && preview`, a **Lighthouse PWA
  audit**, a manual install on Android Chrome + iOS Safari, and an offline
  (airplane-mode) reload.

## 10. Documentation to update

- **CLAUDE.md**: note M3 shipped; add the `src/pwa/` folder, `InstallButton` /
  `UpdateBanner` components, and the PWA build config to the `apps/web` module
  layout; move M3 from roadmap to done in the milestone summary.
- **README.md** / **apps/web/README.md**: the install story (add-to-home-screen,
  offline play) and M3 marked shipped.
- This spec is paired with `docs/superpowers/plans/2026-07-23-tock-pwa.md`
  (written next).

## 11. Decisions made (not open questions)

- **Icon**: "Le quatuor" — four seat marbles in a cross on felt, derived from the
  theme; frozen at `2026-07-23-tock-pwa-icon.svg`.
- **Update**: `registerType: 'prompt'` with an in-app "Nouvelle version" banner.
- **iOS**: basic (apple-touch-icon + meta + uniform felt splash), no per-device
  splash images.
- **Install**: in-app "Installer" button (beforeinstallprompt on Android/Chrome,
  Share-sheet hint on iOS), on the welcome screen.
- **Offline**: offline-first precache of the whole shell; no runtime caching.
- **Colours**: `theme_color` = `background_color` = `#0c211d`.

## 12. Out of scope

- **Save / resume of an in-progress game** — persisting the JSON `GameState` to
  `localStorage` + hydration on launch + a "Reprendre / Nouvelle partie" choice.
  **Explicitly deferred to the backlog** as the natural next step after M3 (an
  installed app that loses its game on reload is the one rough edge M3 leaves;
  this is the fix, tracked separately). Not in M3.
- **Per-device iOS splash images** (we ship a uniform felt splash).
- **M4 Capacitor native wrap** and **online multiplayer / any backend** — their
  own specs later, per the mobile web spec §2/§12.
- **New game rules or bot behaviour** — `@tock/core` is untouched.

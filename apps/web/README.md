# @tock/web

A mobile-first web build of Tock: a Vite + React 19 app with a polished
**"Feutrine & or"** (warm felt & gold) look — a welcome screen, a felt-channel
SVG cross board with glossy marbles, suited fanned cards, and dosed animations
(all respecting `prefers-reduced-motion`) — reusing the shared
[`@tock/core`](../../packages/core) engine + bot unchanged. This is the
**shareable-link** front-end — a single URL that opens straight in a phone
browser and, once loaded, installs to the home screen and plays fully offline.

Playable **solo vs. 1–3 bots** (M1), in **local pass-and-play** (M2) — any
mix of human and bot seats on one device, with a "pass the phone" screen
between different humans' turns — and **installable, offline-capable** (M3,
see [below](#installable--offline-m3)). A Capacitor native wrap (M4) is on the
roadmap — see the root [`README.md`](../../README.md) for the full milestone
list.

## Run it

From the repo root (this is a pnpm workspace package):

```bash
pnpm install                       # once, from the repo root
pnpm --filter @tock/web dev        # dev server with HMR
```

Or from inside `apps/web/`:

```bash
pnpm dev
```

Open the printed `localhost` URL in a browser (or on a phone on the same
network, using the printed LAN URL) and play.

## Build

```bash
pnpm --filter @tock/web build
```

Vite writes a static site to `apps/web/dist/`: `index.html` plus hashed,
content-addressed assets. There is no server-side code to build or run.

To sanity-check the production build locally before deploying:

```bash
pnpm --filter @tock/web preview
```

This serves `dist/` on a local port so you can confirm the built bundle loads
and a game is playable, exactly as it will in production.

## Deploy

`dist/` is a fully static bundle — drop it on any static host:

- **Vercel** — point the project at `apps/web`, build command
  `pnpm --filter @tock/web build`, output directory `dist`.
- **Netlify** — same idea: base directory `apps/web`, build command `vite build`
  (or the `pnpm --filter` form from the repo root), publish directory `dist`.
- **GitHub Pages** — push the contents of `dist/` to the `gh-pages` branch (or
  the `docs/` folder of whichever branch Pages serves) of the target repo.

Vite is configured with `base: './'` (see [`vite.config.ts`](./vite.config.ts)),
so every asset reference in the built `index.html` is relative rather than
absolute (`./assets/...`, `./manifest.webmanifest`). That makes the build
**path-agnostic**: it works whether it's served from a domain root
(`https://example.com/`) or a sub-path (`https://example.com/tock/`), which is
exactly the GitHub Pages project-site case. No rewrite rules or base-path
configuration are required on any of the hosts above.

## No backend

There is **no server component** to this app. Both solo play (a human seat plus
1–3 bots) and local pass-and-play (multiple human seats sharing one device) run
**entirely client-side** — the engine, the bot, and all game state live in the
browser tab. Nothing is persisted or sent over the network; refreshing the page
starts a new game. This keeps the deploy story to "upload static files" with no
database, API, or hosting cost beyond a static host's free tier.

## Installable & offline (M3)

The app is a full PWA. A Workbox service worker (registered via
`vite-plugin-pwa`) precaches the whole built shell at deploy time, so once a
visit has loaded it, the game keeps working with no network at all. When a
new build is deployed, an in-app "Nouvelle version — Recharger" banner lets
returning players know a refresh is available — nothing is forced on them.
The install affordance on the welcome screen (a native `beforeinstallprompt`
button on Android/Chrome, a Share-sheet hint on iOS Safari, which exposes no
native prompt) adds the app to the home screen for a standalone,
no-browser-chrome launch. The full icon set (favicon, `apple-touch-icon`,
maskable) is generated at build time from the single source
[`public/icon.svg`](./public/icon.svg) by `@vite-pwa/assets-generator` (config
in [`pwa-assets.config.ts`](./pwa-assets.config.ts)) — nothing to draw or
export by hand.

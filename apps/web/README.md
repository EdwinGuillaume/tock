# @tock/web

A mobile-first web build of Tock: a Vite + React 19 app that renders an SVG
wood-themed cross board and reuses the shared [`@tock/core`](../../packages/core)
engine + bot unchanged. This is the **shareable-link** front-end — a single URL
that opens straight in a phone browser, no install.

Playable **solo vs. 1–3 bots** (M1) and in **local pass-and-play** (M2) — any
mix of human and bot seats on one device, with a "pass the phone" screen
between different humans' turns. An installable PWA (M3) and a Capacitor native
wrap (M4) are on the roadmap — see the root [`README.md`](../../README.md) for
the full milestone list.

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

## Manifest

[`public/manifest.webmanifest`](./public/manifest.webmanifest) currently holds
just the metadata a full PWA needs later (name, theme color, standalone
display) — no service worker and no icons yet. Full installability (offline
support, an app icon, a splash screen) is scoped to M3.

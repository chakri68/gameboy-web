# chakri.me — ROM Shelf

An interactive, GBA-style "ROM shelf" landing page. Each project is a cartridge;
pick one to slide it into a handheld console, watch it boot, and play the live demo
inside the screen. Built per [`chakri-me-gba-spec.md`](./chakri-me-gba-spec.md).

> Original-homage handheld — no Nintendo trademarks, logos, or audio. Console
> silhouette and the "CHAKRI" boot wordmark are bespoke.

## Stack

- **Vite + vanilla TypeScript + Tailwind v4** — no framework, single page.
- Tiny pub-sub store driving a `Scene` state machine (`shelf → inserting → booting → loaded → ejecting`).
- Plain view modules (`mount`/`update`/`destroy`), CSS/SVG console + cartridges, WAAPI camera zoom.
- `zod`-validated `content.json`, imported at build time.

## Develop

```bash
npm install
npm run dev          # vite dev server
npm run build        # tsc typecheck + production build to dist/
npm run preview      # serve the built dist/
```

## Content

All projects live in [`public/content.json`](./public/content.json), validated by the
shared schema in [`src/schema.ts`](./src/schema.ts). The schema is enforced three ways:
the browser bundle, the build-time Vite plugin (fails `vite build` on a bad entry), and
the sync script.

- `display: "embed"` → live `<iframe>` (auto-falls back to a launch card if it refuses to frame)
- `display: "launch"` → in-aesthetic card that opens the demo in a new tab
- `display: "info"` → retro readme screen
- `enabled: false` → staged, never rendered. `hidden: true` → revealed by the Konami code.

### Add new repos

```bash
npm run roms:sync                  # interactive; set GITHUB_TOKEN for higher rate limits
```

Additive and non-destructive: it finds GitHub repos not yet in `content.json` and stages
them as `enabled: false`. Existing entries are never modified. Use the optional
`repoName` field when a public `id` intentionally differs from the repo name
(e.g. `get-proctered` ← `get-proctered-public`).

## SEO / accessibility

The `chakri-html-inject` Vite plugin injects, at build time, OG/Twitter meta tags and a
crawlable `<noscript>`-friendly plain list of ROMs into `index.html`. The interactive app
hides that list on load; the footer "Skip the arcade — plain list" link reveals it again.

## Keyboard

- **← / →** move shelf selection
- **Enter** insert / skip boot · **Esc** eject / close overlay
- On-screen **A / B / Start / D-pad** mirror the controls
- **Konami** (↑↑↓↓←→←→ B A) unlocks hidden ROMs

## Deploy

Host on Vercel; point the `chakri.me` apex + `www` at it. Demos keep living on their
current GitHub Pages / Vercel URLs and are embedded.

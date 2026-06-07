# chakri.me - "ROM Shelf" GBA-themed project showcase

A build spec for Claude Code. Hand this whole file to it.

---

## 1. The concept

An interactive, animated landing experience for **chakri.me**. Instead of a project
grid, visitors see a **shelf of game cartridges** - each cartridge is one of my
GitHub projects. Picking a cartridge:

1. Slides the cart into a **virtual handheld console** (GBA-style form factor).
2. Plays a short **power-on / boot animation** on the console screen.
3. **Zooms the camera into the screen** until it (nearly) fills the viewport.
4. Loads the project's **live demo in an `<iframe>`** inside the screen.
5. An **eject / power button** zooms back out to the shelf.

Projects without a live demo load an **"info ROM"** instead - a styled in-screen
readme. Shipped products (extensions) load a **"launch" card** with a get-it button.

The metaphor is honest: most of these projects are literally tiny games and
simulations, so "ROM → load into console" is what they actually are.

> **Legal note:** This is an _original homage_ handheld. Do NOT use Nintendo
> trademarks, the Game Boy logo/wordmark, the boot jingle, or any BIOS art. Design
> our own console silhouette and our own boot animation (a "CHAKRI" wordmark that
> drops in). Same vibe, zero IP risk.

---

## 2. Tech stack

- **Vite + vanilla TypeScript + Tailwind.** No framework. Single immersive page,
  no router.
- **State:** a tiny central store - one `state` object holding the current `Scene`
  (§5) plus a `subscribe`/`emit` pub-sub (≈20 lines). Views re-render on change. No
  Redux, no signals lib.
- **DOM/views:** plain module-per-view pattern - each piece in §6 is a class or
  factory function that builds its DOM (`document.createElement`, or a small tagged
  `html` template helper) and exposes `mount(parent)` / `update(state)` / `destroy()`.
  Custom Elements (Web Components, no Lit) are a fine alternative if preferred -
  you've built these before - but keep it dependency-free either way.
- **Animation:** CSS transitions + `@keyframes` for boot/scanlines/hover; the
  **Web Animations API** (`element.animate(...)`) for the cart-insert and the
  camera-zoom timeline. Reach for **GSAP** _only_ if the zoom sequencing gets
  genuinely fiddly - it's framework-agnostic and fine here, but try WAAPI first.
- **Tailwind** for layout + hand-written CSS for the console body (gradients, bezel,
  button shadows).

> **Stack is intentionally vanilla.** Most of the work (console, carts, CRT) is
> framework-irrelevant CSS/SVG, and React's reconciliation actively fights the iframe
> (a stray re-render that recreates the iframe node reloads the embedded demo). The
> one place a framework helps is the insert/zoom choreography. If that hand-off turns
> into a WAAPI tangle, escalate to **Vite + React + Framer Motion** (still NOT Next) -
> see **Appendix A** for exactly what changes. Try vanilla first.

- Display font: **"Press Start 2P"** or **"Pixelify Sans"** for UI chrome; **IBM Plex
  Mono** for info-ROM body text. One display + one body - don't over-mix.
- **Host on Vercel**, point `chakri.me` apex + `www` at it. Demos keep living on
  their current GitHub Pages / Vercel URLs and are embedded.

---

## 3. Content model - `public/content.json`, imported at BUILD TIME

**Decision: bundle `content.json` at build time, not runtime-`fetch`.** With Vercel,
editing content already means a commit + deploy either way, so a runtime fetch buys
nothing and costs a content flash. Import it as a typed module:

```ts
import content from "../public/content.json"; // Vite bundles it; it's also copied
// to dist as /content.json (public/), which keeps the future fetch-swap path open.
// validate with zod at module load; fail the build on a bad entry.
```

**SEO/OG caveat (important for vanilla SPA - no SSR).** A client-rendered SPA does
_not_ put the cart list in the served HTML, so OG/Twitter scrapers (which usually
don't run JS) would see an empty page. Don't hand-wave this. Fix it with a small
**Vite build step** that, from the same `content.json`, injects into `index.html` at
build: (1) static OG/Twitter meta tags + a poster image, and (2) the **accessibility
plain-list** (`<ul>` of enabled ROMs with repo/demo links) inside a
`<noscript>`-friendly container. Use a custom Vite plugin's `transformIndexHtml`
hook (or `vite-plugin-html`). This gives real crawlable HTML and rich link previews
without adding a framework. The interactive JS hydrates over / hides that list on
load.

**Decision: keep the boot animation as the "loading" screen anyway.** Even though
data is instant, when a ROM is selected, still play the ~1.2s boot sequence before
revealing the iframe/info - it sells the "console spinning up" feel without any real
flash. (Skippable with A / click.)

> Future upgrade path (do NOT build now): to edit content without redeploying, swap
> the build-time import for a `fetch` of
> `https://raw.githubusercontent.com/chakri68/<repo>/main/public/content.json`.
> Structure the data layer so this is a one-file change later.

### Schema

```ts
type Display = "embed" | "launch" | "info";
// embed  -> live <iframe>
// launch -> in-aesthetic "▶ LAUNCH / GET IT" card opening demo in a new tab
// info   -> retro readme screen (title, blurb, tech, GitHub link)

interface Rom {
  id: string; // slug, matches repo name
  title: string; // cart label text
  blurb: string; // one line; hover tag + info screen
  tech: string[]; // chips
  repo: string; // github URL
  demo?: string; // url for embed/launch; omit for info
  display: Display;
  tier: 1 | 2 | 3; // shelf grouping / cart art
  accent: string; // hex; drives cart label color
  enabled: boolean; // false => staged, never rendered (sync adds new repos as false)
  hidden?: boolean; // true => only shown after the Konami easter-egg unlock
}

interface Content {
  version: number;
  roms: Rom[];
}
```

`enabled: false` is the safety valve - the sync script stages new repos this way so a
sync can never publish a half-written cart. The UI renders `enabled && !hidden` by
default, and `enabled && hidden` only after the easter-egg unlock.

### Ready-to-drop-in `content.json`

Already curated from 90 repos (forks, templates, config, dupes, and dead scratch
repos excluded). `display` defaults reflect embedding reality (see §7):
GitHub-Pages toys → `embed`; backend/login/camera-dependent apps → `launch`;
no-demo work → `info`; shipped extensions → `launch`.

Three Tier-1 carts (`blackhole-sim`, `canvas-exp`, `frontend-exps`) are set
`enabled: false` because I still need to eyeball whether they're presentable - flip
them on once verified. Personal ROMs are `hidden: true` easter eggs; delete if you
want chakri.me strictly professional.

```json
{
  "version": 1,
  "roms": [
    {
      "id": "pixel-drawing-sim",
      "title": "Pixel Drawing Sim",
      "blurb": "Watch Bresenham & DDA draw lines pixel by pixel",
      "tech": ["canvas", "typescript", "bresenham"],
      "repo": "https://github.com/chakri68/pixel-drawing-sim",
      "demo": "https://chakri68.github.io/pixel-drawing-sim/",
      "display": "embed",
      "tier": 1,
      "accent": "#e8b923",
      "enabled": true
    },
    {
      "id": "sliding-puzzle",
      "title": "Sliding Puzzle",
      "blurb": "A* vs BFS solving the 8-puzzle, live",
      "tech": ["a-star", "bfs", "typescript", "visualization"],
      "repo": "https://github.com/chakri68/sliding-puzzle",
      "demo": "https://chakri68.github.io/sliding-puzzle/",
      "display": "embed",
      "tier": 1,
      "accent": "#5bc8af",
      "enabled": true
    },
    {
      "id": "linear-regression-sim",
      "title": "Linear Regression",
      "blurb": "Drag points, watch the best-fit line react",
      "tech": ["regression", "typescript", "visualization"],
      "repo": "https://github.com/chakri68/linear-regression-sim",
      "demo": "https://chakri68.github.io/linear-regression-sim/",
      "display": "embed",
      "tier": 1,
      "accent": "#e2725b",
      "enabled": true
    },
    {
      "id": "machine-learning-simulations",
      "title": "ML Sims",
      "blurb": "Interactive ML algorithm visualizations",
      "tech": ["machine-learning", "typescript", "canvas"],
      "repo": "https://github.com/chakri68/machine-learning-simulations",
      "demo": "https://chakri68.github.io/machine-learning-simulations/",
      "display": "embed",
      "tier": 1,
      "accent": "#7b6cd9",
      "enabled": true
    },
    {
      "id": "ascii-tetris",
      "title": "ASCII Tetris",
      "blurb": "Tetris rendered entirely in ASCII",
      "tech": ["ascii", "typescript", "game"],
      "repo": "https://github.com/chakri68/ascii-tetris",
      "demo": "https://chakri68.github.io/ascii-tetris/",
      "display": "embed",
      "tier": 1,
      "accent": "#4f9d69",
      "enabled": true
    },
    {
      "id": "ascii-minesweeper",
      "title": "ASCII Minesweeper",
      "blurb": "Minesweeper, ASCII edition",
      "tech": ["ascii", "typescript", "game"],
      "repo": "https://github.com/chakri68/ascii-minesweeper",
      "demo": "https://chakri68.github.io/ascii-minesweeper/",
      "display": "embed",
      "tier": 1,
      "accent": "#c0563f",
      "enabled": true
    },
    {
      "id": "finance-tracker",
      "title": "Finance Tracker",
      "blurb": "Hand-built SCSS UI component set",
      "tech": ["scss", "webpack", "ui-components"],
      "repo": "https://github.com/chakri68/finance-tracker",
      "demo": "https://chakri68.github.io/finance-tracker/",
      "display": "embed",
      "tier": 1,
      "accent": "#3a7ca5",
      "enabled": true
    },
    {
      "id": "themed-ipsum",
      "title": "Themed Ipsum",
      "blurb": "Themed lorem-ipsum generator",
      "tech": ["typescript", "tool"],
      "repo": "https://github.com/chakri68/themed-ipsum",
      "demo": "https://chakri68.github.io/themed-ipsum/",
      "display": "embed",
      "tier": 1,
      "accent": "#d98e04",
      "enabled": true
    },
    {
      "id": "blackhole-sim",
      "title": "Black Hole",
      "blurb": "Canvas gravity / black-hole experiment",
      "tech": ["canvas", "physics", "typescript"],
      "repo": "https://github.com/chakri68/blackhole-sim",
      "demo": "https://chakri68.github.io/blackhole-sim/",
      "display": "embed",
      "tier": 1,
      "accent": "#2b2d6e",
      "enabled": false
    },
    {
      "id": "canvas-exp",
      "title": "Canvas Lab",
      "blurb": "Assorted canvas experiments",
      "tech": ["canvas", "typescript"],
      "repo": "https://github.com/chakri68/canvas-exp",
      "demo": "https://chakri68.github.io/canvas-exp/",
      "display": "embed",
      "tier": 1,
      "accent": "#8e44ad",
      "enabled": false
    },
    {
      "id": "frontend-exps",
      "title": "Frontend Lab",
      "blurb": "Misc frontend experiments",
      "tech": ["javascript", "css"],
      "repo": "https://github.com/chakri68/frontend-exps",
      "demo": "https://chakri68.github.io/frontend-exps/",
      "display": "embed",
      "tier": 1,
      "accent": "#16a085",
      "enabled": false
    },

    {
      "id": "codeCollab",
      "title": "CodeCollab",
      "blurb": "Real-time collaborative IDE (flagship)",
      "tech": ["nextjs", "websockets", "codemirror", "togetherjs"],
      "repo": "https://github.com/chakri68/codeCollab",
      "demo": "https://code-collab.vercel.app",
      "display": "launch",
      "tier": 2,
      "accent": "#f25f5c",
      "enabled": true
    },
    {
      "id": "socket-pixels",
      "title": "Socket Pixels",
      "blurb": "r/place pixel-canvas clone (full-stack)",
      "tech": ["sveltekit", "socket-io"],
      "repo": "https://github.com/chakri68/socket-pixels",
      "demo": "https://socket-pixels.vercel.app",
      "display": "launch",
      "tier": 2,
      "accent": "#ef476f",
      "enabled": true
    },
    {
      "id": "note-on",
      "title": "Note-On",
      "blurb": "Framer-motion notes app",
      "tech": ["nextjs", "framer-motion", "quilljs", "radix-ui"],
      "repo": "https://github.com/chakri68/note-on",
      "demo": "https://note-onn.vercel.app",
      "display": "embed",
      "tier": 2,
      "accent": "#ffd166",
      "enabled": true
    },
    {
      "id": "iss-3d",
      "title": "ISS 3D",
      "blurb": "3D International Space Station",
      "tech": ["threejs", "javascript", "3d"],
      "repo": "https://github.com/chakri68/iss-3d",
      "demo": "https://iss-3d.vercel.app",
      "display": "embed",
      "tier": 2,
      "accent": "#118ab2",
      "enabled": true
    },
    {
      "id": "tilt-exps",
      "title": "Tilt Lab",
      "blurb": "Tilt / device-orientation experiments",
      "tech": ["typescript", "device-orientation"],
      "repo": "https://github.com/chakri68/tilt-exps",
      "demo": "https://tilt-exps.vercel.app",
      "display": "embed",
      "tier": 2,
      "accent": "#06d6a0",
      "enabled": true
    },
    {
      "id": "get-proctered",
      "title": "get-proctered.ai",
      "blurb": "AI exam proctoring (TF + MediaPipe)",
      "tech": ["tensorflow", "mediapipe", "typescript"],
      "repo": "https://github.com/chakri68/get-proctered-public",
      "demo": "https://get-proctered-ai.vercel.app",
      "display": "launch",
      "tier": 2,
      "accent": "#073b4c",
      "enabled": true
    },
    {
      "id": "spotify-stats",
      "title": "Spotify Stats",
      "blurb": "Your top Spotify tracks",
      "tech": ["nextjs", "spotify-web-api"],
      "repo": "https://github.com/chakri68/spotify-stats",
      "demo": "https://musicstats.vercel.app",
      "display": "launch",
      "tier": 2,
      "accent": "#1db954",
      "enabled": true
    },

    {
      "id": "systems-node",
      "title": "systems-node",
      "blurb": "Low-level Node: worker-thread multithreading, semaphores, geohashes",
      "tech": ["nodejs", "worker-threads", "typescript"],
      "repo": "https://github.com/chakri68/systems-node",
      "display": "info",
      "tier": 3,
      "accent": "#ff6b6b",
      "enabled": true
    },
    {
      "id": "machine-learning-algos",
      "title": "ML Algos",
      "blurb": "Common ML algorithms implemented in TypeScript",
      "tech": ["typescript", "machine-learning", "algorithms"],
      "repo": "https://github.com/chakri68/machine-learning-algos",
      "display": "info",
      "tier": 3,
      "accent": "#4ecdc4",
      "enabled": true
    },
    {
      "id": "genetic-algos",
      "title": "Genetic Algos",
      "blurb": "Genetic algorithm implementations",
      "tech": ["typescript", "genetic-algorithms"],
      "repo": "https://github.com/chakri68/genetic-algos",
      "display": "info",
      "tier": 3,
      "accent": "#95e1d3",
      "enabled": true
    },
    {
      "id": "pareto-optimal-fronts",
      "title": "Pareto Fronts",
      "blurb": "Multi-objective optimization fronts",
      "tech": ["typescript", "optimization", "pareto-front"],
      "repo": "https://github.com/chakri68/pareto-optimal-fronts",
      "display": "info",
      "tier": 3,
      "accent": "#f38181",
      "enabled": true
    },
    {
      "id": "line-drawing-algos",
      "title": "Line Algos",
      "blurb": "Bresenham/DDA in Python (tkinter/turtle)",
      "tech": ["python", "tkinter", "turtle"],
      "repo": "https://github.com/chakri68/line-drawing-algos",
      "display": "info",
      "tier": 3,
      "accent": "#aa96da",
      "enabled": true
    },
    {
      "id": "jscratch",
      "title": "jscratch",
      "blurb": "Published VSCode ETL editor extension",
      "tech": ["vscode", "typescript", "etl"],
      "repo": "https://github.com/chakri68/jscratch",
      "demo": "https://marketplace.visualstudio.com/items?itemName=chakri68.jscratch",
      "display": "launch",
      "tier": 3,
      "accent": "#fcbad3",
      "enabled": true
    },
    {
      "id": "code-collab-ext",
      "title": "CodeCollab Ext",
      "blurb": "Published Firefox add-on for CodeCollab",
      "tech": ["firefox", "webext", "css"],
      "repo": "https://github.com/chakri68/code-collab-ext",
      "demo": "https://addons.mozilla.org/en-US/firefox/addon/codecollab-extension/",
      "display": "launch",
      "tier": 3,
      "accent": "#a8d8ea",
      "enabled": true
    },

    {
      "id": "mom-bday-2026",
      "title": "For Mom",
      "blurb": "A birthday surprise",
      "tech": ["typescript"],
      "repo": "https://github.com/chakri68/mom-bday-2026",
      "demo": "https://chakri68.github.io/mom-bday-2026/",
      "display": "embed",
      "tier": 3,
      "accent": "#ff9a9e",
      "enabled": true,
      "hidden": true
    },
    {
      "id": "blog-brew",
      "title": "Sis's Art",
      "blurb": "An art showcase for my lil' sis",
      "tech": ["astro"],
      "repo": "https://github.com/chakri68/blog-brew",
      "demo": "https://astro-milky-way.netlify.app",
      "display": "launch",
      "tier": 3,
      "accent": "#fce38a",
      "enabled": true,
      "hidden": true
    }
  ]
}
```

---

## 4. `npm run roms:sync` - interactive repo importer

Script at `scripts/sync-roms.ts`, run via `tsx`. **Additive and non-destructive** -
its only job is to find repos not yet in `content.json` and stage them.

```
"scripts": { "roms:sync": "tsx scripts/sync-roms.ts" }
```

**Behavior:**

1. Fetch all repos for `chakri68` (paginate even though 90 fits one page). Honor an
   optional `GITHUB_TOKEN` env var for higher rate limits (unauth is 60 req/hr).
2. Filter out `fork` and `archived` repos by default.
3. Load existing `content.json`, build a `Set` of existing `id`s.
4. **Diff:** keep only repos whose name is NOT already an `id`. Existing entries are
   **never read-modified** - manual blurbs/accents/tiers are sacred.
5. If there are no new repos, print "nothing to add" and exit 0.
6. Interactive multiselect (`@clack/prompts`) listing the new repos
   (name + description) so I choose which to add.
7. For each chosen repo, append a staged entry with smart defaults:
   - `id` = name, `title` = name, `blurb` = repo description or `""`
   - `tech` = `[...topics, language].filter(Boolean)` (lowercased, deduped)
   - `repo` = `html_url`
   - `demo` = Pages URL if `has_pages` (`https://chakri68.github.io/<name>/`),
     else `homepage` if non-empty, else omit
   - `display` = `"embed"` if demo host is `github.io`,
     `"launch"` if any other demo exists, else `"info"`
   - `tier` = 3, `accent` = deterministic from a fixed palette (hash of name),
     `enabled` = **false**
8. Write back with **stable key ordering** and 2-space indent (pretty, tiny diffs).
9. **Warn (don't delete)** about any existing `id` whose repo now 404s (renamed /
   deleted), so the file doesn't silently rot.

**Out of scope (separate optional commands, don't build now):**

- `roms:refresh --stars --topics` - explicit opt-in refresh of metadata on existing
  entries.
- `roms:posters` - Playwright screenshots of each `launch` demo into
  `/public/posters/<id>.png`. Heavy/slow; keep it separate.

---

## 5. Scene state machine

```ts
type Scene =
  | { mode: "shelf" }
  | { mode: "inserting"; rom: Rom }
  | { mode: "booting"; rom: Rom } // boot anim plays here (always, see §3)
  | { mode: "loaded"; rom: Rom } // zoomed in: iframe | launch card | info
  | { mode: "ejecting"; rom: Rom };
```

Flow: `shelf → inserting → booting → loaded → ejecting → shelf`.
`Esc` and the on-console eject button trigger `ejecting` from `loaded`.

---

## 6. View modules

Not React components - plain TS view modules (class or factory), each with
`mount(parent)` / `update(state)` / `destroy()`. Names below are modules, not JSX
tags.

- `Stage` - owns the central store + scene transitions + the zoom transform; mounts
  the right child views per `state.mode`.
- `Shelf` - carts grouped by tier; subtle mouse-parallax; hover lifts a cart and
  shows its blurb tag. Renders only `enabled && !hidden` (plus hidden after unlock).
- `Cartridge(rom)` - procedural CSS/SVG cart art: `accent` band, pixel title,
  tier-based shell color, faux barcode/serial. No image assets.
- `Console` - handheld body: screen, D-pad (left), A/B (right), Start/Select, L/R
  nubs, power LED, speaker grille. Pure CSS/SVG.
- `Screen(rom, scene)` - inside the glass: boot animation, then an `<iframe>` /
  `LaunchCard` / `InfoRom` per `display`. Scanline + glass-glare overlay. Owns the
  iframe lifecycle (mount on load, destroy on eject - never keep two alive).
- `LaunchCard(rom)` - attract-screen with "▶ LAUNCH IN NEW TAB" (or "GET IT" for
  extensions); `target="_blank" rel="noopener"`.
- `InfoRom(rom)` - retro readme: title, blurb, tech chips, GitHub button, "INSERT
  ANOTHER ROM" prompt.
- `Controls` - eject/power, sound toggle, shuffle (random enabled ROM).

---

## 7. Iframe embedding - the one real gotcha

Sites block framing via `X-Frame-Options` or `CSP: frame-ancestors`.

- **GitHub Pages (`chakri68.github.io/*`)** sets no such header → all `embed` Tier-1
  carts should frame fine.
- **Vercel (`*.vercel.app`)** - Next.js doesn't add `X-Frame-Options` by default so
  many frame OK, but: `codeCollab`/`socket-pixels` need a live backend (websockets /
  `socket-pixels-server`) likely asleep on free tier; `get-proctered` needs camera +
  loads a heavy TF/MediaPipe model; `spotify-stats` is a login wall. Those four are
  pre-set to `launch` for that reason.

**Required handling for `display: "embed"`:**

1. Attempt the iframe; detect failure (≈6s `load` timeout with no successful
   navigation, or a framing error) → fall back to the `<LaunchCard>` automatically.
2. The fallback must be fully in-aesthetic (an "attract / press start" card), never a
   blank or broken frame.
3. iframe attrs: `loading="lazy"`,
   `sandbox="allow-scripts allow-same-origin allow-popups"`.
4. **During the build, actually load each `embed` URL in an iframe and confirm it
   frames.** If any Tier-2 `embed` (`note-on`, `iss-3d`, `tilt-exps`) refuses,
   change its `display` to `launch` in `content.json`.

---

## 8. Zoom + sizing (the money interaction)

Don't cram demos into a literal 240×160 screen.

- **Resting:** console ~420px wide; screen shows boot/attract art at pixel scale.
- **Loaded:** animate `transform: scale()` + translate growing the console until the
  screen's inner viewport reaches a usable size - target
  `min(92vw, 1100px)` × `min(80vh, 720px)`. Bezel/buttons stay as chrome around the
  edges (may bleed off-screen). ~600–800ms, ease-out-expo via the Web Animations API
  (`element.animate`) or a CSS transition on `transform` (GSAP only if needed).
- The `<iframe>` renders at a real desktop logical width (~1280px) and is
  `transform: scale()`-fit to the screen viewport so responsive sites look right, not
  mobile-squished. Recompute on resize.
- Honor `prefers-reduced-motion`: skip the zoom, cross-fade instead.
- **Boot animation = loading screen (always):** "CHAKRI" wordmark drop-in, a couple
  scanline sweeps, optional chiptune blip (behind sound toggle), ~1.2s, skippable
  with A / click - plays before every load even though data is instant.

---

## 9. Controls & input

- Mouse/touch: click cart to load; click eject to return.
- Keyboard: arrows move shelf selection; **A / Enter** insert; **B / Esc** eject;
  **Start** opens an "all ROMs" overlay.
- On-screen D-pad / A / B mirror keyboard input.
- **Konami code** (↑↑↓↓←→←→ B A) unlocks `hidden` ROMs.

---

## 10. Responsive / mobile

- Console fills the screen; shelf becomes a horizontal cartridge carousel along the
  bottom.
- Touch D-pad/A/B; loaded demos go near-fullscreen with a floating eject FAB.
- Confirm embedded demos stay scrollable inside the screen on touch.

---

## 11. Performance & a11y

- Only one demo iframe mounted at a time; unmount on eject.
- `loading="lazy"`; `preconnect` to `chakri68.github.io`.
- Cart art is CSS/SVG - no image payload.
- **"Skip the arcade - plain list" footer link** rendering the same ROM data as an
  accessible list with repo + demo links. The build step in §3 injects this same list
  into `index.html` so it exists pre-JS for crawlers/OG scrapers; the runtime view can
  reuse or reveal it.
- Focus management: focusable carts; focus moves into the screen on load and returns
  to the cart on eject; `aria-label`s on all icon buttons.

---

## 12. Build phases

1. **Scaffold:** Vite + vanilla TS + Tailwind; fonts; the central store + view-module
   pattern (§2, §6); zod-validate `content.json` at load; the §3 build step that
   injects OG meta + the accessible plain-list into `index.html`. Do the plain-list +
   injection first - it's the safety net _and_ the SEO/OG path.
2. **Shelf + Cartridge:** procedural art, tiers, hover tags, parallax.
3. **Console (CSS/SVG):** static handheld with screen + buttons + LED.
4. **State machine + insert animation.**
5. **Boot animation + Screen** with scanline/glare.
6. **Zoom + iframe + auto-fallback** (§7, §8) - verify every `embed` URL here.
7. **LaunchCard + InfoRom.**
8. **Keyboard controls + Konami unlock.**
9. **Mobile pass** (§10).
10. **Polish:** sound + chiptune, reduced-motion, focus management; deploy to Vercel;
    wire `chakri.me`.
11. **`scripts/sync-roms.ts`** (§4).

---

## 13. Acceptance criteria

- [ ] Shelf shows all `enabled && !hidden` ROMs as distinct carts, grouped by tier.
- [ ] Tier-1 cart: insert → boot → zoom → live playable demo in-screen.
- [ ] Every `embed` URL verified; failures auto-fall-back to an in-aesthetic launch
      card (no blank/broken iframes ever).
- [ ] `launch` carts open the demo in a new tab from an attract-style card.
- [ ] `info` carts show the readme screen.
- [ ] Eject returns to shelf with focus restored.
- [ ] Keyboard fully drives shelf → load → eject; Konami reveals hidden ROMs.
- [ ] Boot animation plays on every load and is skippable.
- [ ] `prefers-reduced-motion` honored.
- [ ] Plain-list accessibility fallback exists; all links work.
- [ ] `content.json` is imported at build time and zod-validated.
- [ ] `npm run roms:sync` adds only new repos, staged `enabled: false`, never mutating
      existing entries.
- [ ] No Nintendo trademarks/logos/audio anywhere.
- [ ] Deployed to Vercel on `chakri.me`.

---

## 14. Stretch (not required)

- CRT toggle (curvature + chromatic aberration) on the screen.
- A faux save-file / visit counter on each cart.
- Default "attract mode": the `pixel-drawing-sim` or `ascii-tetris` cart auto-plays on
  the shelf screen before any selection.
- `roms:posters` Playwright command for launch-card screenshots.

---

## Appendix A - If you switch to Vite + React + Framer Motion

Only adopt this if the vanilla insert/zoom choreography (§8) becomes painful. Pick
**React + Framer Motion on Vite - NOT Next.js.** Next earns its weight via routing /
server components / data fetching; this is one page, no server, build-time data. The
only thing Next would hand you free (SSR'd HTML for OG) is already solved by the §3
`transformIndexHtml` build step, so Next is all cost, no benefit here.

**Why React+Framer is the _only_ worthwhile escalation:** `AnimatePresence` +
`layout`/shared-layout animations are purpose-built for orchestrated, interruptible
enter/exit and FLIP transitions - exactly the cart-flight → console-zoom → iframe
hand-off, including clean mid-flight reversal on eject. That's the few fiddly hours
Framer buys you.

**What changes from the main spec (everything else stays identical):**

- **§2 deps:** `react`, `react-dom`, `framer-motion`. Keep Tailwind, zod, the fonts,
  Vercel hosting, and the §3 build-time `content.json` import + `transformIndexHtml`
  injection (Vite plugins are framework-agnostic).
- **§5 state:** replace the pub-sub store with a single `useReducer` over the `Scene`
  union (the type is unchanged). One reducer, transitions as actions.
- **§6 views → components:** the modules become function components with the same
  responsibilities. `Stage` holds the reducer and renders children by `scene.mode`
  inside one `<AnimatePresence>`.
- **§8 zoom:** the cart uses a Framer `layoutId` shared with the console screen target
  so the insert→zoom is a single shared-layout transition; wrap scene swaps in
  `<AnimatePresence mode="wait">`. Keep the same timings/easing and the
  `prefers-reduced-motion` branch (Framer reads it via `useReducedMotion`).

**The one trap you MUST handle (non-negotiable):** React must never recreate the
demo `<iframe>` DOM node, or the embedded project reloads on every render.

- Mount the iframe in a leaf component that renders **only** when `scene.mode ===
"loaded"`, and give it a **stable `key={rom.id}`** so React reuses the node.
- Do **not** let the iframe live inside any element Framer animates via `layout`
  (layout animation re-creates/transforms wrappers). Animate a _sibling_ bezel/screen
  frame; keep the iframe in a transform-isolated, non-layout container.
- `React.memo` the iframe leaf with a comparator keyed on `rom.id` + `mode` so parent
  re-renders (hover state, parallax, etc.) can't touch it.
- Acceptance addition: _"switching hover/parallax state while a demo is loaded does
  not reload the iframe."_ Verify by watching the network tab - zero re-requests on
  unrelated state changes.

**Build phases (§12) delta:** phase 1 scaffolds React+Framer instead of the
store/view-module pattern; phases 4–6 (insert / boot / zoom) use `AnimatePresence` +
`layoutId`; everything else (carts, console CSS/SVG, embedding/fallback logic, sync
script, a11y, mobile) is unchanged.

**Net:** smoother choreography for less effort, paid for with bundle weight,
hydration, and permanent vigilance against the iframe-remount trap. If you're not
hitting animation pain in vanilla, this isn't worth it.

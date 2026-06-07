import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { parseContent, type Rom } from "../schema";

const SITE_URL = "https://chakri.me";
const SITE_TITLE = "chakri.me - ROM Shelf";
const SITE_DESC =
  "An interactive cartridge shelf of Chakradhar's projects - pick a ROM, boot the console, play the live demo.";
const OG_IMAGE = `${SITE_URL}/og.png`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function romListItem(rom: Rom): string {
  const links = [`<a href="${escapeHtml(rom.repo)}" rel="noopener">source</a>`];
  if (rom.demo)
    links.push(`<a href="${escapeHtml(rom.demo)}" rel="noopener">demo</a>`);
  return (
    `<li><strong>${escapeHtml(rom.title)}</strong> - ${escapeHtml(rom.blurb)} ` +
    `(${links.join(" · ")})</li>`
  );
}

/**
 * Vite plugin (spec §3, §11):
 *  - validates content.json at BUILD TIME (throws -> fails the build on a bad entry)
 *  - injects static OG/Twitter meta tags so crawlers get rich previews (no SSR)
 *  - injects an accessible plain-list of enabled ROMs that exists pre-JS for
 *    crawlers/OG scrapers; the runtime hides it on load and the footer link reveals it.
 */
export function htmlInject(): Plugin {
  return {
    name: "chakri-html-inject",
    transformIndexHtml: {
      order: "pre",
      handler() {
        const file = resolve(process.cwd(), "src/content.json");
        const content = parseContent(JSON.parse(readFileSync(file, "utf8")));
        // Plain list mirrors the default shelf: enabled and not hidden.
        const roms = content.roms.filter((r) => r.enabled && !r.hidden);
        const listHtml =
          `<section id="rom-fallback" aria-label="Project list">` +
          `<h1>chakri.me - projects</h1>` +
          `<ul>${roms.map(romListItem).join("")}</ul>` +
          `</section>`;

        return {
          html: undefined as unknown as string, // leave existing html; only inject tags
          tags: [
            { tag: "title", children: SITE_TITLE, injectTo: "head-prepend" },
            {
              tag: "meta",
              attrs: { name: "description", content: SITE_DESC },
              injectTo: "head",
            },
            // Open Graph
            {
              tag: "meta",
              attrs: { property: "og:type", content: "website" },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:url", content: SITE_URL },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:title", content: SITE_TITLE },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:description", content: SITE_DESC },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:image", content: OG_IMAGE },
              injectTo: "head",
            },
            // Twitter
            {
              tag: "meta",
              attrs: { name: "twitter:card", content: "summary_large_image" },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { name: "twitter:title", content: SITE_TITLE },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { name: "twitter:description", content: SITE_DESC },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { name: "twitter:image", content: OG_IMAGE },
              injectTo: "head",
            },
            // preconnect to the Pages host serving most embeds
            {
              tag: "link",
              attrs: { rel: "preconnect", href: "https://chakri68.github.io" },
              injectTo: "head",
            },
            // Crawlable / pre-JS accessible list
            {
              tag: "div",
              attrs: { id: "rom-fallback-wrap" },
              children: listHtml,
              injectTo: "body-prepend",
            },
          ],
        };
      },
    },
  };
}

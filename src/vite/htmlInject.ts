import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { parseContent, type Content, type Rom } from "../schema";

// ── Identity (single source of truth for every SEO surface) ──────────────────
const SITE_URL = "https://gameboy.chakri.me";
const SITE_NAME = "gameboy.chakri.me";
// Name is in the title on purpose: lets people who search "Chakri"
// land here, not just people who already know the domain.
const SITE_TITLE = "Chakri's ROM Shelf";
const SITE_DESC =
  "An interactive cartridge shelf of my projects — pick a ROM, " +
  "boot the retro console, and play the live demo right in the browser.";
const OG_IMAGE = `${SITE_URL}/og.png`;
const OG_IMAGE_ALT =
  "A retro Game Boy-style console beside a shelf of game cartridges, " +
  "with the wordmark gameboy.chakri.me on the side. “Chakri // ROM Shelf”.";

const AUTHOR = "Chakri";
const SAME_AS = [
  "https://github.com/chakri68",
  "https://www.linkedin.com/in/chakradhar-reddy-d/",
];

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
 * Keywords derived from the live content so they never drift from what's
 * actually on the shelf: the project titles plus the union of their tech tags.
 */
function keywordsFrom(roms: Rom[]): string {
  const tech = new Set<string>();
  for (const r of roms) for (const t of r.tech) tech.add(t);
  return [
    AUTHOR,
    "Chakradhar",
    "chakri",
    "developer portfolio",
    "software projects",
    "interactive demos",
    ...[...tech].sort(),
    ...roms.map((r) => r.title),
  ].join(", ");
}

/**
 * JSON-LD @graph: a Person (the author) + WebSite + a CollectionPage whose
 * ItemList enumerates every shelved project. This is the piece that turns a
 * generic preview into something search engines can actually reason about
 * (knowledge-panel eligibility, sitelinks, rich author attribution).
 */
function jsonLd(roms: Rom[]): string {
  const person = {
    "@type": "Person",
    "@id": `${SITE_URL}/#person`,
    name: AUTHOR,
    alternateName: "chakri",
    url: SITE_URL,
    sameAs: SAME_AS,
    jobTitle: "Software Developer",
  };
  const website = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESC,
    inLanguage: "en",
    author: { "@id": `${SITE_URL}/#person` },
    publisher: { "@id": `${SITE_URL}/#person` },
  };
  const collection = {
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/#projects`,
    url: SITE_URL,
    name: SITE_TITLE,
    description: SITE_DESC,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    primaryImageOfPage: OG_IMAGE,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: roms.length,
      itemListElement: roms.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "SoftwareApplication",
          name: r.title,
          description: r.blurb,
          url: r.demo ?? r.repo,
          applicationCategory: "WebApplication",
          operatingSystem: "Web",
          keywords: r.tech.join(", "),
          author: { "@id": `${SITE_URL}/#person` },
          ...(r.demo ? { sameAs: [r.repo] } : {}),
        },
      })),
    },
  };
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [person, website, collection],
  });
}

/** Same-domain URLs worth handing a crawler: the home page + on-site demos. */
function sitemapXml(content: Content, lastmod: string): string {
  const urls = [SITE_URL];
  for (const r of content.roms) {
    if (r.enabled && !r.hidden && r.demo?.startsWith(SITE_URL))
      urls.push(r.demo);
  }
  const entries = [...new Set(urls)]
    .map(
      (u) =>
        `  <url><loc>${escapeHtml(u)}</loc><lastmod>${lastmod}</lastmod>` +
        `<changefreq>weekly</changefreq>` +
        `<priority>${u === SITE_URL ? "1.0" : "0.7"}</priority></url>`,
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${entries}\n</urlset>\n`
  );
}

function robotsTxt(): string {
  return (
    `User-agent: *\n` + `Allow: /\n\n` + `Sitemap: ${SITE_URL}/sitemap.xml\n`
  );
}

/**
 * Vite plugin (spec §3, §11):
 *  - validates content.json at BUILD TIME (throws -> fails the build on a bad entry)
 *  - injects rich, content-derived SEO so crawlers/social cards get a full
 *    preview without SSR: title, description, canonical, robots, Open Graph,
 *    Twitter card, and a schema.org JSON-LD @graph (Person + WebSite + projects)
 *  - emits robots.txt + a sitemap.xml built from the live ROM list
 *  - injects an accessible plain-list of enabled ROMs that exists pre-JS for
 *    crawlers/OG scrapers; the runtime hides it on load and the footer link reveals it.
 */
export function htmlInject(): Plugin {
  const file = resolve(process.cwd(), "src/content.json");
  const load = (): Content =>
    parseContent(JSON.parse(readFileSync(file, "utf8")));

  return {
    name: "chakri-html-inject",
    transformIndexHtml: {
      order: "pre",
      handler() {
        const content = load();
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
            {
              tag: "meta",
              attrs: { name: "author", content: AUTHOR },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { name: "keywords", content: keywordsFrom(roms) },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: {
                name: "robots",
                content:
                  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
              },
              injectTo: "head",
            },
            {
              tag: "link",
              attrs: { rel: "canonical", href: SITE_URL },
              injectTo: "head",
            },
            // Open Graph
            {
              tag: "meta",
              attrs: { property: "og:site_name", content: SITE_NAME },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:type", content: "website" },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:locale", content: "en_US" },
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
            {
              tag: "meta",
              attrs: {
                property: "og:image:secure_url",
                content: OG_IMAGE,
              },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:image:type", content: "image/png" },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:image:width", content: "1200" },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:image:height", content: "630" },
              injectTo: "head",
            },
            {
              tag: "meta",
              attrs: { property: "og:image:alt", content: OG_IMAGE_ALT },
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
            {
              tag: "meta",
              attrs: { name: "twitter:image:alt", content: OG_IMAGE_ALT },
              injectTo: "head",
            },
            // Structured data (schema.org)
            {
              tag: "script",
              attrs: { type: "application/ld+json" },
              children: jsonLd(roms),
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

    // robots.txt + sitemap.xml are derived from the same content/URL constants
    // so they can never drift from the meta tags above.
    generateBundle() {
      const lastmod = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: robotsTxt(),
      });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: sitemapXml(load(), lastmod),
      });
    },
  };
}

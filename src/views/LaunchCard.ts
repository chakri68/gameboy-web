import { el } from "../dom";
import { icon } from "../icons";
import type { Rom } from "../schema";

const EXTENSION_HOSTS = [
  "marketplace.visualstudio.com",
  "addons.mozilla.org",
  "chrome.google.com",
];

function isExtension(demo: string): boolean {
  try {
    return EXTENSION_HOSTS.includes(new URL(demo).host);
  } catch {
    return false;
  }
}

/**
 * Attract-screen card (spec §6/§7). Used for `launch` ROMs and as the automatic
 * fallback when an `embed` refuses to frame. Opens the demo in a new tab.
 */
export function createLaunchCard(
  rom: Rom,
  opts: { fallback?: boolean } = {},
): HTMLElement {
  const url = rom.demo!;
  const ext = isExtension(url);
  const ctaLabel = ext ? "GET IT" : "LAUNCH IN NEW TAB";

  const card = el(
    "div",
    { class: "card", role: "group", "aria-label": `${rom.title} launch card` },
    [
      el("div", { class: "card__title pixel", text: rom.title }),
      el("div", { class: "card__blurb", text: rom.blurb }),
      el(
        "div",
        { class: "card__chips" },
        rom.tech.map((t) => el("span", { class: "chip", text: t })),
      ),
      el("a", { class: "cta", href: url, target: "_blank", rel: "noopener" }, [
        icon("external-link"),
        ctaLabel,
      ]),
    ],
  );

  card.style.setProperty("--accent", rom.accent);

  if (opts.fallback) {
    card.append(
      el("div", {
        class: "card__blurb",
        style: "font-size:0.58rem;opacity:0.7",
        text: "(This demo can't be framed - opening it in a new tab.)",
      }),
    );
  }
  return card;
}

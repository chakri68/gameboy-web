import { el } from "../dom";
import { icon } from "../icons";
import type { Rom } from "../schema";

/**
 * Retro readme screen (spec §6) for `info` ROMs: title, blurb, tech chips,
 * GitHub button, and an "insert another ROM" prompt.
 */
export function createInfoRom(rom: Rom, onEject: () => void): HTMLElement {
  const card = el(
    "div",
    { class: "card", role: "group", "aria-label": `${rom.title} info` },
    [
      el("div", { class: "card__title pixel", text: rom.title }),
      el("div", { class: "card__blurb", text: rom.blurb }),
      el(
        "div",
        { class: "card__chips" },
        rom.tech.map((t) => el("span", { class: "chip", text: t })),
      ),
      el(
        "a",
        { class: "cta", href: rom.repo, target: "_blank", rel: "noopener" },
        [icon("external-link"), "VIEW ON GITHUB"],
      ),
    ],
  );
  card.style.setProperty("--accent", rom.accent);

  const prompt = el("button", { class: "card__ghost", type: "button" }, [
    icon("undo"),
    "INSERT ANOTHER ROM",
  ]);
  prompt.addEventListener("click", onEject);
  card.append(prompt);

  return card;
}

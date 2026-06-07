import { el } from "../dom";
import type { Rom } from "../schema";

const TIER_SHELL: Record<1 | 2 | 3, string> = {
  1: "#4a4663",
  2: "#553f5e",
  3: "#3f4a5e",
};

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic faux serial so each cart looks unique but stable across reloads. */
function serialFor(rom: Rom): string {
  const n = hashCode(rom.id);
  return `CHK-${String(n % 1000).padStart(3, "0")}`;
}

export interface CartHandle {
  el: HTMLButtonElement;
  rom: Rom;
}

/**
 * Procedural CSS/SVG cartridge (spec §6). No image assets — accent band,
 * pixel title, tier-tinted shell, faux barcode + serial.
 */
export function createCartridge(rom: Rom, onActivate: (rom: Rom) => void): CartHandle {
  const tilt = ((hashCode(rom.id) % 7) - 3).toFixed(0) + "deg";

  const button = el(
    "button",
    {
      class: "cart",
      type: "button",
      "data-id": rom.id,
      "aria-label": `${rom.title} — ${rom.blurb}`,
    },
    [
      el("span", { class: "cart__tag", text: rom.blurb }),
      el("span", { class: "cart__body" }, [
        el("span", { class: "cart__label" }, [
          el("span", { class: "cart__title", text: rom.title }),
          el("span", { class: "cart__barcode", "aria-hidden": "true" }),
          el("span", { class: "cart__serial", text: serialFor(rom) }),
        ]),
        ...(rom.hidden ? [el("span", { class: "cart__locked", text: "★" })] : []),
      ]),
    ]
  );

  button.style.setProperty("--cart-shell", TIER_SHELL[rom.tier]);
  button.style.setProperty("--accent", rom.accent);
  button.style.setProperty("--tilt", tilt);

  button.addEventListener("click", () => onActivate(rom));

  return { el: button, rom };
}

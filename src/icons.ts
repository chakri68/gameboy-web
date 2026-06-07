// Pixel-art UI icons, vendored from the `pixelarticons` package (MIT). Each SVG is
// 24×24 with fill:currentColor, so icons inherit the surrounding text colour and
// size to 1em. Imported raw and inlined (not as <img>) so currentColor works.
import play from "pixelarticons/svg/play.svg?raw";
import close from "pixelarticons/svg/close.svg?raw";
import undo from "pixelarticons/svg/undo.svg?raw";
import shuffle from "pixelarticons/svg/shuffle.svg?raw";
import volume3 from "pixelarticons/svg/volume-3.svg?raw";
import volumeMute from "pixelarticons/svg/volume.svg?raw";
import externalLink from "pixelarticons/svg/external-link.svg?raw";
import lock from "pixelarticons/svg/lock.svg?raw";

const RAW = {
  play,
  close,
  undo,
  shuffle,
  "volume-on": volume3,
  "volume-off": volumeMute,
  "external-link": externalLink,
  lock,
} satisfies Record<string, string>;

export type IconName = keyof typeof RAW;

/** Build an inline pixel icon span (decorative; label your buttons with aria-label). */
export function icon(name: IconName, extraClass = ""): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = extraClass ? `icon ${extraClass}` : "icon";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = RAW[name];
  return span;
}

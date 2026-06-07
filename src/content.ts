import raw from "../public/content.json";
import { parseContent, type Rom } from "./schema";

// Build-time import (see spec §3). Vite bundles content.json into the JS and also
// copies it to dist as /content.json (public/), keeping the future fetch-swap open.
// Validation also runs in the Vite plugin so a bad entry fails `vite build`; this
// runtime parse is the dev-server / belt-and-suspenders guarantee.
export const content = parseContent(raw);

/** ROMs shown on the shelf by default: enabled and not hidden. */
export const visibleRoms = (): Rom[] => content.roms.filter((r) => r.enabled && !r.hidden);

/** Hidden ROMs revealed only after the Konami unlock. */
export const hiddenRoms = (): Rom[] => content.roms.filter((r) => r.enabled && r.hidden);

/** Everything renderable once hidden ROMs are unlocked. */
export const allEnabledRoms = (unlocked: boolean): Rom[] =>
  content.roms.filter((r) => r.enabled && (unlocked || !r.hidden));

export const romsByTier = (roms: Rom[]): Map<1 | 2 | 3, Rom[]> => {
  const map = new Map<1 | 2 | 3, Rom[]>([
    [1, []],
    [2, []],
    [3, []],
  ]);
  for (const r of roms) map.get(r.tier)!.push(r);
  return map;
};

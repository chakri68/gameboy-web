import raw from "./content.json";
import { parseContent, type Rom } from "./schema";

// Build-time import (see spec §3). content.json lives in src/ (Vite forbids JS
// imports from public/), so it is bundled straight into the JS. Validation also
// runs in the Vite plugin so a bad entry fails `vite build`; this runtime parse is
// the dev-server / belt-and-suspenders guarantee.
export const content = parseContent(raw);

/** ROMs shown in the game list by default: enabled and not hidden. */
export const visibleRoms = (): Rom[] =>
  content.roms.filter((r) => r.enabled && !r.hidden);

/** Lookup a single enabled ROM by id (used by the cartridge preview). */
export const romById = (id: string): Rom | undefined =>
  content.roms.find((r) => r.id === id && r.enabled);

/** Hidden ROMs revealed only after the Konami unlock. */
export const hiddenRoms = (): Rom[] =>
  content.roms.filter((r) => r.enabled && r.hidden);

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

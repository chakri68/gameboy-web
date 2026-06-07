import { el } from "../dom";
import { allEnabledRoms, romsByTier } from "../content";
import { icon } from "../icons";
import type { Rom } from "../schema";

const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: "Live toys",
  2: "Apps & demos",
  3: "Source & tools",
};

/**
 * Game list (spec §6, revised): a compact, literal text list docked at the bottom
 * - one row per ROM, grouped by tier. Picking a row opens the cartridge preview
 * (it does not load directly). Keyboard selection mirrors the rows.
 */
export class GameList {
  readonly el: HTMLElement;
  private rows = new Map<string, HTMLButtonElement>();
  private flat: Rom[] = [];
  private onActivate: (rom: Rom) => void;

  constructor(onActivate: (rom: Rom) => void) {
    this.onActivate = onActivate;
    this.el = el("nav", { class: "gamelist", "aria-label": "Game list" });
  }

  /** (Re)build the list for the current unlock state. */
  render(unlocked: boolean): void {
    this.el.replaceChildren();
    this.rows.clear();
    this.flat = [];

    let n = 0;
    const byTier = romsByTier(allEnabledRoms(unlocked));
    for (const tier of [1, 2, 3] as const) {
      const tierRoms = byTier.get(tier)!;
      if (tierRoms.length === 0) continue;
      const group = el("div", { class: "gamelist__group" }, [
        el("div", { class: "gamelist__label", text: TIER_LABEL[tier] }),
      ]);
      for (const rom of tierRoms) {
        const row = el(
          "button",
          {
            class: "gamelist__item",
            type: "button",
            "data-id": rom.id,
            "aria-label": `${rom.title} - ${rom.blurb}`,
          },
          [
            el("span", {
              class: "gamelist__num",
              text: String(++n).padStart(2, "0"),
            }),
            el("span", { class: "gamelist__title", text: rom.title }),
            el("span", { class: "gamelist__blurb", text: rom.blurb }),
            ...(rom.hidden ? [icon("lock", "gamelist__lock")] : []),
          ],
        ) as HTMLButtonElement;
        row.addEventListener("click", () => this.onActivate(rom));
        this.rows.set(rom.id, row);
        this.flat.push(rom);
        group.append(row);
      }
      this.el.append(group);
    }
  }

  /** Flat list in DOM order - drives keyboard selection. */
  get roms(): Rom[] {
    return this.flat;
  }

  setSelected(index: number): void {
    const sel = this.flat[index];
    this.rows.forEach((r, id) =>
      r.classList.toggle("is-selected", id === sel?.id),
    );
    if (sel) this.rows.get(sel.id)?.scrollIntoView({ block: "nearest" });
  }

  focusRom(id: string): void {
    this.rows.get(id)?.focus();
  }

  destroy(): void {
    this.el.remove();
  }
}

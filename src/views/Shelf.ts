import { el, prefersReducedMotion } from "../dom";
import { allEnabledRoms, romsByTier } from "../content";
import type { Rom } from "../schema";
import { createCartridge } from "./Cartridge";

const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: "Tier 1 · Live toys",
  2: "Tier 2 · Apps & demos",
  3: "Tier 3 · Source & tools",
};

/**
 * Shelf (spec §6): carts grouped by tier, mouse-parallax, hover lifts a cart.
 * Renders enabled && !hidden by default; hidden carts appear after the unlock.
 */
export class Shelf {
  readonly el: HTMLElement;
  private carts = new Map<string, HTMLButtonElement>();
  private flat: Rom[] = [];
  private onActivate: (rom: Rom) => void;
  private parallaxHandler?: (e: MouseEvent) => void;

  constructor(onActivate: (rom: Rom) => void) {
    this.onActivate = onActivate;
    this.el = el("section", { class: "shelf", "aria-label": "Cartridge shelf" });
  }

  /** (Re)build the cart list for the current unlock state. */
  render(unlocked: boolean): void {
    this.el.replaceChildren();
    this.carts.clear();
    this.flat = [];

    const roms = allEnabledRoms(unlocked);
    const byTier = romsByTier(roms);

    for (const tier of [1, 2, 3] as const) {
      const tierRoms = byTier.get(tier)!;
      if (tierRoms.length === 0) continue;
      const row = el("div", { class: "shelf-row" });
      for (const rom of tierRoms) {
        const handle = createCartridge(rom, this.onActivate);
        this.carts.set(rom.id, handle.el);
        this.flat.push(rom);
        row.append(handle.el);
      }
      this.el.append(
        el("div", { class: "shelf-tier" }, [
          el("div", { class: "shelf-tier__label", text: TIER_LABEL[tier] }),
          row,
        ])
      );
    }

    if (!this.parallaxHandler && !prefersReducedMotion()) this.enableParallax();
  }

  /** Flat list in DOM order — drives keyboard selection. */
  get roms(): Rom[] {
    return this.flat;
  }

  setSelected(index: number): void {
    const sel = this.flat[index];
    this.carts.forEach((c, id) => c.classList.toggle("is-selected", id === sel?.id));
    if (sel) this.carts.get(sel.id)?.focus({ preventScroll: false });
  }

  focusRom(id: string): void {
    this.carts.get(id)?.focus();
  }

  private enableParallax(): void {
    this.parallaxHandler = (e: MouseEvent) => {
      const dx = (e.clientX / window.innerWidth - 0.5) * 10;
      const dy = (e.clientY / window.innerHeight - 0.5) * 6;
      this.el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    };
    window.addEventListener("mousemove", this.parallaxHandler, { passive: true });
  }

  destroy(): void {
    if (this.parallaxHandler) window.removeEventListener("mousemove", this.parallaxHandler);
    this.el.remove();
  }
}

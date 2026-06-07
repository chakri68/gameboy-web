import { el } from "../dom";
import { allEnabledRoms } from "../content";
import { icon } from "../icons";
import type { Rom } from "../schema";

/** "All ROMs" overlay opened with Start (spec §9). Pick to load, Esc/✕ to close. */
export class AllRomsOverlay {
  readonly el: HTMLElement;
  private grid: HTMLElement;
  private onPick: (rom: Rom) => void;
  private onClose: () => void;

  constructor(onPick: (rom: Rom) => void, onClose: () => void) {
    this.onPick = onPick;
    this.onClose = onClose;

    this.grid = el("div", { class: "overlay__grid" });
    const close = el(
      "button",
      { class: "icon-btn", type: "button", "aria-label": "Close" },
      [icon("close")],
    );
    close.addEventListener("click", () => this.onClose());

    const panel = el(
      "div",
      {
        class: "overlay__panel",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "All ROMs",
      },
      [
        el(
          "div",
          {
            style:
              "display:flex;justify-content:space-between;align-items:center",
          },
          [el("h2", { class: "overlay__title", text: "ALL ROMS" }), close],
        ),
        this.grid,
      ],
    );

    this.el = el("div", { class: "overlay" }, [panel]);
    // Click on the backdrop (outside the panel) closes.
    this.el.addEventListener("click", (e) => {
      if (e.target === this.el) this.onClose();
    });
  }

  render(unlocked: boolean): void {
    this.grid.replaceChildren();
    for (const rom of allEnabledRoms(unlocked)) {
      const item = el("button", { class: "overlay__item", type: "button" }, [
        el("b", { text: rom.title }),
        el("span", { text: rom.blurb }),
      ]);
      item.style.setProperty("--accent", rom.accent);
      item.addEventListener("click", () => this.onPick(rom));
      this.grid.append(item);
    }
  }
}

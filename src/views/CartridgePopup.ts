import { el } from "../dom";
import { icon } from "../icons";
import type { Rom } from "../schema";

const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: "LIVE TOY",
  2: "APP / DEMO",
  3: "SOURCE",
};

/**
 * Cartridge preview modal: a tumbling 3D Game Boy cartridge (cartridge.css, adapted
 * from worksbyvan's CodePen) labelled with the ROM, plus Load / Close. "Load" runs
 * the real insert flow; clicking the backdrop or Close dismisses.
 */
export class CartridgePopup {
  readonly el: HTMLElement;
  readonly romId: string;

  constructor(rom: Rom, onLoad: () => void, onClose: () => void) {
    this.romId = rom.id;

    const cart = el("div", { class: "cart3d" });
    cart.style.setProperty("--cart-accent", rom.accent);
    cart.innerHTML = cartMarkup;
    // Fill the label face with this ROM's title + tier.
    const plate = el("div", { class: "cart3d__plate" }, [
      el("span", { class: "cart3d__title", text: rom.title }),
      el("span", { class: "cart3d__sub", text: TIER_LABEL[rom.tier] }),
    ]);
    cart.querySelector(".label")!.append(plate);

    const chips = el(
      "div",
      { class: "card__chips" },
      rom.tech.slice(0, 4).map((t) => el("span", { class: "chip", text: t })),
    );

    const load = el(
      "button",
      { class: "cart-modal__load", type: "button", "aria-label": "Load" },
      [icon("play"), "LOAD"],
    );
    const close = el(
      "button",
      { class: "cart-modal__close", type: "button", "aria-label": "Close" },
      [icon("close"), "CLOSE"],
    );
    load.addEventListener("click", onLoad);
    close.addEventListener("click", onClose);

    const panel = el(
      "div",
      {
        class: "cart-modal__panel",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": `${rom.title} cartridge`,
      },
      [
        el("div", { class: "cart-modal__stage" }, [cart]),
        el("div", { class: "cart-modal__meta" }, [
          el("div", { class: "cart-modal__title", text: rom.title }),
          el("div", { class: "cart-modal__blurb", text: rom.blurb }),
          chips,
        ]),
        el("div", { class: "cart-modal__actions" }, [load, close]),
      ],
    );

    this.el = el("div", { class: "cart-modal" }, [panel]);
    this.el.addEventListener("click", (e) => {
      if (e.target === this.el) onClose();
    });
    // Focus Load so Enter/Escape work immediately from the keyboard.
    requestAnimationFrame(() => load.focus());
  }
}

// 3D cartridge markup (figures vendored from the CodePen). The `.label` is left
// empty here; the ROM plate is appended into it at runtime.
const cartMarkup = /* html */ `
  <section class="cartridge">
    <div class="case">
      <figure class="front">
        <figure class="base tall"></figure>
        <figure class="base wide"></figure>
        <figure class="linebase"></figure>
        <figure class="line one"></figure>
        <figure class="line two"></figure>
        <figure class="line three"></figure>
        <figure class="line four"></figure>
        <figure class="leftindent"></figure>
        <figure class="rightindent"></figure>
        <figure class="oval"></figure>
        <figure class="label"></figure>
      </figure>
      <figure class="back">
        <figure class="base tall"></figure>
        <figure class="base wide"></figure>
        <figure class="line one"></figure>
        <figure class="line two"></figure>
        <figure class="line three"></figure>
        <figure class="line four"></figure>
      </figure>
      <figure class="rightside">
        <figure class="top"></figure>
        <figure class="bottom"></figure>
        <figure class="line one"></figure>
        <figure class="ceiling one"></figure>
        <figure class="floor one"></figure>
        <figure class="line two"></figure>
        <figure class="ceiling two"></figure>
        <figure class="floor two"></figure>
        <figure class="line three"></figure>
        <figure class="ceiling three"></figure>
        <figure class="floor three"></figure>
        <figure class="line four"></figure>
        <figure class="ceiling four"></figure>
        <figure class="floor four"></figure>
      </figure>
      <figure class="leftside">
        <figure class="bottom"></figure>
        <figure class="line one"></figure>
        <figure class="ceiling one"></figure>
        <figure class="floor one"></figure>
        <figure class="line two"></figure>
        <figure class="ceiling two"></figure>
        <figure class="floor two"></figure>
        <figure class="line three"></figure>
        <figure class="ceiling three"></figure>
        <figure class="floor three"></figure>
        <figure class="line four"></figure>
        <figure class="ceiling four"></figure>
        <figure class="floor four"></figure>
      </figure>
      <figure class="topside">
        <figure class="left"></figure>
        <figure class="right"></figure>
      </figure>
      <figure class="bottomside">
        <figure class="side"></figure>
      </figure>
    </div>
  </section>
`;

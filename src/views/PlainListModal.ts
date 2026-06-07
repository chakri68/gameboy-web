import { el } from "../dom";
import { icon } from "../icons";

/**
 * Shows the build-time "plain list" (#rom-fallback-wrap, injected for crawlers /
 * no-JS) inside a modal instead of a scroll-up section. The list node is relocated
 * into the modal panel on first open and kept there, so it still exists in the
 * static HTML for crawlers but is presented as a popup at runtime.
 */
export class PlainListModal {
  readonly el: HTMLElement;
  private onKey: (e: KeyboardEvent) => void;
  private closeBtn: HTMLButtonElement;
  private isOpen = false;

  constructor() {
    this.closeBtn = el(
      "button",
      { class: "icon-btn", type: "button", "aria-label": "Close" },
      [icon("close")],
    );
    this.closeBtn.addEventListener("click", () => this.close());

    const panel = el(
      "div",
      {
        class: "overlay__panel plainlist__panel",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Project list",
      },
      [
        el("div", { class: "plainlist__head" }, [
          el("h2", { class: "overlay__title", text: "Projects" }),
          this.closeBtn,
        ]),
      ],
    );

    // Relocate the crawlable fallback list into the panel (or a note if absent).
    const wrap = document.getElementById("rom-fallback-wrap");
    if (wrap) {
      wrap.style.display = "block"; // override `.js-ready #rom-fallback-wrap { display:none }`
      panel.append(wrap);
    } else {
      panel.append(
        el("p", {
          class: "cart-modal__blurb",
          text: "No project list available.",
        }),
      );
    }

    this.el = el("div", { class: "overlay plainlist" }, [panel]);
    this.el.addEventListener("click", (e) => {
      if (e.target === this.el) this.close();
    });

    // Esc closes; capture + stop so the global key handler doesn't also act on it.
    this.onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    };
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    document.body.appendChild(this.el);
    document.addEventListener("keydown", this.onKey, true);
    this.closeBtn.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.remove();
    document.removeEventListener("keydown", this.onKey, true);
  }
}

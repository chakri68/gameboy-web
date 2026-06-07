import { el } from "../dom";
import type { Screen } from "./Screen";

export interface ConsoleHandlers {
  onA: () => void; // insert / confirm / skip boot
  onB: () => void; // eject
  onStart: () => void; // all-ROMs overlay
  onDpad: (dir: "left" | "right" | "up" | "down") => void;
}

/**
 * Handheld body (spec §6): screen + D-pad + A/B + Start/Select + L/R nubs +
 * power LED + speaker grille. Pure CSS/SVG; the on-screen controls mirror the keyboard.
 */
export class Console {
  readonly el: HTMLElement;
  private led: HTMLElement;

  constructor(screen: Screen, handlers: ConsoleHandlers) {
    this.led = el("span", { class: "led is-off", "aria-hidden": "true" });

    const dpad = el("div", { class: "dpad", role: "group", "aria-label": "D-pad" }, [
      el("span", { class: "dpad__v" }),
      el("span", { class: "dpad__h" }),
    ]);
    // Quadrant clicks on the d-pad map to directions.
    dpad.addEventListener("click", (e) => {
      const r = dpad.getBoundingClientRect();
      const x = (e as MouseEvent).clientX - r.left - r.width / 2;
      const y = (e as MouseEvent).clientY - r.top - r.height / 2;
      if (Math.abs(x) > Math.abs(y)) handlers.onDpad(x < 0 ? "left" : "right");
      else handlers.onDpad(y < 0 ? "up" : "down");
    });

    const btnA = el("button", { class: "btn-round", type: "button", "aria-label": "A button (select)", text: "A" });
    const btnB = el("button", { class: "btn-round", type: "button", "aria-label": "B button (eject)", text: "B" });
    btnA.addEventListener("click", handlers.onA);
    btnB.addEventListener("click", handlers.onB);

    const start = el("button", { class: "pill", type: "button", "aria-label": "Start — all ROMs", text: "START" });
    const select = el("button", { class: "pill", type: "button", "aria-label": "Select", text: "SELECT" });
    start.addEventListener("click", handlers.onStart);
    select.addEventListener("click", handlers.onStart);

    this.el = el("div", { class: "console", role: "group", "aria-label": "Handheld console" }, [
      el("div", { class: "console__shoulder console__shoulder--l", "aria-hidden": "true" }),
      el("div", { class: "console__shoulder console__shoulder--r", "aria-hidden": "true" }),
      el("div", { class: "console__brandbar" }, [
        el("span", { class: "console__wordmark", text: "CHAKRI" }),
        this.led,
      ]),
      el("div", { class: "console__bezel" }, [screen.el]),
      el("div", { class: "console__controls" }, [
        dpad,
        el("div", { class: "btn-ab" }, [btnB, btnA]),
      ]),
      el("div", { class: "console__startsel" }, [select, start]),
      el("div", { class: "console__speaker", "aria-hidden": "true" }),
    ]);
  }

  setPower(on: boolean): void {
    this.led.classList.toggle("is-off", !on);
  }
}

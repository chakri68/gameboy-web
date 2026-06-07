import { el } from "../dom";
import { icon } from "../icons";

export interface ControlsHandlers {
  onEject: () => void;
  onToggleSound: () => void;
  onShuffle: () => void;
}

/** Floating control cluster (spec §6): eject/power, sound toggle, shuffle. */
export class Controls {
  readonly el: HTMLElement;
  private soundBtn: HTMLButtonElement;

  constructor(handlers: ControlsHandlers) {
    const eject = el(
      "button",
      {
        class: "icon-btn",
        type: "button",
        "aria-label": "Eject / back to shelf",
        title: "Eject (Esc)",
      },
      [icon("undo")],
    );
    this.soundBtn = el(
      "button",
      {
        class: "icon-btn",
        type: "button",
        "aria-label": "Toggle sound",
        title: "Sound",
      },
      [icon("volume-off")],
    );
    const shuffle = el(
      "button",
      {
        class: "icon-btn",
        type: "button",
        "aria-label": "Shuffle - random ROM",
        title: "Shuffle",
      },
      [icon("shuffle")],
    );

    eject.addEventListener("click", handlers.onEject);
    this.soundBtn.addEventListener("click", handlers.onToggleSound);
    shuffle.addEventListener("click", handlers.onShuffle);

    this.el = el(
      "div",
      { class: "controls", role: "toolbar", "aria-label": "Controls" },
      [shuffle, this.soundBtn, eject],
    );
  }

  setSound(on: boolean): void {
    this.soundBtn.replaceChildren(icon(on ? "volume-on" : "volume-off"));
    this.soundBtn.setAttribute("aria-pressed", String(on));
  }
}

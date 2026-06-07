import type { Screen } from "./Screen";

export interface GameBoyHandlers {
  onA: () => void; // insert / skip boot / expand
  onB: () => void; // collapse / eject
  onStart: () => void; // all-ROMs overlay
  onSelect: () => void; // toggle sound
  onDpad: (dir: "left" | "right" | "up" | "down") => void;
  onPower: () => void; // power slider toggles insert/eject
}

/**
 * Realistic DMG-01 Game Boy (spec §6) - markup + chrome vendored from
 * Martin Gauer's MIT-licensed CSS Game Boy (see src/gameboy.css). This view owns
 * the device DOM, mounts the live LCD inside its green screen, wires the physical
 * controls to Stage actions, and adds tactile `.btnPressed` feedback. The handheld
 * stays mounted for the session; only the LCD content churns.
 */
export class GameBoy {
  readonly el: HTMLElement;

  // Cached control nodes so keyboard input can flash the matching button.
  private buttons: Record<string, HTMLElement> = {};

  constructor(screen: Screen, h: GameBoyHandlers) {
    const root = document.createElement("div");
    root.className = "gameboy";
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "Handheld game console");
    root.innerHTML = TEMPLATE;
    this.el = root;

    // Mount the live LCD inside the device's green screen.
    const screenHole = root.querySelector<HTMLElement>(".screen")!;
    screenHole.append(screen.el);

    // --- wire the physical controls -------------------------------------
    const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;
    this.bind(
      (this.buttons.a = q("#controller_a")),
      "A - select / play",
      h.onA,
    );
    this.bind((this.buttons.b = q("#controller_b")), "B - back / eject", h.onB);
    this.bind(
      (this.buttons.start = q("#controller_start")),
      "Start - all ROMs",
      h.onStart,
    );
    this.bind(
      (this.buttons.select = q("#controller_select")),
      "Select - toggle sound",
      h.onSelect,
    );
    this.bind((this.buttons.up = q("#controller_up")), "Up", () =>
      h.onDpad("up"),
    );
    this.bind((this.buttons.down = q("#controller_down")), "Down", () =>
      h.onDpad("down"),
    );
    this.bind((this.buttons.left = q("#controller_left")), "Left", () =>
      h.onDpad("left"),
    );
    this.bind((this.buttons.right = q("#controller_right")), "Right", () =>
      h.onDpad("right"),
    );

    // Power slider (front headline) + power button (bottom) both toggle power.
    const power = () => h.onPower();
    this.bind(q(".on-off"), "Power", power);
    this.bind(q(".power-button"), "Power", power);
  }

  /** Toggle the lit battery LED + power-button position. */
  setPower(on: boolean): void {
    this.el.classList.toggle("power-on", on);
  }

  /** Briefly press a control in response to a keyboard event. */
  flash(
    name: "a" | "b" | "start" | "select" | "left" | "right" | "up" | "down",
  ): void {
    const node = this.buttons[name];
    if (!node) return;
    node.classList.add("btnPressed");
    window.setTimeout(() => node.classList.remove("btnPressed"), 120);
  }

  // Add click + pointer-hold feedback + a11y affordances to a control node.
  private bind(node: HTMLElement, label: string, onClick: () => void): void {
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", label);
    node.tabIndex = -1; // keyboard is handled globally; avoid a tab-stop per pixel-button
    const press = () => node.classList.add("btnPressed");
    const release = () => node.classList.remove("btnPressed");
    node.addEventListener("pointerdown", press);
    node.addEventListener("pointerup", release);
    node.addEventListener("pointerleave", release);
    node.addEventListener("pointercancel", release);
    node.addEventListener("click", (e) => {
      e.preventDefault();
      onClick();
    });
  }
}

// DMG front-plate markup (vendored from css-gameboy index.html). The `.screen`
// is left empty; the live LCD is appended into it at runtime.
const TEMPLATE = /* html */ `
  <div class="front-plate">
    <div class="front-plate-head">
      <div class="vertical-stripe"></div>
      <div class="vertical-stripe"></div>
      <div class="vertical-stripe"></div>
      <div class="vertical-gouge vertical-gouge-1"></div>
      <div class="vertical-gouge vertical-gouge-2"></div>
      <div class="on-off">
        <div class="spike spike-left"><div></div></div>
        <div class="spike spike-right"><div></div></div>
        <span>OFF<i></i>ON</span>
      </div>
    </div>

    <div class="screen-container">
      <div class="screen-headline"><span>DOT MATRIX WITH STEREO SOUND</span></div>
      <div class="battery-light"><span>BATTERY</span></div>
      <div class="screen"></div>
    </div>

    <div class="logo"></div>

    <div id="controller">
      <div class="buttons-a-b">
        <div class="button-b button-key-j" id="controller_b"></div>
        <div class="button-a button-key-k" id="controller_a"></div>
      </div>
      <div class="start button-key-m" id="controller_start"><div></div></div>
      <div class="select button-key-n" id="controller_select"><div></div></div>
      <div class="cross-container">
        <div class="spike"><div></div></div>
        <div class="spike"><div></div></div>
        <div class="spike"><div></div></div>
        <div class="spike"><div></div></div>
        <div class="cross" id="controller_dpad">
          <div class="top-down">
            <div class="button-top button-key-w" id="controller_up">
              <div class="button-stripe"></div>
              <div class="button-stripe"></div>
              <div class="button-stripe"></div>
            </div>
            <div class="button-bottom button-key-s" id="controller_down">
              <div class="button-stripe"></div>
              <div class="button-stripe"></div>
              <div class="button-stripe"></div>
            </div>
          </div>
          <div class="left-right">
            <div class="button-left button-key-a" id="controller_left">
              <div class="button-stripe"></div>
              <div class="button-stripe"></div>
              <div class="button-stripe"></div>
            </div>
            <div class="button-right button-key-d" id="controller_right">
              <div class="button-stripe"></div>
              <div class="button-stripe"></div>
              <div class="button-stripe"></div>
            </div>
          </div>
          <div class="cross-middle-bumb"></div>
        </div>
      </div>
    </div>

    <div class="speaker">
      <div><div class="speaker-inner-shadow"></div></div>
      <div><div class="speaker-inner-shadow"></div></div>
      <div><div class="speaker-inner-shadow"></div></div>
      <div><div class="speaker-inner-shadow"></div></div>
      <div><div class="speaker-inner-shadow"></div></div>
      <div><div class="speaker-inner-shadow"></div></div>
    </div>

    <div class="phones" id="volume-switch">
      <div class="vertical-stripe"></div>
      <div class="vertical-stripe"></div>
      <div class="vertical-stripe"></div>
      <i></i>
      <span>PHONES</span>
    </div>
  </div>

  <div class="power-button"><div></div></div>
`;

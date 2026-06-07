import { el, prefersReducedMotion } from "../dom";
import { store } from "../store";
import type { State } from "../store";
import type { Rom } from "../schema";
import { allEnabledRoms } from "../content";
import { Shelf } from "./Shelf";
import { Screen } from "./Screen";
import { Console } from "./Console";
import { Controls } from "./Controls";
import { AllRomsOverlay } from "./AllRomsOverlay";
import { playBoot, playMove, playSelect, playEject } from "../sound";

const INSERT_MS = 360;
const ZOOM_MS = 700;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * Stage (spec §6): owns the store subscription, scene transitions, and the
 * camera zoom. Mounts Shelf + Console once; only the Screen content churns, so the
 * demo iframe is never recreated by unrelated state changes.
 */
export class Stage {
  private root: HTMLElement;
  private camera: HTMLElement;
  private shelf: Shelf;
  private screen: Screen;
  private console: Console;
  private controls: Controls;
  private overlay: AllRomsOverlay | null = null;
  private ejectFab: HTMLButtonElement;

  private zoomTransform = "none";
  private lastRomId: string | null = null; // for focus restore

  constructor(root: HTMLElement) {
    this.root = root;

    this.shelf = new Shelf((rom) => this.insert(rom));
    this.screen = new Screen({
      onEject: () => this.eject(),
      isSoundOn: () => store.get().soundOn,
      onBootBlip: () => playBoot(),
    });
    this.console = new Console(this.screen, {
      onA: () => this.pressA(),
      onB: () => this.eject(),
      onStart: () => this.toggleOverlay(),
      onDpad: (dir) => this.dpad(dir),
    });
    this.controls = new Controls({
      onEject: () => this.eject(),
      onToggleSound: () => this.toggleSound(),
      onShuffle: () => this.shuffle(),
    });

    this.camera = el("div", { class: "camera" }, [this.console.el]);
    this.ejectFab = el("button", { class: "eject-fab", type: "button", "aria-label": "Eject", text: "⏏" });
    this.ejectFab.addEventListener("click", () => this.eject());

    const footerBtn = el("button", { type: "button", text: "Skip the arcade — plain list" });
    footerBtn.addEventListener("click", () => this.revealPlainList());
    const footer = el("footer", { class: "footer" }, [
      el("span", { text: "chakri.me — pick a cartridge · " }),
      footerBtn,
    ]);

    const stage = el("div", { class: "stage" }, [this.camera, this.shelf.el]);
    this.root.append(this.controls.el, stage, footer, this.ejectFab);

    this.shelf.render(store.get().unlocked);
    store.subscribe((s) => this.update(s));
    this.update(store.get());
  }

  // ---------- declarative sync (runs on every store change) ----------
  private update(s: State): void {
    const mode = s.scene.mode;
    const onShelf = mode === "shelf";

    // Hide the shelf tray once a ROM is filling the screen. The camera is centered
    // and the shelf is out of flow, so toggling it never shifts the console.
    const immersive = mode === "booting" || mode === "loaded" || mode === "ejecting";
    document.body.classList.toggle("immersive", immersive);
    this.shelf.el.setAttribute("aria-hidden", String(!onShelf));
    this.console.setPower(!onShelf);
    this.controls.setSound(s.soundOn);

    if (onShelf) this.shelf.setSelected(s.selection);

    // Mobile eject FAB only while a demo fills the screen.
    this.ejectFab.style.display = mode === "loaded" ? "block" : "none";

    // Overlay lifecycle
    if (s.overlayOpen && !this.overlay) {
      this.overlay = new AllRomsOverlay(
        (rom) => {
          store.set({ overlayOpen: false });
          this.insert(rom);
        },
        () => store.set({ overlayOpen: false })
      );
      this.overlay.render(s.unlocked);
      this.root.append(this.overlay.el);
    } else if (!s.overlayOpen && this.overlay) {
      this.overlay.el.remove();
      this.overlay = null;
    }
  }

  // ---------- actions ----------
  insert(rom: Rom): void {
    const mode = store.get().scene.mode;
    if (mode !== "shelf") return;
    this.lastRomId = rom.id;
    if (store.get().soundOn) playSelect();

    store.setScene({ mode: "inserting", rom });
    window.setTimeout(() => {
      store.setScene({ mode: "booting", rom });
      this.screen.boot(rom, () => {
        store.setScene({ mode: "loaded", rom });
        this.screen.showContent(rom);
        this.zoomIn();
        this.focusScreen();
      });
    }, prefersReducedMotion() ? 0 : INSERT_MS);
  }

  eject(): void {
    const scene = store.get().scene;
    if (scene.mode === "shelf" || scene.mode === "ejecting") return;
    const rom = "rom" in scene ? scene.rom : null;
    if (store.get().soundOn) playEject();

    store.setScene({ mode: "ejecting", rom: rom! });
    const finish = () => {
      this.screen.clear();
      store.setScene({ mode: "shelf" });
      if (this.lastRomId) this.shelf.focusRom(this.lastRomId);
    };
    this.zoomOut(finish);
  }

  /** A / Enter: skip boot if booting, else insert the current selection. */
  pressA(): void {
    if (this.screen.trySkipBoot()) return;
    const s = store.get();
    if (s.scene.mode !== "shelf") return;
    const rom = this.shelf.roms[s.selection];
    if (rom) this.insert(rom);
  }

  dpad(dir: "left" | "right" | "up" | "down"): void {
    if (store.get().scene.mode !== "shelf") return;
    if (dir === "up" || dir === "down") return;
    this.moveSelection(dir === "left" ? -1 : 1);
  }

  moveSelection(delta: number): void {
    const s = store.get();
    if (s.scene.mode !== "shelf") return;
    const n = this.shelf.roms.length;
    if (n === 0) return;
    const next = (s.selection + delta + n) % n;
    store.set({ selection: next });
    if (s.soundOn) playMove();
  }

  toggleOverlay(): void {
    store.set({ overlayOpen: !store.get().overlayOpen });
  }

  closeOverlay(): void {
    if (store.get().overlayOpen) store.set({ overlayOpen: false });
  }

  toggleSound(): void {
    store.set({ soundOn: !store.get().soundOn });
  }

  shuffle(): void {
    const roms = allEnabledRoms(store.get().unlocked);
    if (roms.length === 0) return;
    // Index-based pick (no Math.random dependency on a single call site is fine here).
    const idx = Math.floor(Math.random() * roms.length);
    const rom = roms[idx];
    if (store.get().scene.mode === "shelf") this.insert(rom);
  }

  unlock(): void {
    if (store.get().unlocked) return;
    store.set({ unlocked: true });
    this.shelf.render(true);
    this.overlay?.render(true);
  }

  // ---------- camera zoom (spec §8) ----------
  private zoomIn(): void {
    const scr = this.screen.el.getBoundingClientRect();
    const cam = this.camera.getBoundingClientRect();
    if (!scr.width || !cam.width) return;

    const targetW = Math.min(window.innerWidth * 0.92, 1100);
    const targetH = Math.min(window.innerHeight * 0.8, 720);
    const s = Math.min(targetW / scr.width, targetH / scr.height);

    const Cx = cam.left + cam.width / 2;
    const Cy = cam.top + cam.height / 2;
    const Sx = scr.left + scr.width / 2;
    const Sy = scr.top + scr.height / 2;
    const Tx = window.innerWidth / 2 - Cx - s * (Sx - Cx);
    const Ty = window.innerHeight / 2 - Cy - s * (Sy - Cy);

    this.zoomTransform = `translate(${Tx.toFixed(1)}px, ${Ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
    this.camera.style.transform = this.zoomTransform;

    if (prefersReducedMotion()) {
      this.screen.fitIframe();
      return;
    }
    const anim = this.camera.animate(
      [{ transform: "none" }, { transform: this.zoomTransform }],
      { duration: ZOOM_MS, easing: EASE }
    );
    anim.onfinish = () => this.screen.fitIframe();
  }

  private zoomOut(done: () => void): void {
    const from = this.zoomTransform;
    this.camera.style.transform = "none";
    this.zoomTransform = "none";

    if (prefersReducedMotion() || from === "none") {
      done();
      return;
    }
    const anim = this.camera.animate(
      [{ transform: from }, { transform: "none" }],
      { duration: ZOOM_MS, easing: EASE }
    );
    anim.onfinish = done;
    anim.oncancel = done;
  }

  private focusScreen(): void {
    const focusable = this.screen.el.querySelector<HTMLElement>("a, button, iframe");
    (focusable ?? this.screen.el).focus?.();
  }

  private revealPlainList(): void {
    const list = document.getElementById("rom-fallback-wrap");
    if (list) {
      list.style.display = "block";
      list.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }
}

import { el, prefersReducedMotion } from "../dom";
import { store } from "../store";
import type { State } from "../store";
import type { Rom } from "../schema";
import { allEnabledRoms, romById } from "../content";
import { GameList } from "./GameList";
import { Screen } from "./Screen";
import { GameBoy } from "./GameBoy";
import { Controls } from "./Controls";
import { AllRomsOverlay } from "./AllRomsOverlay";
import { CartridgePopup } from "./CartridgePopup";
import { PlainListModal } from "./PlainListModal";
import { icon } from "../icons";
import { playBoot, playMove, playSelect, playEject } from "../sound";

const INSERT_MS = 360;
const ZOOM_MS = 700;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * Stage (spec §6): owns the store subscription, scene transitions, and the
 * camera zoom. Mounts the game list + Game Boy once; only the LCD content churns, so the
 * demo iframe is never recreated by unrelated state changes.
 *
 * Hybrid view: a picked ROM boots and plays *inside* the small green LCD; pressing
 * A (or the play badge) zooms the camera so the LCD fills the viewport. B / Esc
 * collapses back to the handheld, and again ejects the cartridge.
 */
export class Stage {
  private root: HTMLElement;
  private camera: HTMLElement;
  private list: GameList;
  private screen: Screen;
  private gameboy: GameBoy;
  private controls: Controls;
  private overlay: AllRomsOverlay | null = null;
  private cartModal: CartridgePopup | null = null;
  private plainList: PlainListModal | null = null;
  private backFab: HTMLButtonElement;
  private playHint: HTMLButtonElement;

  private zoomTransform = "none";
  private lastRomId: string | null = null; // for focus restore

  constructor(root: HTMLElement) {
    this.root = root;

    this.list = new GameList((rom) => this.openCartridge(rom));
    this.screen = new Screen({
      onEject: () => this.back(),
      isSoundOn: () => store.get().soundOn,
      onBootBlip: () => playBoot(),
    });
    this.gameboy = new GameBoy(this.screen, {
      onA: () => this.pressA(),
      onB: () => this.back(),
      onStart: () => this.toggleOverlay(),
      onSelect: () => this.toggleSound(),
      onDpad: (dir) => this.dpad(dir),
      onPower: () => this.pressPower(),
    });
    this.controls = new Controls({
      onEject: () => this.back(),
      onToggleSound: () => this.toggleSound(),
      onShuffle: () => this.shuffle(),
    });

    this.camera = el("div", { class: "camera" }, [this.gameboy.el]);

    this.backFab = el(
      "button",
      { class: "eject-fab", type: "button", "aria-label": "Back / eject" },
      [icon("close")],
    );
    this.backFab.addEventListener("click", () => this.back());

    this.playHint = el("button", { class: "play-hint", type: "button" }, [
      el("span", { class: "play-hint__key", text: "A" }),
      el("span", { text: "PRESS TO PLAY" }),
    ]) as HTMLButtonElement;
    this.playHint.addEventListener("click", () => this.expand());

    const footerBtn = el("button", {
      type: "button",
      text: "Skip the arcade - plain list",
    });
    footerBtn.addEventListener("click", () => this.openPlainList());
    const footer = el("footer", { class: "footer" }, [
      el("span", { text: "chakri.me - pick a cartridge · " }),
      footerBtn,
    ]);

    const stage = el("div", { class: "stage" }, [this.camera, this.list.el]);
    this.root.append(
      this.controls.el,
      stage,
      footer,
      this.backFab,
      this.playHint,
    );

    this.list.render(store.get().unlocked);
    store.subscribe((s) => this.update(s));
    this.update(store.get());
  }

  // ---------- declarative sync (runs on every store change) ----------
  private update(s: State): void {
    const mode = s.scene.mode;
    const onShelf = mode === "shelf";
    const loaded = mode === "loaded";

    // The handheld is always visible; "immersive" (hide list + footer) kicks in
    // only when a demo is zoomed up to fill the viewport.
    document.body.classList.toggle("immersive", s.expanded);
    this.list.el.setAttribute("aria-hidden", String(!onShelf));

    // Battery LED + power button light up whenever a cartridge is in.
    this.gameboy.setPower(!onShelf);
    this.controls.setSound(s.soundOn);

    if (onShelf) this.list.setSelected(s.selection);

    // "Press A to play" badge while a demo idles in the LCD; back FAB while expanded.
    this.playHint.style.display = loaded && !s.expanded ? "flex" : "none";
    this.backFab.style.display = s.expanded ? "grid" : "none";

    // Cartridge preview lifecycle (rebuild when the previewed ROM changes).
    if (s.previewId && this.cartModal?.romId !== s.previewId) {
      this.cartModal?.el.remove();
      const rom = romById(s.previewId);
      if (rom) {
        this.cartModal = new CartridgePopup(
          rom,
          () => this.loadPreview(),
          () => this.closePreview(),
        );
        this.root.append(this.cartModal.el);
      }
    } else if (!s.previewId && this.cartModal) {
      this.cartModal.el.remove();
      this.cartModal = null;
    }

    // Overlay lifecycle
    if (s.overlayOpen && !this.overlay) {
      this.overlay = new AllRomsOverlay(
        (rom) => {
          store.set({ overlayOpen: false });
          this.openCartridge(rom);
        },
        () => store.set({ overlayOpen: false }),
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
    window.setTimeout(
      () => {
        store.setScene({ mode: "booting", rom });
        this.screen.boot(rom, () => {
          store.setScene({ mode: "loaded", rom });
          this.screen.showContent(rom);
          // Stays in the LCD; the player presses A (or the badge) to go fullscreen.
        });
      },
      prefersReducedMotion() ? 0 : INSERT_MS,
    );
  }

  /** Zoom the loaded demo up out of the LCD to fill the viewport. */
  expand(): void {
    const s = store.get();
    if (s.scene.mode !== "loaded" || s.expanded) return;
    store.set({ expanded: true });
    this.zoomIn();
    // Hand the keyboard to the demo: focus the iframe so the cross-origin game
    // consumes key presses. The site key handler stands down while expanded
    // (see main.ts); the on-screen eject FAB is the always-available exit.
    this.screen.focusInteractive();
  }

  /** Zoom back down into the handheld LCD (cartridge stays in). */
  collapse(): void {
    if (!store.get().expanded) return;
    store.set({ expanded: false });
    this.zoomOut(() => {});
  }

  // ---------- cartridge preview ----------
  /** Open the spinning-cartridge preview for a ROM (Load confirms, Close dismisses). */
  openCartridge(rom: Rom): void {
    if (store.get().scene.mode !== "shelf") return;
    if (store.get().soundOn) playMove();
    store.set({ previewId: rom.id });
  }

  closePreview(): void {
    if (store.get().previewId) store.set({ previewId: null });
  }

  /** Load button: dismiss the preview and run the real insert. */
  loadPreview(): void {
    const id = store.get().previewId;
    if (!id) return;
    const rom = romById(id);
    store.set({ previewId: null });
    if (rom) this.insert(rom);
  }

  /** B / Esc / eject FAB: close preview, else collapse if expanded, else eject. */
  back(): void {
    if (store.get().previewId) {
      this.closePreview();
      return;
    }
    if (store.get().expanded) {
      this.collapse();
      return;
    }
    this.eject();
  }

  /** Power off: remove the cartridge and return to the shelf. */
  eject(): void {
    const scene = store.get().scene;
    if (scene.mode === "shelf" || scene.mode === "ejecting") return;
    const rom = "rom" in scene ? scene.rom : null;
    if (store.get().soundOn) playEject();

    const wasExpanded = store.get().expanded;
    store.setScene({ mode: "ejecting", rom: rom! });
    const finish = () => {
      this.screen.clear();
      store.set({ scene: { mode: "shelf" }, expanded: false });
      if (this.lastRomId) this.list.focusRom(this.lastRomId);
    };
    // If we were zoomed in, animate back out first; otherwise finish immediately.
    if (wasExpanded) this.zoomOut(finish);
    else finish();
  }

  /** A / Enter: skip boot, load a previewed cart, open a cart, or expand the demo. */
  pressA(): void {
    this.gameboy.flash("a");
    if (this.screen.trySkipBoot()) return;
    if (store.get().previewId) {
      this.loadPreview();
      return;
    }
    const s = store.get();
    if (s.scene.mode === "shelf") {
      const rom = this.list.roms[s.selection];
      if (rom) this.openCartridge(rom);
    } else if (s.scene.mode === "loaded" && !s.expanded) {
      this.expand();
    }
  }

  /** Power slider: open the selected cart on the shelf, or eject when a cart is in. */
  pressPower(): void {
    if (store.get().previewId) {
      this.loadPreview();
      return;
    }
    if (store.get().scene.mode === "shelf") {
      const rom = this.list.roms[store.get().selection];
      if (rom) this.openCartridge(rom);
    } else {
      this.eject();
    }
  }

  dpad(dir: "left" | "right" | "up" | "down"): void {
    this.gameboy.flash(dir);
    if (store.get().scene.mode !== "shelf" || store.get().previewId) return;
    if (dir === "up" || dir === "down") return;
    this.moveSelection(dir === "left" ? -1 : 1);
  }

  moveSelection(delta: number): void {
    const s = store.get();
    if (s.scene.mode !== "shelf" || s.previewId) return;
    const n = this.list.roms.length;
    if (n === 0) return;
    const next = (s.selection + delta + n) % n;
    store.set({ selection: next });
    if (s.soundOn) playMove();
  }

  toggleOverlay(): void {
    this.gameboy.flash("start");
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
    const idx = Math.floor(Math.random() * roms.length);
    const rom = roms[idx];
    if (store.get().scene.mode === "shelf") this.insert(rom);
  }

  unlock(): void {
    if (store.get().unlocked) return;
    store.set({ unlocked: true });
    this.list.render(true);
    this.overlay?.render(true);
  }

  // ---------- camera zoom (spec §8) ----------
  private zoomIn(): void {
    const scr = this.screen.el.getBoundingClientRect();
    const cam = this.camera.getBoundingClientRect();
    if (!scr.width || !cam.width) return;

    const targetW = Math.min(window.innerWidth * 0.94, 1200);
    const targetH = Math.min(window.innerHeight * 0.86, 860);
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
      { duration: ZOOM_MS, easing: EASE },
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
      { duration: ZOOM_MS, easing: EASE },
    );
    anim.onfinish = done;
    anim.oncancel = done;
  }

  private openPlainList(): void {
    if (!this.plainList) this.plainList = new PlainListModal();
    this.plainList.open();
  }
}

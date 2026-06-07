import { el, prefersReducedMotion } from "../dom";
import type { Rom } from "../schema";
import { createLaunchCard } from "./LaunchCard";
import { createInfoRom } from "./InfoRom";

const LOGICAL_W = 1280; // logical desktop width the iframe renders at, then scaled to fit
const BOOT_MS = 1200;
const FRAME_TIMEOUT_MS = 6000;

interface ScreenCallbacks {
  onEject: () => void;
  isSoundOn: () => boolean;
  onBootBlip: () => void;
}

/**
 * The glass (spec §6/§7/§8). Owns the boot animation and the single demo iframe
 * lifecycle: exactly one iframe alive at a time, created on load, destroyed on clear.
 */
export class Screen {
  readonly el: HTMLElement;
  private content: HTMLElement;
  private cb: ScreenCallbacks;

  private iframe: HTMLIFrameElement | null = null;
  private frameTimer: number | null = null;
  private bootTimer: number | null = null;
  private skipBoot: (() => void) | null = null;
  private resizeHandler = () => this.fitIframe();

  constructor(cb: ScreenCallbacks) {
    this.cb = cb;
    this.content = el("div", { class: "screen__content" });
    this.el = el("div", { class: "screen", role: "group", "aria-label": "Console screen" }, [
      this.content,
      el("div", { class: "screen__scanlines", "aria-hidden": "true" }),
      el("div", { class: "screen__glare", "aria-hidden": "true" }),
    ]);
    window.addEventListener("resize", this.resizeHandler, { passive: true });
  }

  /** Play the boot sequence, then call onComplete. Skippable via A / click. */
  boot(_rom: Rom, onComplete: () => void): void {
    this.clear();
    if (this.cb.isSoundOn()) this.cb.onBootBlip();

    const wordmark = el("div", { class: "boot__wordmark", text: "CHAKRI" });
    const overlay = el("div", { class: "boot", role: "status", "aria-label": "Booting" }, [
      el("div", { class: "boot__sweep", "aria-hidden": "true" }),
      wordmark,
      el("div", { class: "boot__hint", text: "press A to skip" }),
    ]);
    this.content.append(overlay);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      this.skipBoot = null;
      if (this.bootTimer) clearTimeout(this.bootTimer);
      overlay.remove();
      onComplete();
    };
    this.skipBoot = finish;

    overlay.addEventListener("click", finish);
    const dur = prefersReducedMotion() ? 200 : BOOT_MS;
    this.bootTimer = window.setTimeout(finish, dur);
  }

  /** True while the boot overlay is showing (so A/click can skip it). */
  trySkipBoot(): boolean {
    if (this.skipBoot) {
      this.skipBoot();
      return true;
    }
    return false;
  }

  /** Render the loaded content per display type. */
  showContent(rom: Rom): void {
    this.clearContentOnly();
    switch (rom.display) {
      case "embed":
        this.mountEmbed(rom);
        break;
      case "launch":
        this.content.append(createLaunchCard(rom));
        break;
      case "info":
        this.content.append(createInfoRom(rom, this.cb.onEject));
        break;
    }
  }

  private mountEmbed(rom: Rom): void {
    const wrap = el("div", { class: "embed-wrap" });
    const iframe = document.createElement("iframe");
    iframe.src = rom.demo!;
    iframe.title = `${rom.title} demo`;
    iframe.loading = "lazy";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-forms");
    iframe.setAttribute("allow", "accelerometer; gyroscope; magnetometer; fullscreen");
    wrap.append(iframe);
    this.content.append(wrap);
    this.iframe = iframe;

    let settled = false;
    const fallback = () => {
      if (settled) return;
      settled = true;
      this.teardownIframe();
      this.clearContentOnly();
      this.content.append(createLaunchCard(rom, { fallback: true }));
    };
    // Best-effort: a frame that never fires load within the timeout is treated as
    // blocked and falls back. (Cross-origin framing cannot be detected reliably at
    // runtime — build-time verification per §7.4 is the authoritative check.)
    iframe.addEventListener("load", () => {
      if (settled) return;
      settled = true;
      if (this.frameTimer) clearTimeout(this.frameTimer);
    });
    this.frameTimer = window.setTimeout(fallback, FRAME_TIMEOUT_MS);

    requestAnimationFrame(() => this.fitIframe());
  }

  /** Re-fit the iframe so the demo renders at desktop width, scaled into the glass. */
  fitIframe(): void {
    if (!this.iframe) return;
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    if (!w || !h) return;
    const scale = w / LOGICAL_W;
    this.iframe.style.width = `${LOGICAL_W}px`;
    this.iframe.style.height = `${h / scale}px`;
    this.iframe.style.transform = `scale(${scale})`;
  }

  private teardownIframe(): void {
    if (this.frameTimer) {
      clearTimeout(this.frameTimer);
      this.frameTimer = null;
    }
    if (this.iframe) {
      this.iframe.src = "about:blank";
      this.iframe.remove();
      this.iframe = null;
    }
  }

  private clearContentOnly(): void {
    this.teardownIframe();
    this.content.replaceChildren();
  }

  clear(): void {
    if (this.bootTimer) clearTimeout(this.bootTimer);
    this.bootTimer = null;
    this.skipBoot = null;
    this.clearContentOnly();
  }

  destroy(): void {
    window.removeEventListener("resize", this.resizeHandler);
    this.clear();
    this.el.remove();
  }
}

import { el, prefersReducedMotion } from "../dom";
import type { Rom } from "../schema";
import { createLaunchCard } from "./LaunchCard";
import { createInfoRom } from "./InfoRom";

const LOGICAL_W = 1280; // logical desktop width the iframe renders at, then scaled to fit
const BOOT_MS = 1200;
const FRAME_TIMEOUT_MS = 6000;

// CSS injected into the demo document so it blends into the Game Boy's green LCD
// (pea-green panel, dark-green ink, the VT323 pixel font) and reads as part of the
// screen rather than a foreign page on a black void. Kept deliberately global for
// now - just the page-level background, text colour, and font. This can only be
// applied to SAME-ORIGIN demos; the browser blocks DOM access to cross-origin
// frames (see injectScreenSkin), so off-origin demos render unskinned.
const SCREEN_SKIN_FONT =
  "https://fonts.googleapis.com/css2?family=VT323&display=swap";
const SCREEN_SKIN_CSS = /* css */ `
  html, body {
    background-color: #9bbc0f !important;
    color: #0f380f !important;
    font-family: "VT323", ui-monospace, "SF Mono", monospace !important;
  }
`;

// Cross-origin path: the same theme as structured tokens, posted to demos that opt
// in with a postMessage listener (they apply it to their own document, which their
// origin permits). Demos without the listener simply ignore it. Tokens (not a raw
// CSS string) so a spoofed message can at worst set odd colours, never inject CSS.
const SCREEN_SKIN_MESSAGE = {
  type: "gb-screen-skin",
  bg: "#9bbc0f",
  fg: "#0f380f",
  fontFamily: '"VT323", ui-monospace, "SF Mono", monospace',
  fontHref: SCREEN_SKIN_FONT,
} as const;

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

  // A cross-origin demo posts { type: "gb-screen-ready" } once its skin listener is
  // live; (re)send the theme to it. Guarded to the current demo's frame so we never
  // post to a stale or unrelated window. Covers the race where our load-time post
  // ran before the demo's listener had registered.
  private onSkinReady = (e: MessageEvent) => {
    if (
      e.data?.type === "gb-screen-ready" &&
      this.iframe &&
      e.source === this.iframe.contentWindow
    ) {
      this.postScreenSkin(this.iframe);
    }
  };

  constructor(cb: ScreenCallbacks) {
    this.cb = cb;
    this.content = el("div", { class: "lcd__content" });
    this.el = el(
      "div",
      { class: "lcd", role: "group", "aria-label": "Console screen" },
      [this.content],
    );
    window.addEventListener("resize", this.resizeHandler, { passive: true });
    // window.addEventListener("message", this.onSkinReady);
  }

  /** Play the boot sequence, then call onComplete. Skippable via A / click. */
  boot(_rom: Rom, onComplete: () => void): void {
    this.clear();
    if (this.cb.isSoundOn()) this.cb.onBootBlip();

    const wordmark = el("div", { class: "boot__wordmark", text: "CHAKRI" });
    const overlay = el(
      "div",
      { class: "boot", role: "status", "aria-label": "Booting" },
      [
        el("div", { class: "boot__sweep", "aria-hidden": "true" }),
        wordmark,
        el("div", { class: "boot__hint", text: "press A to skip" }),
      ],
    );
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
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-popups allow-forms",
    );
    iframe.setAttribute(
      "allow",
      "accelerometer; gyroscope; magnetometer; fullscreen",
    );
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
    // runtime - build-time verification per §7.4 is the authoritative check.)
    iframe.addEventListener("load", () => {
      // Skin the demo to match the Game Boy screen. Same-origin demos are styled
      // directly via the DOM; cross-origin demos are asked to skin themselves via
      // postMessage (a no-op unless they include the listener snippet). Runs on
      // every load so in-frame navigations re-skin.
      // if (!this.injectScreenSkin(iframe)) this.postScreenSkin(iframe);
      if (settled) return;
      settled = true;
      if (this.frameTimer) clearTimeout(this.frameTimer);
    });
    this.frameTimer = window.setTimeout(fallback, FRAME_TIMEOUT_MS);

    requestAnimationFrame(() => this.fitIframe());
  }

  /**
   * Same-origin path: inject the Game Boy "screen skin" (pea-green background,
   * dark-green ink, pixel font) straight into the demo document so it looks like
   * part of the LCD. Returns true when the skin is in place (applied now or already
   * present), false when the document is unreachable - i.e. a cross-origin frame,
   * whose contentDocument is null (the browser forbids styling another origin from
   * here). The caller falls back to the postMessage path on false.
   */
  private injectScreenSkin(iframe: HTMLIFrameElement): boolean {
    let doc: Document | null = null;
    try {
      doc = iframe.contentDocument;
    } catch {
      doc = null; // cross-origin: same-origin policy blocks access
    }
    if (!doc || !doc.head) return false; // cross-origin (or not yet ready)
    if (doc.getElementById("gb-screen-skin")) return true; // already skinned

    const font = doc.createElement("link");
    font.rel = "stylesheet";
    font.href = SCREEN_SKIN_FONT;
    doc.head.appendChild(font);

    const style = doc.createElement("style");
    style.id = "gb-screen-skin";
    style.textContent = SCREEN_SKIN_CSS;
    doc.head.appendChild(style);
    return true;
  }

  /**
   * Cross-origin path: ask the demo to skin itself via postMessage. Only demos that
   * include the listener snippet act on it; everything else ignores the message.
   * targetOrigin "*" is acceptable since the payload is just theme tokens - tighten
   * to specific demo origins later if desired.
   */
  private postScreenSkin(iframe: HTMLIFrameElement): void {
    iframe.contentWindow?.postMessage(SCREEN_SKIN_MESSAGE, "*");
  }

  /**
   * Focus what the player should drive: the demo iframe if there is one (so the
   * cross-origin demo consumes the keyboard), else the first interactive element
   * (launch/info card), else the screen itself.
   */
  focusInteractive(): void {
    const target =
      this.iframe ?? this.el.querySelector<HTMLElement>("a, button") ?? this.el;
    target.focus?.();
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
    // window.removeEventListener("message", this.onSkinReady);
    this.clear();
    this.el.remove();
  }
}

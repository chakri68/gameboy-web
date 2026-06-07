import "./style.css";
import { store } from "./store";
import { Stage } from "./views/Stage";
import { watchKonami } from "./konami";

const app = document.querySelector<HTMLDivElement>("#app")!;
const stage = new Stage(app);

// Signals to CSS that the interactive app is live, hiding the pre-JS fallback list.
document.documentElement.classList.add("js-ready");

// Konami unlock (↑↑↓↓←→←→ B A). Registered first; it reads keys independently of
// the navigation handler below.
watchKonami(() => stage.unlock());

// Keyboard controls (spec §9). Letter keys a/b are intentionally NOT bound here so
// they stay free for the Konami sequence; A/B are driven by the on-screen buttons.
// Arrows mirror the D-pad, Enter = A (insert / skip boot / play), Escape = B
// (collapse / eject / close overlay).
window.addEventListener("keydown", (e) => {
  if (store.get().overlayOpen) {
    if (e.key === "Escape") {
      stage.closeOverlay();
      e.preventDefault();
    }
    return;
  }
  // Playing fullscreen: the iframe owns the keyboard. We don't handle (or
  // preventDefault) any key so it flows to the focused demo — except Escape, which
  // still exits if it reaches us (i.e. focus isn't inside the cross-origin demo).
  if (store.get().expanded) {
    if (e.key === "Escape") {
      stage.back();
      e.preventDefault();
    }
    return;
  }
  switch (e.key) {
    case "ArrowLeft":
      stage.dpad("left");
      e.preventDefault();
      break;
    case "ArrowRight":
      stage.dpad("right");
      e.preventDefault();
      break;
    case "ArrowUp":
      stage.dpad("up");
      break;
    case "ArrowDown":
      stage.dpad("down");
      break;
    case "Enter":
      stage.pressA();
      e.preventDefault();
      break;
    case "Escape":
      stage.back();
      e.preventDefault();
      break;
  }
});

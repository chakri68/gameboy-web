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
// Enter = A (insert / skip boot), Escape = B (eject / close overlay).
window.addEventListener("keydown", (e) => {
  if (store.get().overlayOpen) {
    if (e.key === "Escape") {
      stage.closeOverlay();
      e.preventDefault();
    }
    return;
  }
  switch (e.key) {
    case "ArrowLeft":
      stage.moveSelection(-1);
      e.preventDefault();
      break;
    case "ArrowRight":
      stage.moveSelection(1);
      e.preventDefault();
      break;
    case "Enter":
      stage.pressA();
      e.preventDefault();
      break;
    case "Escape":
      stage.eject();
      e.preventDefault();
      break;
  }
});

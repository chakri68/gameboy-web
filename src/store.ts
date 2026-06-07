import type { Rom } from "./schema";

// Scene state machine (spec §5).
// Flow: shelf -> inserting -> booting -> loaded -> ejecting -> shelf
export type Scene =
  | { mode: "shelf" }
  | { mode: "inserting"; rom: Rom }
  | { mode: "booting"; rom: Rom }
  | { mode: "loaded"; rom: Rom }
  | { mode: "ejecting"; rom: Rom };

export type SceneMode = Scene["mode"];

export interface State {
  scene: Scene;
  /** index of the focused cart in the flat visible-rom list (shelf navigation) */
  selection: number;
  unlocked: boolean; // hidden ROMs revealed via Konami
  soundOn: boolean;
  overlayOpen: boolean; // "all ROMs" Start overlay
}

type Listener = (state: State) => void;

// Tiny central store: one state object + subscribe/emit pub-sub (spec §2).
class Store {
  private state: State;
  private listeners = new Set<Listener>();

  constructor(initial: State) {
    this.state = initial;
  }

  get(): State {
    return this.state;
  }

  /** Shallow-merge a patch and notify subscribers. */
  set(patch: Partial<State>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  /** Convenience for scene transitions. */
  setScene(scene: Scene): void {
    this.set({ scene });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }
}

export const store = new Store({
  scene: { mode: "shelf" },
  selection: 0,
  unlocked: false,
  soundOn: false,
  overlayOpen: false,
});

// Konami code (spec §9): ↑↑↓↓←→←→ B A unlocks hidden ROMs.
const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export function watchKonami(onUnlock: () => void): () => void {
  let pos = 0;
  const handler = (e: KeyboardEvent) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === SEQUENCE[pos]) {
      pos++;
      if (pos === SEQUENCE.length) {
        pos = 0;
        onUnlock();
      }
    } else {
      // allow a fresh start if the wrong key happens to be the first key
      pos = key === SEQUENCE[0] ? 1 : 0;
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

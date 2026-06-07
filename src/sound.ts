// Procedural chiptune blips via Web Audio (spec §8/§10). No audio assets.
// All playback is gated behind the sound toggle in the store.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  // Browsers start the context suspended until a user gesture.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function blip(freq: number, start: number, dur: number, type: OscillatorType = "square") {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.02);
}

/** Short rising arpeggio when the console boots. */
export function playBoot(): void {
  blip(330, 0, 0.09);
  blip(440, 0.1, 0.09);
  blip(660, 0.2, 0.16);
}

/** Tiny tick when navigating carts. */
export function playMove(): void {
  blip(520, 0, 0.04, "triangle");
}

/** Confirm blip on insert / select. */
export function playSelect(): void {
  blip(660, 0, 0.05);
  blip(880, 0.05, 0.08);
}

/** Descending blip on eject. */
export function playEject(): void {
  blip(440, 0, 0.06);
  blip(220, 0.06, 0.12);
}

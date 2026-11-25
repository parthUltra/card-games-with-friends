// Synthesized table sounds (no assets) + haptics. Everything is best-effort and silent on failure.

const MUTE_KEY = "cgwf:muted";
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY) === "1";
} catch {}

const listeners = new Set<() => void>();
export const isMuted = () => muted;
/** For useSyncExternalStore. */
export function subscribeMuted(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export function setMuted(v: boolean) {
  muted = v;
  listeners.forEach((fn) => fn());
  try {
    localStorage.setItem(MUTE_KEY, v ? "1" : "0");
  } catch {}
}

/** Call from a user gesture: browsers only allow starting audio after one. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx?.state === "suspended") void ctx.resume();
  } catch {}
}

function out() {
  if (muted || !ctx || ctx.state !== "running") return null;
  return ctx;
}

function noise(c: AudioContext, ms: number, f0: number, f1: number, gain: number, q = 1.2) {
  const len = Math.floor((c.sampleRate * ms) / 1000);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, c.currentTime);
  bp.frequency.exponentialRampToValueAtTime(f1, c.currentTime + ms / 1000);
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(c.destination);
  src.start();
}

function tone(c: AudioContext, f0: number, f1: number, ms: number, gain: number, delayMs = 0) {
  const t = c.currentTime + delayMs / 1000;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f0, t);
  o.frequency.linearRampToValueAtTime(f1, t + ms / 1000);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + ms / 1000 + 0.02);
}

export const sfx = {
  chip() {
    const c = out();
    if (c) noise(c, 40, 3000, 3000, 0.35, 4);
  },
  card() {
    const c = out();
    if (c) noise(c, 30, 4000, 1000, 0.25);
  },
  turn() {
    const c = out();
    if (c) tone(c, 660, 880, 80, 0.08);
  },
  win() {
    const c = out();
    if (c) [523, 659, 784].forEach((f, i) => tone(c, f, f, 160, 0.07, i * 90));
  },
};

export function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {}
}

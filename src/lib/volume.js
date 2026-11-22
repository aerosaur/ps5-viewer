// Volume is an integer 0–100. Gain follows a squared curve so steps sound even.

export function clampVolume(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function stepVolume(v, delta) {
  return clampVolume(v + delta);
}

export function gainFor(v, muted) {
  if (muted) return 0;
  const x = clampVolume(v) / 100;
  return x * x;
}

export function formatDisplay(v, muted) {
  return muted ? "MUTE" : String(clampVolume(v)).padStart(3, "0");
}

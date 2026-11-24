// Persisted app state. Anything unreadable or wrongly typed falls back to its default.
import { clampVolume } from "./volume.js";
import { clampOffset } from "./sync.js";

const KEY = "ps5viewer:v1";

export const DEFAULTS = Object.freeze({
  volume: 60,
  muted: false,
  controlsHidden: false,
  bounds: null,
  syncMs: 0,
});

function validBounds(b) {
  if (!b || typeof b !== "object") return null;
  const keys = ["x", "y", "width", "height"];
  if (!keys.every((k) => Number.isFinite(b[k]))) return null;
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

export function loadState(storage) {
  let raw;
  try {
    raw = JSON.parse(storage.getItem(KEY) ?? "null");
  } catch {
    return { ...DEFAULTS };
  }
  if (!raw || typeof raw !== "object") return { ...DEFAULTS };
  return {
    volume: Number.isFinite(raw.volume)
      ? clampVolume(raw.volume)
      : DEFAULTS.volume,
    muted: typeof raw.muted === "boolean" ? raw.muted : DEFAULTS.muted,
    controlsHidden:
      typeof raw.controlsHidden === "boolean"
        ? raw.controlsHidden
        : DEFAULTS.controlsHidden,
    bounds: validBounds(raw.bounds),
    syncMs: Number.isFinite(raw.syncMs) ? clampOffset(raw.syncMs) : DEFAULTS.syncMs,
  };
}

export function saveState(storage, state) {
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: settings just won't persist this session.
  }
}

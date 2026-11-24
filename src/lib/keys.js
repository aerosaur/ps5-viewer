const MAP = {
  arrowup: "volUp",
  arrowdown: "volDown",
  m: "mute",
  h: "hide",
  n: "mini",
  f: "full",
  d: "diag",
  escape: "escape",
  r: "reconnect",
  "?": "help",
};

// Global volume keys. Not Ctrl+Alt+arrows: Intel graphics drivers use those to rotate
// the screen, so volume-down could turn the monitor upside down.
export const GLOBAL_KEYS = Object.freeze({
  volUp: "CommandOrControl+Alt+PageUp",
  volDown: "CommandOrControl+Alt+PageDown",
  mute: "CommandOrControl+Alt+M",
});

// Labels for the key map overlay (?), in panel order.
export const KEY_HELP = Object.freeze([
  ["↑ ↓", "VOLUME"],
  ["M", "MUTE"],
  ["N", "MINI"],
  ["F", "FULL"],
  ["H", "HIDE"],
  ["R", "RECONNECT"],
  ["D", "DIAGNOSTICS"],
  ["CTRL ALT PGUP/PGDN", "VOLUME, ANYWHERE"],
  ["CTRL ALT M", "MUTE, ANYWHERE"],
]);

export function actionForKey(key) {
  return MAP[String(key).toLowerCase()] ?? null;
}

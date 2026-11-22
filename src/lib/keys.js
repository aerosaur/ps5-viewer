const MAP = {
  arrowup: "volUp",
  arrowdown: "volDown",
  m: "mute",
  h: "hide",
  n: "mini",
  f: "full",
  d: "diag",
  escape: "escape",
};

export function actionForKey(key) {
  return MAP[String(key).toLowerCase()] ?? null;
}

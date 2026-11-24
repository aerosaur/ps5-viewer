// In-app updates. The app asks the signed GitHub release feed on launch and every few
// hours. A newer version only ever shows a banner; nothing downloads or installs until
// the user taps it, so an update never lands silently mid-game.

export const UPDATE_FIRST_CHECK_MS = 15_000; // let the camera and audio settle first
export const UPDATE_CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

export function bannerText(version, phase = "ready") {
  const v = `v${String(version).replace(/^v/, "")}`;
  if (phase === "installing") return `UPDATE · ${v} · INSTALLING…`;
  if (phase === "failed") return `UPDATE · ${v} · FAILED · RETRY`;
  return `UPDATE · ${v} · INSTALL`;
}

// check: async () => version string or null. onFound(version) is called once per new
// version. Errors (offline, feed missing) are swallowed: the next check tries again.
export function createUpdateChecker({
  check,
  onFound,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  setRepeat = (fn, ms) => setInterval(fn, ms),
  firstMs = UPDATE_FIRST_CHECK_MS,
  everyMs = UPDATE_CHECK_EVERY_MS,
} = {}) {
  let shown = null;
  let lastError = null;
  const run = async () => {
    try {
      const v = await check();
      lastError = null;
      if (v && v !== shown) {
        shown = v;
        onFound(v);
      }
    } catch (e) {
      lastError = String(e?.message ?? e);
    }
  };
  return {
    start() {
      setTimer(run, firstMs);
      setRepeat(run, everyMs);
    },
    run,
    status: () => ({ available: shown, error: lastError }),
  };
}

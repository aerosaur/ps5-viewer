export const NO_SIGNAL_MS = 3000;
export const RETRY_MS = 2000;

export const STATE_COPY = Object.freeze({
  "no-device": { title: "NO DEVICE", hint: "" },
  "no-signal": { title: "NO SIGNAL", hint: "CHECK PS5 IS ON · HDCP OFF" },
  "in-use": { title: "DEVICE IN USE", hint: "CLOSE OBS OR OTHER CAPTURE APPS" },
});

// Chromium on Windows reports a camera held by another app as NotReadableError
// (older builds: TrackStartError).
const IN_USE = new Set(["NotReadableError", "TrackStartError"]);

export function classify({
  hasDevice,
  error,
  lastFrameAt,
  lastNonBlackAt,
  now,
}) {
  if (error) return IN_USE.has(error.name) ? "in-use" : "no-device";
  if (!hasDevice) return "no-device";
  if (now - lastFrameAt > NO_SIGNAL_MS) return "no-signal";
  if (now - lastNonBlackAt > NO_SIGNAL_MS) return "no-signal";
  return "ok";
}

export function isBlackFrame(rgba, threshold = 16) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (
      rgba[i] > threshold ||
      rgba[i + 1] > threshold ||
      rgba[i + 2] > threshold
    )
      return false;
  }
  return true;
}

// Picture is connected but there's no sound: keep trying the Cam Link's audio endpoint,
// which Windows often adds a moment after the video device.
export function shouldRetryAudio(state, audioLive) {
  return (state === "ok" || state === "no-signal") && !audioLive;
}

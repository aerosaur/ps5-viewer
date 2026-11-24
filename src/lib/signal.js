export const NO_SIGNAL_MS = 3000;
export const RETRY_MS = 2000;

export const STATE_COPY = Object.freeze({
  "no-device": { title: "NO DEVICE", hint: "" },
  "no-signal": { title: "NO SIGNAL", hint: "CHECK PS5 IS ON · HDCP OFF" },
  "in-use": { title: "DEVICE IN USE", hint: "CLOSE OBS OR OTHER CAPTURE APPS" },
  blocked: {
    title: "CAMERA BLOCKED",
    hint: "SETTINGS › PRIVACY › CAMERA › LET DESKTOP APPS ACCESS",
  },
});

// After this long stuck in DEVICE IN USE, the hint gets specific about OBS.
export const IN_USE_ESCALATE_MS = 20000;

export function hintFor(state, sinceMs = 0) {
  if (state === "in-use" && sinceMs >= IN_USE_ESCALATE_MS)
    return "IN OBS: TICK 'DEACTIVATE WHEN NOT SHOWING' · R TO RETRY";
  return STATE_COPY[state]?.hint ?? "";
}

// Chromium on Windows reports a camera held by another app as NotReadableError
// (older builds: TrackStartError).
const IN_USE = new Set(["NotReadableError", "TrackStartError"]);
// Windows privacy settings (or a denied WebView2 prompt) refuse the camera outright.
const BLOCKED = new Set(["NotAllowedError", "PermissionDeniedError", "SecurityError"]);

export function classify({
  hasDevice,
  error,
  lastFrameAt,
  lastNonBlackAt,
  now,
  hidden = false,
}) {
  if (error) {
    if (IN_USE.has(error.name)) return "in-use";
    if (BLOCKED.has(error.name)) return "blocked";
    return "no-device";
  }
  if (!hasDevice) return "no-device";
  // Minimised: WebView2 stops delivering frames to the page, which isn't the PS5's fault.
  if (hidden) return "ok";
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

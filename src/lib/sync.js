// A/V sync. Video and audio take separate paths through Windows, so they can land at
// different times. We measure both and delay the audio (never the video, which would
// add lag) by a user-set offset. Everything here is in milliseconds.

export const SYNC_MAX_MS = 300;
export const SYNC_STEP_MS = 10;

export function clampOffset(ms) {
  if (!Number.isFinite(ms)) return 0;
  return Math.min(SYNC_MAX_MS, Math.max(0, Math.round(ms)));
}

export function stepOffset(ms, dir) {
  return clampOffset(clampOffset(ms) + dir * SYNC_STEP_MS);
}

// Capture-to-display time for one video frame, from requestVideoFrameCallback metadata.
// Chromium fills captureTime for camera frames; without it we can't measure.
export function videoLatencyFrom(meta) {
  if (!meta || !Number.isFinite(meta.captureTime)) return null;
  const shownAt = Number.isFinite(meta.expectedDisplayTime)
    ? meta.expectedDisplayTime
    : meta.presentationTime;
  if (!Number.isFinite(shownAt)) return null;
  const ms = shownAt - meta.captureTime;
  return ms >= 0 && ms < 1000 ? ms : null;
}

// Rolling median so one late frame doesn't swing the estimate.
export function createMedian(size = 60) {
  const xs = [];
  return {
    push(x) {
      if (!Number.isFinite(x)) return;
      xs.push(x);
      if (xs.length > size) xs.shift();
    },
    get value() {
      if (xs.length === 0) return null;
      const s = [...xs].sort((a, b) => a - b);
      const m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    },
    get count() {
      return xs.length;
    },
  };
}

// Audio path latency = capture input + Web Audio base + device output (seconds in, ms out).
export function audioLatencyMs({ inputLatency, baseLatency, outputLatency }) {
  const parts = [inputLatency, baseLatency, outputLatency].map((x) =>
    Number.isFinite(x) ? x : 0,
  );
  return parts.reduce((a, b) => a + b, 0) * 1000;
}

// Suggested audio delay: how much later the picture arrives than the sound, to the
// nearest step. If the sound is already later than the picture, the best we can do is 0.
export function suggestOffset(videoMs, audioMs) {
  if (!Number.isFinite(videoMs) || !Number.isFinite(audioMs)) return null;
  const raw = clampOffset(videoMs - audioMs);
  return Math.round(raw / SYNC_STEP_MS) * SYNC_STEP_MS;
}

export function formatOffset(ms) {
  return `${clampOffset(ms) > 0 ? "+" : ""}${clampOffset(ms)} MS`;
}

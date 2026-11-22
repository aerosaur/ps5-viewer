// Keeps the capture connected and reports one of: ok | no-device | no-signal | in-use.
import { classify, isBlackFrame, RETRY_MS } from "../lib/signal.js";
import { isPresent } from "../lib/devices.js";

const TICK_MS = 500;

export function startWatcher({ videoEl, connect, onState }) {
  let track = null;
  let error = null;
  let hasDevice = false;
  let lastFrameAt = 0;
  let lastNonBlackAt = 0;
  let state = null;
  let connecting = false;
  let lastAttempt = 0;

  const probe = document.createElement("canvas");
  probe.width = 32;
  probe.height = 18;
  const pctx = probe.getContext("2d", { willReadFrequently: true });

  const onFrame = () => {
    lastFrameAt = performance.now();
    videoEl.requestVideoFrameCallback(onFrame);
  };
  videoEl.requestVideoFrameCallback(onFrame);

  const sampleBlack = () => {
    if (!track || videoEl.readyState < 2) return;
    pctx.drawImage(videoEl, 0, 0, probe.width, probe.height);
    if (!isBlackFrame(pctx.getImageData(0, 0, probe.width, probe.height).data))
      lastNonBlackAt = performance.now();
  };

  const drop = () => {
    track = null;
    hasDevice = false;
  };

  const attempt = async () => {
    if (connecting) return;
    connecting = true;
    lastAttempt = performance.now();
    try {
      track = await connect();
      error = null;
      hasDevice = true;
      lastFrameAt = lastNonBlackAt = performance.now();
      track.addEventListener("ended", () => {
        drop();
        evaluate();
      });
    } catch (e) {
      error =
        e.name === "NotFoundError" || e.name === "OverconstrainedError"
          ? null
          : e;
      drop();
    } finally {
      connecting = false;
      evaluate();
    }
  };

  const evaluate = () => {
    const next = classify({
      hasDevice,
      error,
      lastFrameAt,
      lastNonBlackAt,
      now: performance.now(),
    });
    if (next !== state) {
      state = next;
      onState(state, track);
    }
    // Reconnect only when we have no live track; a live track with no picture is the PS5's problem.
    if (!track && !connecting && performance.now() - lastAttempt >= RETRY_MS)
      attempt();
  };

  navigator.mediaDevices.addEventListener("devicechange", async () => {
    if (!track) return attempt();
    // Windows doesn't always end the track on unplug: check the device is still there.
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (!isPresent(track.getSettings().deviceId, devices)) {
      track.stop();
      drop();
      evaluate();
    }
  });
  setInterval(() => {
    sampleBlack();
    evaluate();
  }, TICK_MS);
  attempt();

  return {
    get state() {
      return state;
    },
    get track() {
      return track;
    },
    reconnect: attempt,
  };
}

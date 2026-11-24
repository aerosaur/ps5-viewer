// The audio seam. The UI only calls setVolume / setMuted / status; this implementation
// routes the Cam Link's audio through Web Audio. A native WASAPI version can replace it.
// Graph: capture → delay (A/V sync, 0 by default) → gain (volume) → speakers.
import { gainFor } from "../lib/volume.js";

const CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 2,
  sampleRate: 48000,
};

export function createAudioEngine() {
  let ctx = null;
  let gain = null;
  let delay = null;
  let delayMs = 0;
  let lastError = null;
  let source = null;
  let stream = null;
  let ownsStream = false;
  let volume = 60;
  let muted = false;

  const ensureCtx = () => {
    if (ctx) return ctx;
    ctx = new AudioContext({ latencyHint: "interactive", sampleRate: 48000 });
    gain = ctx.createGain();
    gain.gain.value = gainFor(volume, muted);
    gain.connect(ctx.destination);
    delay = ctx.createDelay(1);
    delay.delayTime.value = delayMs / 1000;
    delay.connect(gain);
    // Sound must never stop, minimised or not: if anything suspends the context
    // (autoplay rules, a device change, Windows "interrupted"), start it again.
    const resume = () => {
      if (ctx.state !== "running" && ctx.state !== "closed")
        ctx.resume().catch(() => {});
    };
    ctx.addEventListener("statechange", resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
    setInterval(resume, 2000);
    resume();
    return ctx;
  };

  const applyGain = () => {
    if (!gain) return;
    gain.gain.setTargetAtTime(gainFor(volume, muted), ctx.currentTime, 0.015);
  };

  return {
    // Either {deviceId} to open a capture device, or {stream} to play an existing stream (test mode).
    async start({ deviceId, stream: given }) {
      this.stop();
      ensureCtx();
      if (given) {
        stream = given;
        ownsStream = false;
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: { deviceId: { exact: deviceId }, ...CONSTRAINTS },
          });
        } catch (e) {
          lastError = e?.name ?? "Error";
          throw e;
        }
        ownsStream = true;
      }
      lastError = null;
      const current = stream;
      for (const t of current.getAudioTracks())
        t.addEventListener("ended", () => {
          if (stream === current) this.stop();
        });
      source = ctx.createMediaStreamSource(stream);
      source.connect(delay);
    },
    stop() {
      source?.disconnect();
      source = null;
      if (stream && ownsStream) for (const t of stream.getTracks()) t.stop();
      stream = null;
    },
    setVolume(v) {
      volume = v;
      applyGain();
    },
    setMuted(m) {
      muted = m;
      applyGain();
    },
    // A/V sync: hold the sound back so it lands with the picture.
    setDelay(ms) {
      delayMs = Math.max(0, Math.min(1000, ms));
      if (delay)
        delay.delayTime.setTargetAtTime(delayMs / 1000, ctx.currentTime, 0.02);
    },
    status() {
      return {
        baseLatency: ctx?.baseLatency ?? 0,
        outputLatency: ctx?.outputLatency ?? 0,
        state: ctx?.state ?? "closed",
        live: Boolean(source),
        // Capture-side latency, where Chromium reports it (seconds).
        inputLatency: stream?.getAudioTracks?.()[0]?.getSettings?.().latency ?? 0,
        delayMs,
        error: lastError,
      };
    },
  };
}

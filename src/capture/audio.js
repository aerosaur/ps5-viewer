// The audio seam. The UI only calls setVolume / setMuted / status; this implementation
// routes the Cam Link's audio through Web Audio. A native WASAPI version can replace it.
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
    const resume = () => {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
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
        stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { deviceId: { exact: deviceId }, ...CONSTRAINTS },
        });
        ownsStream = true;
      }
      source = ctx.createMediaStreamSource(stream);
      source.connect(gain);
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
    status() {
      return {
        baseLatency: ctx?.baseLatency ?? 0,
        outputLatency: ctx?.outputLatency ?? 0,
        state: ctx?.state ?? "closed",
        live: Boolean(source),
      };
    },
  };
}

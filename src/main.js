import { stepVolume, clampVolume } from "./lib/volume.js";
import { loadState, saveState } from "./lib/state.js";
import { actionForKey, GLOBAL_KEYS, KEY_HELP } from "./lib/keys.js";
import { createPanel } from "./ui/panel.js";
import { pickDevice } from "./lib/devices.js";
import { STATE_COPY, RETRY_MS, shouldRetryAudio, hintFor } from "./lib/signal.js";
import {
  stepOffset,
  clampOffset,
  suggestOffset,
  audioLatencyMs,
  formatOffset,
} from "./lib/sync.js";
import { formatDisplay } from "./lib/volume.js";
import { openVideo, attachStream } from "./capture/video.js";
import { createAudioEngine } from "./capture/audio.js";
import { startWatcher } from "./capture/watcher.js";
import { createTestStream } from "./capture/test-pattern.js";
import { win, registerShortcuts, waitForCaptureReady } from "./platform.js";
import { createModes } from "./modes.js";
import { createDiagnostics } from "./ui/diagnostics.js";

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
const noStore = { getItem: () => null, setItem: () => {} };

export const app = {
  state: loadState(storage ?? noStore),
  modeLabel: "--",
  // Window/capture tasks register handlers here; dispatch falls through to them.
  handlers: {},
  listeners: new Set(),

  commit(patch) {
    Object.assign(this.state, patch);
    saveState(storage ?? noStore, this.state);
    this.render();
    for (const fn of this.listeners) fn(this.state);
  },
  setVolume(v) {
    this.commit({ volume: clampVolume(v) });
    osd.volume();
  },
  setMuted(m) {
    this.commit({ muted: m });
    osd.volume();
  },
  setSync(ms) {
    this.commit({ syncMs: clampOffset(ms) });
    osd.sync();
  },
  setModeLabel(label) {
    this.modeLabel = label;
    this.render();
  },
  render() {
    panel.render(this.state, this.modeLabel);
  },

  dispatch(action) {
    switch (action) {
      case "volUp":
        return this.setVolume(stepVolume(this.state.volume, 5));
      case "volDown":
        return this.setVolume(stepVolume(this.state.volume, -5));
      case "mute":
        return this.setMuted(!this.state.muted);
      case "syncUp":
        return this.setSync(stepOffset(this.state.syncMs, 1));
      case "syncDown":
        return this.setSync(stepOffset(this.state.syncMs, -1));
      case "syncApply": {
        const s = app.syncSuggestion?.();
        return s == null ? osd.show("SYNC", "NO READING") : this.setSync(s);
      }
      default: {
        const h = this.handlers[action];
        if (h) return h();
        if (action === "hide") return this.commit({ controlsHidden: true });
        if (action === "show") return this.commit({ controlsHidden: false });
      }
    }
  },
};

const panel = createPanel(document.documentElement, {
  getVolume: () => app.state.volume,
  onVolume: (v) => app.setVolume(v),
  onAction: (a) => app.dispatch(a),
});

// ---- On-picture readout (OSD) ---------------------------------------------
// The panel shows volume already; the readout covers the modes where it's gone,
// and sync, which has nowhere else to show.
const osd = (() => {
  const el = document.getElementById("osd");
  let timer = null;
  const panelVisible = () => {
    const b = document.body.classList;
    return !b.contains("controls-hidden") && !b.contains("mini") && !b.contains("full");
  };
  const show = (label, value, { muted = false } = {}) => {
    document.getElementById("osd-label").textContent = label;
    document.getElementById("osd-value").textContent = value;
    el.classList.toggle("muted", muted);
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => (el.hidden = true), 1400);
  };
  return {
    show,
    volume() {
      if (panelVisible() || !app?.state) return;
      show("VOL", formatDisplay(app.state.volume, app.state.muted), {
        muted: app.state.muted,
      });
    },
    sync() {
      show("AUDIO SYNC", formatOffset(app.state.syncMs));
    },
  };
})();

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const action = actionForKey(e.key);
  if (!action) return;
  const repeats = ["volUp", "volDown", "syncUp", "syncDown"];
  if (e.repeat && !repeats.includes(action)) return;
  e.preventDefault();
  if (action === "escape" && !helpEl.hidden) return (helpEl.hidden = true);
  app.dispatch(action);
});

app.render();
window.app = app;

// ---- Key map (?) -------------------------------------------------------------
const helpEl = document.getElementById("help");
document.getElementById("help-grid").replaceChildren(
  ...KEY_HELP.flatMap(([k, label]) => {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = label;
    return [dt, dd];
  }),
);
app.handlers.help = () => (helpEl.hidden = !helpEl.hidden);
helpEl.addEventListener("click", () => (helpEl.hidden = true));

// ---- Pointer hides itself in picture-only modes --------------------------------
let idleTimer = null;
const wake = () => {
  document.body.classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add("idle"), 2000);
};
window.addEventListener("mousemove", wake);
window.addEventListener("mousedown", wake);
wake();

// ---- Capture ---------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const videoEl = $("video");
const params = new URLSearchParams(location.search);
const testMode = params.has("test");
// Dev on the Mac: ?anycam accepts any camera. The real app is Cam Link only.
const anyCam = params.has("anycam");
const audio = createAudioEngine();
app.audio = audio;
audio.setVolume(app.state.volume);
audio.setMuted(app.state.muted);
audio.setDelay(app.state.syncMs);
app.listeners.add((s) => {
  audio.setVolume(s.volume);
  audio.setMuted(s.muted);
  audio.setDelay(s.syncMs);
});

// Don't touch the camera until the native side has its permission handler in place.
const captureGate = waitForCaptureReady();

async function ensureLabels() {
  // Device labels are blank until capture permission is granted once.
  let devices = await navigator.mediaDevices.enumerateDevices();
  if (devices.some((d) => d.label)) return devices;
  const s = await navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
  for (const t of s.getTracks()) t.stop();
  return navigator.mediaDevices.enumerateDevices();
}

async function connect() {
  app.gate = await captureGate;
  if (testMode) {
    const stream = app.testStream ?? (app.testStream = createTestStream());
    const track = stream.getVideoTracks()[0].clone();
    attachStream(videoEl, new MediaStream([track]));
    await audio.start({ stream: new MediaStream(stream.getAudioTracks()) });
    $("device-label").textContent = "IN 01 / TEST PATTERN";
    return track;
  }
  const devices = await ensureLabels();
  const cam = pickDevice(devices, "videoinput", { strict: !anyCam });
  if (!cam)
    throw Object.assign(new Error("no capture device"), {
      name: "NotFoundError",
    });
  const track = await openVideo(videoEl, cam.deviceId);
  $("device-label").textContent =
    `IN 01 / ${cam.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)/i, "").toUpperCase()}`;
  await startCamLinkAudio(devices);
  return track;
}

async function startCamLinkAudio(devices) {
  const mic = pickDevice(devices, "audioinput", { strict: true });
  if (mic) await audio.start({ deviceId: mic.deviceId }).catch(() => audio.stop());
  else audio.stop();
}

let audioRetrying = false;
async function retryAudio() {
  if (testMode || audioRetrying || !app.watcher) return;
  if (!shouldRetryAudio(app.watcher.state, audio.status().live)) return;
  audioRetrying = true;
  try {
    await startCamLinkAudio(await navigator.mediaDevices.enumerateDevices());
  } finally {
    audioRetrying = false;
  }
}
setInterval(retryAudio, RETRY_MS);
navigator.mediaDevices.addEventListener("devicechange", retryAudio);

function modeLabelFor(track) {
  const s = track?.getSettings?.() ?? {};
  return s.height ? `${s.height}P · ${Math.round(s.frameRate ?? 0)}` : "--";
}

const overlay = $("state-overlay");
const LAMP_SIG = { ok: "ok", "no-signal": "wait", "in-use": "bad", blocked: "bad" };
function paintLamps() {
  const state = app.watcher?.state;
  $("lamp-sig").dataset.on = LAMP_SIG[state] ?? "";
  const a = audio.status();
  $("lamp-aud").dataset.on = a.live
    ? a.state === "running"
      ? "ok"
      : "wait"
    : a.error === "NotAllowedError"
      ? "bad"
      : "";
}
setInterval(paintLamps, 500);

app.watcher = startWatcher({
  videoEl,
  connect,
  onState(state, track) {
    const copy = STATE_COPY[state];
    overlay.hidden = state === "ok";
    overlay.querySelector(".state-title").textContent = copy?.title ?? "";
    overlay.querySelector(".state-hint").textContent = hintFor(state, 0);
    app.setModeLabel(state === "ok" ? modeLabelFor(track) : "--");
    paintLamps();
  },
});
// A device that stays busy gets a more specific hint.
setInterval(() => {
  const w = app.watcher;
  if (w.state === "in-use")
    overlay.querySelector(".state-hint").textContent = hintFor(w.state, w.stateMs);
}, 1000);
app.handlers.reconnect = () => app.watcher.reconnect();

// Keep the page from being frozen when the window is minimised (WebView2 ignores
// backgroundThrottling); a held Web Lock is the workaround Tauri documents.
navigator.locks?.request("ps5viewer-keepalive", () => new Promise(() => {}));

// ---- Window modes & shortcuts ---------------------------------------------
const modes = createModes({ app, win, pictureEl: $("picture") });
app.modes = modes;
Object.assign(app.handlers, modes.handlers);
modes.restore();
registerShortcuts(
  Object.fromEntries(
    Object.entries(GLOBAL_KEYS).map(([action, accel]) => [
      accel,
      () => app.dispatch(action),
    ]),
  ),
).then((ok) => (app.shortcuts = ok));

// ---- Diagnostics (D) ------------------------------------------------------
export const VERSION = "0.2.0";
$("titlebar").title = `PS5 Viewer ${VERSION}`;
const diag = createDiagnostics($("diag"), {
  getTrack: () => app.watcher.track,
  getAudioStatus: () => audio.status(),
  getExtra: () => ({
    syncMs: app.state.syncMs,
    shortcuts: app.shortcuts ?? [],
    gate: app.gate ?? "…",
    state: app.watcher.state,
  }),
  videoEl,
  version: VERSION,
});
// Only with sound actually flowing: otherwise audio latency reads as 0 and lies.
app.syncSuggestion = () => {
  const a = audio.status();
  return a.live ? suggestOffset(diag.videoLatencyMs(), audioLatencyMs(a)) : null;
};
app.handlers.diag = () => diag.toggle();

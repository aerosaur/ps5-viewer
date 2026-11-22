import { stepVolume, clampVolume } from "./lib/volume.js";
import { loadState, saveState } from "./lib/state.js";
import { actionForKey } from "./lib/keys.js";
import { createPanel } from "./ui/panel.js";
import { pickDevice } from "./lib/devices.js";
import { STATE_COPY, RETRY_MS, shouldRetryAudio } from "./lib/signal.js";
import { openVideo, attachStream } from "./capture/video.js";
import { createAudioEngine } from "./capture/audio.js";
import { startWatcher } from "./capture/watcher.js";
import { createTestStream } from "./capture/test-pattern.js";
import { win, registerShortcuts } from "./platform.js";
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
  },
  setMuted(m) {
    this.commit({ muted: m });
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

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const action = actionForKey(e.key);
  if (!action) return;
  if (e.repeat && action !== "volUp" && action !== "volDown") return;
  e.preventDefault();
  app.dispatch(action);
});

app.render();
window.app = app;

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
app.listeners.add((s) => {
  audio.setVolume(s.volume);
  audio.setMuted(s.muted);
});

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
app.watcher = startWatcher({
  videoEl,
  connect,
  onState(state, track) {
    const copy = STATE_COPY[state];
    overlay.hidden = state === "ok";
    overlay.querySelector(".state-title").textContent = copy?.title ?? "";
    overlay.querySelector(".state-hint").textContent = copy?.hint ?? "";
    app.setModeLabel(state === "ok" ? modeLabelFor(track) : "--");
  },
});

// Keep the page from being frozen when the window is minimised (WebView2 ignores
// backgroundThrottling); a held Web Lock is the workaround Tauri documents.
navigator.locks?.request("ps5viewer-keepalive", () => new Promise(() => {}));

// ---- Window modes & shortcuts ---------------------------------------------
const modes = createModes({ app, win, pictureEl: $("picture") });
app.modes = modes;
Object.assign(app.handlers, modes.handlers);
modes.restore();
registerShortcuts({
  "CommandOrControl+Alt+Up": () => app.dispatch("volUp"),
  "CommandOrControl+Alt+Down": () => app.dispatch("volDown"),
  "CommandOrControl+Alt+M": () => app.dispatch("mute"),
}).then((ok) => (app.shortcuts = ok));

// ---- Diagnostics (D) ------------------------------------------------------
export const VERSION = "0.1.0";
$("titlebar").title = `PS5 Viewer ${VERSION}`;
const diag = createDiagnostics($("diag"), {
  getTrack: () => app.watcher.track,
  getAudioStatus: () => audio.status(),
  videoEl,
  version: VERSION,
});
app.handlers.diag = () => diag.toggle();

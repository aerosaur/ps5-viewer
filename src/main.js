import { stepVolume, clampVolume } from "./lib/volume.js";
import { loadState, saveState } from "./lib/state.js";
import { actionForKey } from "./lib/keys.js";
import { createPanel } from "./ui/panel.js";

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

import { formatDisplay } from "../lib/volume.js";
import { attachKnob } from "./knob.js";

const $ = (id) => document.getElementById(id);

// Knob sweep: 0 → -135deg, 100 → +135deg (matches the tick ring).
const angleFor = (v) => -135 + v * 2.7;

export function createPanel(root, { getVolume, onVolume, onAction }) {
  $("btn-voldown").addEventListener("click", () => onAction("volDown"));
  $("btn-volup").addEventListener("click", () => onAction("volUp"));
  $("btn-mute").addEventListener("click", () => onAction("mute"));
  $("btn-mini").addEventListener("click", () => onAction("mini"));
  $("btn-full").addEventListener("click", () => onAction("full"));
  $("btn-hide").addEventListener("click", () => onAction("hide"));
  $("btn-show").addEventListener("click", () => onAction("show"));
  $("btn-min").addEventListener("click", () => onAction("minimise"));
  $("btn-close").addEventListener("click", () => onAction("close"));
  attachKnob($("knob"), { get: getVolume, set: onVolume });

  return {
    render(state, modeLabel) {
      $("display-vol").textContent = formatDisplay(state.volume, state.muted);
      $("display-mode").textContent = modeLabel;
      root.style.setProperty("--angle", `${angleFor(state.volume)}deg`);
      $("knob").setAttribute("aria-valuenow", String(state.volume));
      $("btn-mute").setAttribute("aria-pressed", String(state.muted));
      document.body.classList.toggle("muted", state.muted);
      document.body.classList.toggle("controls-hidden", state.controlsHidden);
    },
  };
}

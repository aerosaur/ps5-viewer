// Window modes: normal | hidden (picture only) | mini (small, on top) | full.
import {
  CHROME,
  pictureOnlySize,
  normalSizeForPicture,
  miniBounds,
  clampToMonitor,
} from "./lib/geometry.js";

export function createModes({ app, win, pictureEl }) {
  const body = document.body;
  let mode = app.state.controlsHidden ? "hidden" : "normal";
  let beforeMini = null; // { bounds, mode }

  const scale = () => win.scaleFactor();
  const offset = async () => {
    const s = await scale();
    return { x: CHROME.sides * s, y: CHROME.top * s };
  };

  async function hide() {
    if (mode !== "normal") return;
    const s = await scale();
    const b = await win.bounds();
    const pic = pictureOnlySize({ width: b.width / s, height: b.height / s });
    const o = await offset();
    mode = "hidden";
    app.commit({ controlsHidden: true });
    await win.setLogicalSize(pic);
    await win.setPosition({ x: b.x + o.x, y: b.y + o.y });
  }

  async function show() {
    if (mode !== "hidden") return;
    const s = await scale();
    const b = await win.bounds();
    const size = normalSizeForPicture({
      width: b.width / s,
      height: b.height / s,
    });
    const o = await offset();
    mode = "normal";
    app.commit({ controlsHidden: false });
    await win.setLogicalSize(size);
    await win.setPosition({ x: b.x - o.x, y: b.y - o.y });
  }

  async function enterMini() {
    if (mode === "mini" || mode === "full") return;
    beforeMini = { bounds: await win.bounds(), mode };
    mode = "mini";
    body.classList.add("mini");
    const mon = await win.currentMonitor();
    await win.setAlwaysOnTop(true);
    if (mon) await win.setBounds(miniBounds(mon));
  }

  async function exitMini() {
    if (mode !== "mini") return;
    body.classList.remove("mini");
    await win.setAlwaysOnTop(false);
    mode = beforeMini?.mode ?? "normal";
    if (beforeMini) await win.setBounds(beforeMini.bounds);
    beforeMini = null;
  }

  async function toggleFull() {
    if (mode === "mini") await exitMini();
    const on = !(await win.isFullscreen());
    body.classList.toggle("full", on);
    await win.setFullscreen(on);
  }

  async function escape() {
    if (await win.isFullscreen()) return toggleFull();
    if (mode === "mini") return exitMini();
  }

  // Picture interactions: drag in picture-only modes, double-click to step back.
  pictureEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || e.detail > 1 || e.target.closest("button")) return;
    if (mode === "hidden" || mode === "mini") win.startDragging();
  });
  pictureEl.addEventListener("dblclick", async (e) => {
    if (e.target.closest("button")) return;
    if (body.classList.contains("full")) return toggleFull();
    if (mode === "mini") return exitMini();
    if (mode === "hidden") return show();
    return toggleFull();
  });
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) body.classList.remove("full");
  });

  // Remember where the window lives (normal and hidden only; mini/full are temporary).
  let saveTimer = null;
  const remember = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if (mode !== "normal" && mode !== "hidden") return;
      if (await win.isFullscreen()) return;
      app.commit({ bounds: await win.bounds() });
    }, 500);
  };
  win.onMoved(remember);
  win.onResized(remember);

  async function restore() {
    if (!app.state.bounds) return;
    const b = clampToMonitor(app.state.bounds, await win.availableMonitors());
    if (b) await win.setBounds(b);
  }

  return {
    get mode() {
      return mode;
    },
    restore,
    handlers: {
      hide: () => (mode === "hidden" ? show() : hide()),
      show,
      mini: () => (mode === "mini" ? exitMini() : enterMini()),
      full: toggleFull,
      escape,
      minimise: () => win.minimize(),
      close: () => win.close(),
    },
  };
}

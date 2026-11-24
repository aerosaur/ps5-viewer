// Everything Tauri-specific lives here. In a plain browser (Mac dev) the window calls
// degrade to no-ops so the UI still runs. Sizes/positions are physical px unless named logical.

const T = typeof window !== "undefined" ? window.__TAURI__ : undefined;
export const isTauri = Boolean(T?.window);

// Registers each accelerator independently; one that's already taken is skipped.
// Returns the accelerators that registered.
export async function registerShortcuts(map, registrar = defaultRegistrar()) {
  if (!registrar) return [];
  const ok = [];
  for (const [accel, fn] of Object.entries(map)) {
    try {
      await registrar(accel, (event) => {
        if (event?.state === "Pressed") fn();
      });
      ok.push(accel);
    } catch {
      // Another app owns this combination; carry on without it.
    }
  }
  return ok;
}

// The native side grants camera/mic to the page from a WebView2 handler that is
// installed a moment after the page starts. Asking for the camera before it's in place
// is what made WebView2 show its own permission prompt on first launch. Resolves
// "ready", "timeout" (carry on anyway), or "n/a" outside the app.
export async function waitForCaptureReady({
  invoke = T?.core?.invoke,
  timeoutMs = 3000,
  pollMs = 50,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  if (!invoke) return "n/a";
  const tries = Math.max(1, Math.ceil(timeoutMs / pollMs));
  for (let i = 0; i < tries; i++) {
    try {
      if (await invoke("capture_ready")) return "ready";
    } catch {
      return "n/a"; // an older native side without the command
    }
    await sleep(pollMs);
  }
  return "timeout";
}

function defaultRegistrar() {
  const gs = T?.globalShortcut;
  return gs ? (accel, handler) => gs.register(accel, handler) : null;
}

// Position first: moving onto a monitor with another scale triggers a DPI resize,
// so the size has to be applied after it.
export async function applyBounds(w, b, { PhysicalSize, PhysicalPosition }) {
  await w.setPosition(new PhysicalPosition(Math.round(b.x), Math.round(b.y)));
  await w.setSize(new PhysicalSize(Math.round(b.width), Math.round(b.height)));
}

const monitorRect = (m) => {
  const area = m.workArea ?? { position: m.position, size: m.size };
  return {
    x: area.position.x,
    y: area.position.y,
    width: area.size.width,
    height: area.size.height,
    scale: m.scaleFactor,
  };
};

function tauriWin() {
  const w = T.window.getCurrentWindow();
  const { PhysicalSize, PhysicalPosition, LogicalSize } = T.dpi;
  return {
    async bounds() {
      const [pos, size] = await Promise.all([w.outerPosition(), w.innerSize()]);
      return { x: pos.x, y: pos.y, width: size.width, height: size.height };
    },
    setBounds: (b) => applyBounds(w, b, T.dpi),
    setMinSize: (m) => w.setMinSize(new LogicalSize(m.width, m.height)),
    setLogicalSize: (s) =>
      w.setSize(new LogicalSize(Math.round(s.width), Math.round(s.height))),
    setPosition: (p) =>
      w.setPosition(new PhysicalPosition(Math.round(p.x), Math.round(p.y))),
    scaleFactor: () => w.scaleFactor(),
    setAlwaysOnTop: (b) => w.setAlwaysOnTop(b),
    setFullscreen: (b) => w.setFullscreen(b),
    isFullscreen: () => w.isFullscreen(),
    minimize: () => w.minimize(),
    close: () => w.close(),
    startDragging: () => w.startDragging(),
    async currentMonitor() {
      const m = await T.window.currentMonitor();
      return m ? monitorRect(m) : null;
    },
    async availableMonitors() {
      return (await T.window.availableMonitors()).map(monitorRect);
    },
    onMoved: (cb) => w.onMoved(cb),
    onResized: (cb) => w.onResized(cb),
  };
}

function browserWin() {
  const noop = async () => {};
  return {
    bounds: async () => ({
      x: 0,
      y: 0,
      width: innerWidth,
      height: innerHeight,
    }),
    setBounds: noop,
    setLogicalSize: noop,
    setMinSize: noop,
    setPosition: noop,
    scaleFactor: async () => devicePixelRatio,
    setAlwaysOnTop: noop,
    async setFullscreen(b) {
      if (b && !document.fullscreenElement)
        await document.documentElement.requestFullscreen().catch(() => {});
      if (!b && document.fullscreenElement)
        await document.exitFullscreen().catch(() => {});
    },
    isFullscreen: async () => Boolean(document.fullscreenElement),
    minimize: noop,
    close: async () => window.close(),
    startDragging: noop,
    currentMonitor: async () => ({
      x: 0,
      y: 0,
      width: screen.availWidth,
      height: screen.availHeight,
      scale: devicePixelRatio,
    }),
    availableMonitors: async () => [
      {
        x: 0,
        y: 0,
        width: screen.availWidth,
        height: screen.availHeight,
        scale: devicePixelRatio,
      },
    ],
    onMoved: noop,
    onResized: noop,
  };
}

export const win =
  typeof window === "undefined" ? null : isTauri ? tauriWin() : browserWin();

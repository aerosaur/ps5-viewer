// Window maths. Logical px unless stated. Chrome sizes come from mockup E:
// top = 20 padding + 44 title bar + 16 gap; bottom = 16 gap + 112 panel + 20 padding.
export const CHROME = Object.freeze({ top: 80, bottom: 148, sides: 20 });

export function fit169(w, h) {
  if ((w * 9) / 16 <= h)
    return { width: Math.round(w), height: Math.round((w * 9) / 16) };
  return { width: Math.round((h * 16) / 9), height: Math.round(h) };
}

export function pictureOnlySize(inner) {
  return fit169(
    inner.width - CHROME.sides * 2,
    inner.height - CHROME.top - CHROME.bottom,
  );
}

export function normalSizeForPicture(pic) {
  return {
    width: pic.width + CHROME.sides * 2,
    height: pic.height + CHROME.top + CHROME.bottom,
  };
}

// monitor is in physical px with its scale factor; result is physical px.
export function miniBounds(monitor) {
  const s = monitor.scale || 1;
  const width = Math.round(480 * s);
  const height = Math.round(270 * s);
  const margin = Math.round(24 * s);
  return {
    width,
    height,
    x: monitor.x + monitor.width - width - margin,
    y: monitor.y + monitor.height - height - margin,
  };
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// Keeps saved bounds on a monitor that still exists. Picks the monitor under the
// window's centre, else the first one, and shrinks/moves the window to fit it.
export function clampToMonitor(bounds, monitors) {
  if (!bounds || !monitors || monitors.length === 0) return null;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const mon =
    monitors.find(
      (m) =>
        cx >= m.x && cx < m.x + m.width && cy >= m.y && cy < m.y + m.height,
    ) ?? monitors[0];
  const width = Math.min(bounds.width, mon.width);
  const height = Math.min(bounds.height, mon.height);
  return {
    width,
    height,
    x: clamp(bounds.x, mon.x, mon.x + mon.width - width),
    y: clamp(bounds.y, mon.y, mon.y + mon.height - height),
  };
}

// Normal mode needs room for the controls (640 wide → 600×338 picture + chrome);
// picture-only modes may shrink to mini and below.
export function minSizeFor(mode) {
  if (mode === "normal") return { width: 640, height: Math.round((600 * 9) / 16) + CHROME.top + CHROME.bottom };
  return { width: 320, height: 180 };
}

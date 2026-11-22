// Knob input: wheel ±1 per notch, vertical drag 1 unit per 3 px, arrow keys ±1 when focused.
export function attachKnob(el, { get, set }) {
  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      set(get() + (e.deltaY < 0 ? 1 : -1));
    },
    { passive: false },
  );

  let startY = 0;
  let startV = 0;
  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId);
    startY = e.clientY;
    startV = get();
  });
  el.addEventListener("pointermove", (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    set(startV + Math.round((startY - e.clientY) / 3));
  });
  const end = (e) => {
    if (el.hasPointerCapture(e.pointerId))
      el.releasePointerCapture(e.pointerId);
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);

  el.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      set(get() + 1);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      set(get() - 1);
    }
  });
}

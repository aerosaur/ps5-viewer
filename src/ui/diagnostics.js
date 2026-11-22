// D-key overlay: what Michael photographs and sends back from the PC.
export function createDiagnostics(
  container,
  { getTrack, getAudioStatus, videoEl, version },
) {
  let frames = 0;
  let fps = 0;
  let windowStart = performance.now();
  const count = () => {
    frames++;
    const now = performance.now();
    if (now - windowStart >= 1000) {
      fps = (frames * 1000) / (now - windowStart);
      frames = 0;
      windowStart = now;
    }
    videoEl.requestVideoFrameCallback(count);
  };
  videoEl.requestVideoFrameCallback(count);

  const edge =
    (navigator.userAgent.match(/Edg\/([\d.]+)/) ??
      navigator.userAgent.match(/Chrome\/([\d.]+)/))?.[0] ?? "?";
  let timer = null;

  const paint = () => {
    const q = videoEl.getVideoPlaybackQuality?.() ?? {};
    const a = getAudioStatus();
    const s = getTrack()?.getSettings?.() ?? {};
    container.textContent = [
      `FPS   ${fps.toFixed(1)}`,
      `DROP  ${q.droppedVideoFrames ?? 0}/${q.totalVideoFrames ?? 0}`,
      `AUDIO ${a.live ? `${Math.round((a.baseLatency + a.outputLatency) * 1000)} ms (${a.state})` : "none"}`,
      `TRACK ${s.width ?? "-"}×${s.height ?? "-"}@${s.frameRate ? Math.round(s.frameRate) : "-"}`,
      `UA    ${edge}`,
      `BUILD ${version}`,
    ].join("\n");
  };

  return {
    toggle() {
      container.hidden = !container.hidden;
      clearInterval(timer);
      if (!container.hidden) {
        paint();
        timer = setInterval(paint, 500);
      }
    },
  };
}

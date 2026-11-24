// D-key overlay: what Michael photographs and sends back from the PC.
import {
  videoLatencyFrom,
  createMedian,
  audioLatencyMs,
  suggestOffset,
} from "../lib/sync.js";

export function createDiagnostics(
  container,
  { getTrack, getAudioStatus, getExtra = () => ({}), videoEl, version },
) {
  let frames = 0;
  let fps = 0;
  let windowStart = performance.now();
  const videoLatency = createMedian(90);
  const count = (_now, meta) => {
    frames++;
    videoLatency.push(videoLatencyFrom(meta));
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
  const ms = (x) => (x == null ? "?" : `${Math.round(x)} ms`);

  const paint = () => {
    const q = videoEl.getVideoPlaybackQuality?.() ?? {};
    const a = getAudioStatus();
    const s = getTrack()?.getSettings?.() ?? {};
    const x = getExtra();
    const vMs = videoLatency.value;
    const aMs = a.live ? audioLatencyMs(a) : null;
    const hint = suggestOffset(vMs, aMs);
    container.textContent = [
      `FPS   ${fps.toFixed(1)}`,
      `DROP  ${q.droppedVideoFrames ?? 0}/${q.totalVideoFrames ?? 0}`,
      `VIDEO ${ms(vMs)} capture→screen`,
      `AUDIO ${a.live ? `${ms(aMs)} in+out (${a.state})` : `none${a.error ? ` (${a.error})` : ""}`}`,
      `SYNC  +${x.syncMs ?? 0} ms${hint == null ? "" : `  measured +${hint} (\\ to use)`}`,
      `TRACK ${s.width ?? "-"}×${s.height ?? "-"}@${s.frameRate ? Math.round(s.frameRate) : "-"}`,
      `STATE ${x.state ?? "-"}  PERMS ${x.gate ?? "-"}`,
      `KEYS  ${(x.shortcuts ?? []).map((k) => k.replace("CommandOrControl+", "Ctrl+")).join(" ") || "none"}`,
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
    videoLatencyMs: () => videoLatency.value,
  };
}

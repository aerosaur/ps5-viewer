// ?test mode: a 1080p60 moving pattern with a frame counter and a 440 Hz tone,
// so the app can be exercised without a Cam Link.
export function createTestStream() {
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const g = canvas.getContext("2d");
  const bars = ["#D7261E", "#F2B600", "#1E9A57", "#1F5FBF"];
  let frame = 0;

  const draw = () => {
    frame++;
    g.fillStyle = "#111";
    g.fillRect(0, 0, 1920, 1080);
    const x = (frame * 8) % 1920;
    bars.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect((x + i * 160) % 1920, 300, 120, 480);
    });
    g.fillStyle = "#fff";
    g.font = "64px monospace";
    g.fillText(`TEST ${String(frame).padStart(6, "0")}`, 80, 140);
  };
  draw();
  setInterval(draw, 1000 / 60);

  const stream = canvas.captureStream(60);
  const actx = new AudioContext();
  const osc = actx.createOscillator();
  osc.frequency.value = 440;
  const level = actx.createGain();
  level.gain.value = 0.2;
  const dest = actx.createMediaStreamDestination();
  osc.connect(level).connect(dest);
  osc.start();
  const resume = () => actx.resume().catch(() => {});
  window.addEventListener("pointerdown", resume, true);
  window.addEventListener("keydown", resume, true);
  stream.addTrack(dest.stream.getAudioTracks()[0]);
  return stream;
}

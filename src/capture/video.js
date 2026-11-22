// Attaches the capture device to the <video> element. No extra buffering: a MediaStream
// in a <video> plays live frames as they arrive.
export async function openVideo(videoEl, deviceId) {
  stopVideo(videoEl);
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 60 },
    },
  });
  attachStream(videoEl, stream);
  return stream.getVideoTracks()[0];
}

export function attachStream(videoEl, stream) {
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.srcObject = stream;
  videoEl.play().catch(() => {});
}

export function stopVideo(videoEl) {
  const old = videoEl.srcObject;
  if (old) for (const t of old.getTracks()) t.stop();
  videoEl.srcObject = null;
}

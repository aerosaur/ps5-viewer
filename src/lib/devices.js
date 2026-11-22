// Windows lists alias entries ("default", "communications") that point at another device.
const ALIASES = new Set(["default", "communications"]);
const CAM_LINK = /cam\s*link/i;

// strict: only a Cam Link will do (used for audio, so we never loop a microphone to the speakers).
export function pickDevice(devices, kind, { strict = false } = {}) {
  const real = devices.filter(
    (d) => d.kind === kind && !ALIASES.has(d.deviceId),
  );
  const cam = real.find((d) => CAM_LINK.test(d.label));
  if (cam || strict) return cam ?? null;
  return real[0] ?? null;
}

export function isPresent(deviceId, devices) {
  return Boolean(deviceId) && devices.some((d) => d.deviceId === deviceId);
}

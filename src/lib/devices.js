// Windows lists alias entries ("default", "communications") that point at another device.
const ALIASES = new Set(["default", "communications"]);

export function pickDevice(devices, kind) {
  const real = devices.filter(
    (d) => d.kind === kind && !ALIASES.has(d.deviceId),
  );
  return real.find((d) => /cam\s*link/i.test(d.label)) ?? real[0] ?? null;
}

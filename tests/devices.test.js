import { test } from "node:test";
import assert from "node:assert/strict";
import { pickDevice } from "../src/lib/devices.js";

const d = (kind, label, deviceId = label) => ({ kind, label, deviceId });

test("prefers Cam Link over other cameras", () => {
  const list = [
    d("videoinput", "FaceTime HD Camera"),
    d("videoinput", "Cam Link 4K (0fd9:0066)"),
  ];
  assert.equal(pickDevice(list, "videoinput").label, "Cam Link 4K (0fd9:0066)");
});
test("matches audio by kind and label, case-insensitive", () => {
  const list = [
    d("audioinput", "Microphone (Realtek)"),
    d("audioinput", "Digital Audio Interface (CAM LINK 4K)"),
    d("videoinput", "Cam Link 4K"),
  ];
  assert.equal(
    pickDevice(list, "audioinput").label,
    "Digital Audio Interface (CAM LINK 4K)",
  );
});
test("falls back to the first device of that kind", () => {
  const list = [
    d("audioinput", "Mic"),
    d("videoinput", "FaceTime HD Camera"),
    d("videoinput", "USB Cam"),
  ];
  assert.equal(pickDevice(list, "videoinput").label, "FaceTime HD Camera");
});
test('skips the Windows "default"/"communications" alias entries when falling back', () => {
  const list = [
    d("audioinput", "Default - Mic", "default"),
    d("audioinput", "Mic", "abc"),
  ];
  assert.equal(pickDevice(list, "audioinput").deviceId, "abc");
});
test("null when none of that kind", () => {
  assert.equal(pickDevice([], "videoinput"), null);
  assert.equal(pickDevice([d("audioinput", "Mic")], "videoinput"), null);
});

test('strict mode only accepts a Cam Link (no mic fallback, avoids feedback)', () => {
  const list = [d('audioinput', 'MacBook Pro Microphone'), d('audioinput', 'USB Mic')];
  assert.equal(pickDevice(list, 'audioinput', { strict: true }), null);
  const withCam = [...list, d('audioinput', 'Cam Link 4K')];
  assert.equal(pickDevice(withCam, 'audioinput', { strict: true }).label, 'Cam Link 4K');
});

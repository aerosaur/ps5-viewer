import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classify,
  isBlackFrame,
  NO_SIGNAL_MS,
  RETRY_MS,
  STATE_COPY,
} from "../src/lib/signal.js";

const now = 100000;
const ok = {
  hasDevice: true,
  error: null,
  lastFrameAt: now - 16,
  lastNonBlackAt: now - 16,
  now,
};

test("constants", () => {
  assert.equal(NO_SIGNAL_MS, 3000);
  assert.equal(RETRY_MS, 2000);
});
test("device busy error means in-use", () => {
  assert.equal(
    classify({ ...ok, error: { name: "NotReadableError" } }),
    "in-use",
  );
  assert.equal(
    classify({ ...ok, error: { name: "TrackStartError" } }),
    "in-use",
  );
});
test("no device", () => {
  assert.equal(classify({ ...ok, hasDevice: false }), "no-device");
});
test("not found reads as no-device", () => {
  assert.equal(
    classify({ ...ok, error: { name: "NotFoundError" } }),
    "no-device",
  );
});
test("no frames for over 3s is no-signal", () => {
  assert.equal(classify({ ...ok, lastFrameAt: now - 3001 }), "no-signal");
});
test("frames arriving but black for over 3s is no-signal", () => {
  assert.equal(classify({ ...ok, lastNonBlackAt: now - 3001 }), "no-signal");
});
test("never seen a frame is no-signal once 3s pass", () => {
  assert.equal(
    classify({ ...ok, lastFrameAt: 0, lastNonBlackAt: 0 }),
    "no-signal",
  );
});
test("fresh frames are ok", () => {
  assert.equal(classify(ok), "ok");
});
test("isBlackFrame", () => {
  assert.equal(isBlackFrame(new Uint8ClampedArray(32 * 18 * 4)), true);
  const px = new Uint8ClampedArray(32 * 18 * 4);
  px[40] = 200;
  assert.equal(isBlackFrame(px), false);
});
test("isBlackFrame ignores alpha", () => {
  const px = new Uint8ClampedArray(8);
  px[3] = 255;
  px[7] = 255;
  assert.equal(isBlackFrame(px), true);
});
test("exact copy", () => {
  assert.deepEqual(STATE_COPY["no-device"], { title: "NO DEVICE", hint: "" });
  assert.deepEqual(STATE_COPY["no-signal"], {
    title: "NO SIGNAL",
    hint: "CHECK PS5 IS ON · HDCP OFF",
  });
  assert.deepEqual(STATE_COPY["in-use"], {
    title: "DEVICE IN USE",
    hint: "CLOSE OBS OR OTHER CAPTURE APPS",
  });
});

import { shouldRetryAudio } from '../src/lib/signal.js';
test('audio is retried while the picture is fine but there is no sound', () => {
  assert.equal(shouldRetryAudio('ok', false), true);
  assert.equal(shouldRetryAudio('ok', true), false);
  assert.equal(shouldRetryAudio('no-device', false), false);
  assert.equal(shouldRetryAudio('no-signal', false), true);
});

import { hintFor, IN_USE_ESCALATE_MS } from "../src/lib/signal.js";
test("permission refused reads as blocked, not no-device", () => {
  for (const name of ["NotAllowedError", "PermissionDeniedError", "SecurityError"])
    assert.equal(classify({ ...ok, error: { name } }), "blocked");
  assert.equal(STATE_COPY.blocked.title, "CAMERA BLOCKED");
});
test("a hidden window never reads as no-signal", () => {
  assert.equal(
    classify({ ...ok, lastFrameAt: now - 60000, lastNonBlackAt: now - 60000, hidden: true }),
    "ok",
  );
  assert.equal(classify({ ...ok, hasDevice: false, hidden: true }), "no-device");
  assert.equal(
    classify({ ...ok, error: { name: "NotReadableError" }, hidden: true }),
    "in-use",
  );
});
test("in-use hint gets specific about OBS after a while", () => {
  assert.equal(hintFor("in-use", 0), "CLOSE OBS OR OTHER CAPTURE APPS");
  assert.match(hintFor("in-use", IN_USE_ESCALATE_MS), /DEACTIVATE WHEN NOT SHOWING/);
  assert.equal(hintFor("no-signal", 99999), "CHECK PS5 IS ON · HDCP OFF");
  assert.equal(hintFor("ok"), "");
});

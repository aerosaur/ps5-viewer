import { test } from "node:test";
import assert from "node:assert/strict";
import { registerShortcuts } from "../src/platform.js";

const ACCELS = [
  "CommandOrControl+Alt+Up",
  "CommandOrControl+Alt+Down",
  "CommandOrControl+Alt+M",
];

test("a shortcut taken by another app is skipped, the rest register", async () => {
  const registrar = async (accel) => {
    if (accel.endsWith("+M")) throw new Error("HotKey already registered");
  };
  const map = Object.fromEntries(ACCELS.map((a) => [a, () => {}]));
  const ok = await registerShortcuts(map, registrar);
  assert.deepEqual(ok, [
    "CommandOrControl+Alt+Up",
    "CommandOrControl+Alt+Down",
  ]);
});

test("handlers fire on Pressed only", async () => {
  const wrapped = {};
  const registrar = async (accel, h) => {
    wrapped[accel] = h;
  };
  let n = 0;
  await registerShortcuts({ "CommandOrControl+Alt+Up": () => n++ }, registrar);
  wrapped["CommandOrControl+Alt+Up"]({ state: "Pressed" });
  wrapped["CommandOrControl+Alt+Up"]({ state: "Released" });
  assert.equal(n, 1);
});

test("no registrar available (plain browser) registers nothing without throwing", async () => {
  assert.deepEqual(
    await registerShortcuts({ "CommandOrControl+Alt+Up": () => {} }, null),
    [],
  );
});

import { applyBounds } from '../src/platform.js';
test('applyBounds moves before resizing so a DPI change on the target monitor does not grow the window', async () => {
  const calls = [];
  const w = { setPosition: async (p) => calls.push(['pos', p.x, p.y]), setSize: async (s) => calls.push(['size', s.width, s.height]) };
  const dpi = { PhysicalSize: class { constructor(width, height) { Object.assign(this, { width, height }); } },
    PhysicalPosition: class { constructor(x, y) { Object.assign(this, { x, y }); } } };
  await applyBounds(w, { x: 10.4, y: 20, width: 1040, height: 790 }, dpi);
  assert.deepEqual(calls, [['pos', 10, 20], ['size', 1040, 790]]);
});

import { waitForCaptureReady } from "../src/platform.js";
const noSleep = async () => {};
test("capture waits until the native permission handler is in place", async () => {
  let calls = 0;
  const invoke = async (cmd) => {
    assert.equal(cmd, "capture_ready");
    return ++calls >= 3;
  };
  assert.equal(await waitForCaptureReady({ invoke, sleep: noSleep }), "ready");
  assert.equal(calls, 3);
});
test("capture carries on after the timeout rather than hanging", async () => {
  let calls = 0;
  const r = await waitForCaptureReady({
    invoke: async () => (calls++, false),
    timeoutMs: 200,
    pollMs: 50,
    sleep: noSleep,
  });
  assert.equal(r, "timeout");
  assert.equal(calls, 4);
});
test("outside the app, or with an older native side, there's nothing to wait for", async () => {
  assert.equal(await waitForCaptureReady({ invoke: null }), "n/a");
  assert.equal(
    await waitForCaptureReady({ invoke: async () => { throw new Error("unknown command"); } }),
    "n/a",
  );
});

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

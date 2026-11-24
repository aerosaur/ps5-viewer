import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bannerText,
  createUpdateChecker,
  UPDATE_CHECK_EVERY_MS,
} from "../src/lib/update.js";

test("banner reads UPDATE · vX.Y.Z · INSTALL", () => {
  assert.equal(bannerText("0.2.1"), "UPDATE · v0.2.1 · INSTALL");
  assert.equal(bannerText("v0.3.0"), "UPDATE · v0.3.0 · INSTALL");
  assert.equal(bannerText("0.2.1", "installing"), "UPDATE · v0.2.1 · INSTALLING…");
});

test("checks on launch and then every few hours", () => {
  const calls = [];
  const c = createUpdateChecker({
    check: async () => null,
    onFound: () => {},
    setTimer: (_, ms) => calls.push(["once", ms]),
    setRepeat: (_, ms) => calls.push(["every", ms]),
  });
  c.start();
  assert.equal(calls[0][0], "once");
  assert.ok(calls[0][1] < 60_000);
  assert.deepEqual(calls[1], ["every", UPDATE_CHECK_EVERY_MS]);
  assert.ok(UPDATE_CHECK_EVERY_MS >= 2 * 3600_000 && UPDATE_CHECK_EVERY_MS <= 8 * 3600_000);
});

test("a found version is announced once, never installed by the checker", async () => {
  const found = [];
  const c = createUpdateChecker({ check: async () => "0.2.1", onFound: (v) => found.push(v) });
  await c.run();
  await c.run();
  assert.deepEqual(found, ["0.2.1"]);
  assert.equal(c.status().available, "0.2.1");
});

test("an offline or failed check is quiet and retried next time", async () => {
  let fail = true;
  const found = [];
  const c = createUpdateChecker({
    check: async () => {
      if (fail) throw new Error("offline");
      return "0.2.1";
    },
    onFound: (v) => found.push(v),
  });
  await c.run();
  assert.equal(c.status().error, "offline");
  assert.deepEqual(found, []);
  fail = false;
  await c.run();
  assert.deepEqual(found, ["0.2.1"]);
  assert.equal(c.status().error, null);
});

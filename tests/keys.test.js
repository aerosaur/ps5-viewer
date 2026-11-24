import { test } from "node:test";
import assert from "node:assert/strict";
import { actionForKey } from "../src/lib/keys.js";

test("maps the spec keys", () => {
  assert.equal(actionForKey("ArrowUp"), "volUp");
  assert.equal(actionForKey("ArrowDown"), "volDown");
  assert.equal(actionForKey("m"), "mute");
  assert.equal(actionForKey("M"), "mute");
  assert.equal(actionForKey("h"), "hide");
  assert.equal(actionForKey("n"), "mini");
  assert.equal(actionForKey("f"), "full");
  assert.equal(actionForKey("d"), "diag");
  assert.equal(actionForKey("Escape"), "escape");
});
test("unknown keys map to null", () => {
  assert.equal(actionForKey("q"), null);
  assert.equal(actionForKey(""), null);
});

import { GLOBAL_KEYS, KEY_HELP } from "../src/lib/keys.js";
test("v0.2 keys: sync, reconnect, help", () => {
  assert.equal(actionForKey("["), "syncDown");
  assert.equal(actionForKey("]"), "syncUp");
  assert.equal(actionForKey("\\"), "syncApply");
  assert.equal(actionForKey("r"), "reconnect");
  assert.equal(actionForKey("?"), "help");
});
test("global keys stay off Ctrl+Alt+arrows (Intel screen rotation)", () => {
  for (const accel of Object.values(GLOBAL_KEYS))
    assert.doesNotMatch(accel, /\+(Up|Down|Left|Right)$/);
  assert.deepEqual(Object.keys(GLOBAL_KEYS), ["volUp", "volDown", "mute"]);
});
test("every in-app key in the help is a real key", () => {
  assert.ok(KEY_HELP.length >= 8);
  for (const [k] of KEY_HELP.slice(0, 9))
    for (const key of k.split(" ").filter((s) => s.length === 1 && s !== "↑" && s !== "↓"))
      assert.notEqual(actionForKey(key), null, key);
});

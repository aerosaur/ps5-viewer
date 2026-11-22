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

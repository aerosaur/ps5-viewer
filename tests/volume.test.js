import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampVolume,
  stepVolume,
  gainFor,
  formatDisplay,
} from "../src/lib/volume.js";

test("clampVolume clamps to 0..100 and rounds", () => {
  assert.equal(clampVolume(104), 100);
  assert.equal(clampVolume(-3), 0);
  assert.equal(clampVolume(41.6), 42);
  assert.equal(clampVolume(NaN), 0);
});
test("stepVolume steps and clamps", () => {
  assert.equal(stepVolume(98, 5), 100);
  assert.equal(stepVolume(3, -5), 0);
  assert.equal(stepVolume(60, 1), 61);
});
test("gainFor is squared and zero when muted", () => {
  assert.equal(gainFor(50, false), 0.25);
  assert.equal(gainFor(100, false), 1);
  assert.equal(gainFor(80, true), 0);
});
test("formatDisplay pads to three digits or shows MUTE", () => {
  assert.equal(formatDisplay(7, false), "007");
  assert.equal(formatDisplay(100, false), "100");
  assert.equal(formatDisplay(60, true), "MUTE");
});

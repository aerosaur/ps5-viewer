import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHROME,
  pictureOnlySize,
  normalSizeForPicture,
  miniBounds,
  clampToMonitor,
  fit169,
} from "../src/lib/geometry.js";

const near = (a, b, tol = 1) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test("chrome constants come from the mockup", () => {
  assert.deepEqual(CHROME, { top: 80, bottom: 148, sides: 20 });
});
test("pictureOnlySize of the default window is the mockup picture", () => {
  const p = pictureOnlySize({ width: 1040, height: 790 });
  near(p.width, 1000);
  near(p.height, 562);
});
test("pictureOnlySize is limited by height in a wide window", () => {
  const p = pictureOnlySize({ width: 2000, height: 790 });
  near(p.height, 562);
  near(p.width, 999);
});
test("normalSizeForPicture inverts pictureOnlySize", () => {
  const n = normalSizeForPicture({ width: 1000, height: 562 });
  near(n.width, 1040);
  near(n.height, 790);
});
test("miniBounds is 480x270 logical, bottom-right, scaled to physical", () => {
  assert.deepEqual(
    miniBounds({ x: 0, y: 0, width: 2880, height: 1620, scale: 1.5 }),
    { width: 720, height: 405, x: 2880 - 720 - 36, y: 1620 - 405 - 36 },
  );
});
test("miniBounds respects monitor origin at 100%", () => {
  assert.deepEqual(
    miniBounds({ x: 1920, y: 0, width: 1920, height: 1080, scale: 1 }),
    { width: 480, height: 270, x: 1920 + 1920 - 480 - 24, y: 1080 - 270 - 24 },
  );
});
test("clampToMonitor pulls off-screen bounds onto the first monitor", () => {
  const b = clampToMonitor({ x: 5000, y: 3000, width: 1040, height: 790 }, [
    { x: 0, y: 0, width: 1920, height: 1080 },
  ]);
  assert.ok(b.x >= 0 && b.x <= 1920 - 1040, `x=${b.x}`);
  assert.ok(b.y >= 0 && b.y <= 1080 - 790, `y=${b.y}`);
  assert.equal(b.width, 1040);
});
test("clampToMonitor leaves visible bounds alone", () => {
  const b = { x: 100, y: 100, width: 1040, height: 790 };
  assert.deepEqual(
    clampToMonitor(b, [{ x: 0, y: 0, width: 1920, height: 1080 }]),
    b,
  );
});
test("clampToMonitor keeps bounds that sit on a second monitor", () => {
  const b = { x: 2100, y: 50, width: 1040, height: 790 };
  const mons = [
    { x: 0, y: 0, width: 1920, height: 1080 },
    { x: 1920, y: 0, width: 2560, height: 1440 },
  ];
  assert.deepEqual(clampToMonitor(b, mons), b);
});
test("clampToMonitor shrinks bounds larger than the monitor", () => {
  const b = clampToMonitor({ x: 0, y: 0, width: 3000, height: 2000 }, [
    { x: 0, y: 0, width: 1920, height: 1080 },
  ]);
  assert.ok(b.width <= 1920 && b.height <= 1080);
});
test("clampToMonitor returns null for null bounds or no monitors", () => {
  assert.equal(
    clampToMonitor(null, [{ x: 0, y: 0, width: 1920, height: 1080 }]),
    null,
  );
  assert.equal(clampToMonitor({ x: 0, y: 0, width: 10, height: 10 }, []), null);
});
test("fit169 fits a 16:9 box inside", () => {
  assert.deepEqual(fit169(1000, 1000), { width: 1000, height: 563 });
  assert.deepEqual(fit169(1000, 400), { width: 711, height: 400 });
});

import { minSizeFor } from '../src/lib/geometry.js';
test('minimum size: normal keeps the controls usable, picture-only modes can go down to mini', () => {
  assert.deepEqual(minSizeFor('normal'), { width: 640, height: 566 });
  for (const m of ['hidden', 'mini', 'full']) assert.deepEqual(minSizeFor(m), { width: 320, height: 180 });
});

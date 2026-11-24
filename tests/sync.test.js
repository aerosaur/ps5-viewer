import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampOffset,
  stepOffset,
  videoLatencyFrom,
  createMedian,
  audioLatencyMs,
  suggestOffset,
  formatOffset,
  SYNC_MAX_MS,
} from "../src/lib/sync.js";

test("offset is clamped to 0..max and rounded", () => {
  assert.equal(clampOffset(-5), 0);
  assert.equal(clampOffset(12.6), 13);
  assert.equal(clampOffset(9999), SYNC_MAX_MS);
  assert.equal(clampOffset(NaN), 0);
});
test("offset steps by 10 and stops at the ends", () => {
  assert.equal(stepOffset(0, 1), 10);
  assert.equal(stepOffset(0, -1), 0);
  assert.equal(stepOffset(SYNC_MAX_MS, 1), SYNC_MAX_MS);
});
test("video latency comes from capture to expected display", () => {
  assert.equal(
    videoLatencyFrom({ captureTime: 1000, expectedDisplayTime: 1062 }),
    62,
  );
  assert.equal(
    videoLatencyFrom({ captureTime: 1000, presentationTime: 1040 }),
    40,
  );
});
test("video latency is unknown without captureTime or with nonsense", () => {
  assert.equal(videoLatencyFrom({ expectedDisplayTime: 5 }), null);
  assert.equal(videoLatencyFrom(null), null);
  assert.equal(
    videoLatencyFrom({ captureTime: 2000, expectedDisplayTime: 1000 }),
    null,
  );
  assert.equal(
    videoLatencyFrom({ captureTime: 0, expectedDisplayTime: 5000 }),
    null,
  );
});
test("rolling median ignores one outlier and forgets old values", () => {
  const m = createMedian(5);
  assert.equal(m.value, null);
  for (const x of [40, 42, 41, 400, 43]) m.push(x);
  assert.equal(m.value, 42);
  for (const x of [10, 10, 10]) m.push(x);
  assert.equal(m.value, 10);
  m.push(NaN);
  assert.equal(m.count, 5);
});
test("audio latency sums the three parts in ms", () => {
  assert.equal(
    Math.round(
      audioLatencyMs({ inputLatency: 0.01, baseLatency: 0.01, outputLatency: 0.02 }),
    ),
    40,
  );
  assert.equal(audioLatencyMs({ baseLatency: 0.01 }), 10);
});
test("suggestion delays audio by the gap, to the nearest 10", () => {
  assert.equal(suggestOffset(95, 40), 60);
  assert.equal(suggestOffset(30, 80), 0);
  assert.equal(suggestOffset(null, 40), null);
  assert.equal(suggestOffset(5000, 0), SYNC_MAX_MS);
});
test("format", () => {
  assert.equal(formatOffset(0), "0 MS");
  assert.equal(formatOffset(40), "+40 MS");
});

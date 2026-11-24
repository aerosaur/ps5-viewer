import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, loadState, saveState } from "../src/lib/state.js";

const KEY = "ps5viewer:v1";
const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
};

test("defaults are as specified", () => {
  assert.deepEqual(DEFAULTS, {
    volume: 60,
    muted: false,
    controlsHidden: false,
    bounds: null,
    syncMs: 0,
  });
});
test("missing key gives defaults", () => {
  assert.deepEqual(loadState(mem()), DEFAULTS);
});
test("corrupt JSON gives defaults", () => {
  assert.deepEqual(loadState(mem({ [KEY]: "{not json" })), DEFAULTS);
});
test("out-of-range volume is clamped, other keys defaulted", () => {
  assert.deepEqual(loadState(mem({ [KEY]: JSON.stringify({ volume: 900 }) })), {
    ...DEFAULTS,
    volume: 100,
  });
});
test("non-numeric volume falls back to 60", () => {
  assert.equal(
    loadState(mem({ [KEY]: JSON.stringify({ volume: "x" }) })).volume,
    60,
  );
});
test("wrong-typed fields fall back to defaults", () => {
  const s = loadState(
    mem({
      [KEY]: JSON.stringify({
        muted: "yes",
        controlsHidden: 1,
        bounds: "nope",
      }),
    }),
  );
  assert.deepEqual(s, DEFAULTS);
});
test("bounds with four finite numbers survive", () => {
  const b = { x: 10, y: 20, width: 1040, height: 790 };
  assert.deepEqual(
    loadState(mem({ [KEY]: JSON.stringify({ bounds: b }) })).bounds,
    b,
  );
});
test("save then load round-trips", () => {
  const s = mem();
  const state = {
    volume: 35,
    muted: true,
    controlsHidden: true,
    bounds: { x: 1, y: 2, width: 3, height: 4 },
    syncMs: 40,
  };
  saveState(s, state);
  assert.deepEqual(loadState(s), state);
});
test("throwing storage gives defaults and save does not throw", () => {
  const bad = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  assert.deepEqual(loadState(bad), DEFAULTS);
  assert.doesNotThrow(() => saveState(bad, DEFAULTS));
});

test("v0.2: sync offset persists, defaults to 0, and v0.1 saves still load", () => {
  const store = (v) => ({ getItem: () => JSON.stringify(v), setItem() {} });
  assert.equal(loadState(store({ volume: 40 })).syncMs, 0);
  assert.equal(loadState(store({ syncMs: 70 })).syncMs, 70);
  assert.equal(loadState(store({ syncMs: 9999 })).syncMs, 300);
  assert.equal(loadState(store({ syncMs: "70" })).syncMs, 0);
  assert.equal(loadState(store({ volume: 40 })).volume, 40);
});

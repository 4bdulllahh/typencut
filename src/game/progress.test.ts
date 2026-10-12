import assert from "node:assert/strict";
import { test } from "node:test";
import { ACHIEVEMENTS, CARS, carUnlocked, earn, fresh, parseProgress, unlockedBetween } from "./progress.ts";
import { applyCommand, createState } from "./sim.ts";

test("parseProgress keeps a valid total and known achievements only", () => {
  assert.deepEqual(parseProgress(null), { total: 0, earned: {} });
  assert.deepEqual(parseProgress("nope"), { total: 0, earned: {} });
  const p = parseProgress(JSON.stringify({ total: 1234, earned: { cut1: 5, fake: 9, trap1: "x", slip1: -1 } }));
  assert.deepEqual(p, { total: 1234, earned: { cut1: 5 } });
  assert.equal(parseProgress(JSON.stringify({ total: -5 })).total, 0);
  assert.equal(parseProgress(JSON.stringify({ total: "1e9" })).total, 0);
});

test("achievements: earned once, mode-specific ones only in their mode", () => {
  const s = createState(1);
  applyCommand(s, { type: "key", correct: true });
  s.stats.cleanCuts = 1;
  s.stats.score = 25_000;
  const got = fresh({ total: 0, earned: {} }, s).map((a) => a.id);
  assert.deepEqual(got, ["cut1", "score10k"]); // 20k is not "Beat the clock" outside time attack
  const p = earn({ total: 0, earned: {} }, ACHIEVEMENTS.filter((a) => got.includes(a.id)), 7);
  assert.deepEqual(fresh(p, s), []);
  s.mode = "timeAttack";
  assert.deepEqual(fresh(p, s).map((a) => a.id), ["clock"]);
  s.mode = "daily";
  assert.deepEqual(fresh(p, s).map((a) => a.id), []);
  applyCommand(s, { type: "end" });
  assert.deepEqual(fresh(p, s).map((a) => a.id), ["daily"]);
});

test("unlockedBetween lists what a run's score crossed", () => {
  assert.deepEqual(unlockedBetween(0, 14_999), []);
  assert.deepEqual(unlockedBetween(10_000, 45_000), ["Guards red", "Shark blue", "Honda Civic Type R"]);
  assert.deepEqual(unlockedBetween(400_000, 1_000_000), ["Porsche 911 GT3 RS"]);
  assert.deepEqual(unlockedBetween(300_000, 300_000), []);
});

test("garage: ten cars, the GT3 RS late on the points ladder, hypercars only by their achievement", () => {
  assert.equal(CARS.length, 10);
  const unlocked = (total: number, earned: Record<string, number> = {}) => CARS.filter((c) => carUnlocked(c, { total, earned })).map((c) => c.id);
  assert.deepEqual(unlocked(0), ["gr86"]);
  assert.deepEqual(unlocked(449_999).length, 6);
  assert.deepEqual(unlocked(10_000_000), ["gr86", "typer", "m4", "gtr", "c8", "turbos", "gt3rs"]);
  assert.deepEqual(unlocked(0, { score100k: 1 }), ["gr86", "chiron"]);
  for (const c of CARS) if (c.needs) assert.ok(ACHIEVEMENTS.some((a) => a.id === c.needs), c.id);
  const s = createState(2);
  applyCommand(s, { type: "key", correct: true });
  Object.assign(s.stats, { cleanCuts: 10, bestClean: 10_000, score: 100_000 });
  const got = fresh({ total: 0, earned: {} }, s).map((a) => a.id);
  for (const id of ["cut10", "clean10k", "score100k"]) assert.ok(got.includes(id), id);
});

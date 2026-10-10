import assert from "node:assert/strict";
import { test } from "node:test";
import { ACHIEVEMENTS, earn, fresh, parseProgress, unlockedBetween } from "./progress.ts";
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
  assert.deepEqual(unlockedBetween(10_000, 45_000), ["Guards red", "Shark blue"]);
  assert.deepEqual(unlockedBetween(90_000, 100_000), ["911 Turbo S"]);
  assert.deepEqual(unlockedBetween(100_000, 100_000), []);
});

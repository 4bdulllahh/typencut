import assert from "node:assert/strict";
import { test } from "node:test";
import { LANES, MPH, POINTS, laneX } from "./config.ts";
import { isPrefix, matchWord } from "./input.ts";
import { applyCommand, createState, rand, spawn, step } from "./sim.ts";
import type { GameState, Npc } from "./types.ts";
import { WORDS, pickWord } from "./words.ts";

/** A running state with an empty road. */
function running(seed = 1): GameState {
  const s = createState(seed);
  s.npcs = [];
  applyCommand(s, { type: "key", correct: true });
  return s;
}

function put(s: GameState, lane: number, ahead: number, mph = 60): Npc {
  const n = spawn(s, s.player.s + ahead)!;
  Object.assign(n, { lane, targetLane: lane, x: laneX(lane), speed: mph * MPH, cruise: mph * MPH, kind: "cruiser" });
  return n;
}

const run = (s: GameState, seconds: number) => {
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) events.push(...step(s, 1 / 60));
  return events;
};

test("matchWord: exact steers, ALL CAPS is nitro, wrong case or letters miss", () => {
  assert.deepEqual(matchWord("car", "car"), { nitro: false });
  assert.deepEqual(matchWord("CAR", "car"), { nitro: true });
  assert.deepEqual(matchWord("DRIFT", "DrIft"), { nitro: true });
  assert.equal(matchWord("Car", "car"), null);
  assert.equal(matchWord("cat", "car"), null);
  assert.equal(matchWord("", "car"), null);
  assert.ok(isPrefix("Ca", "car") && !isPrefix("cb", "car"));
});

test("pickWord starts with 3 letters only, gets longer, never all caps", () => {
  const r = Math.random;
  for (let i = 0; i < 200; i++) assert.equal(pickWord(r, 0).length, 3);
  const late = Array.from({ length: 300 }, () => pickWord(r, 1));
  assert.ok(late.every((w) => w.length >= 6));
  assert.ok(late.some((w) => w !== w.toLowerCase()), "mixed casing appears late");
  assert.ok(late.every((w) => w !== w.toUpperCase()));
  assert.ok(WORDS[0].every((w) => w.length === 3));
});

test("same seed, same run", () => {
  const a = createState(42);
  const b = createState(42);
  assert.deepEqual(a, b);
  assert.notEqual(rand(a), rand(createState(43)));
});

test("first key starts the run; the start keeps the player's lane clear", () => {
  const s = createState(7);
  assert.equal(s.status, "ready");
  assert.ok(!s.npcs.some((n) => n.lane === 2 && n.s < 120));
  assert.deepEqual(applyCommand(s, { type: "key", correct: true }), [{ type: "start" }]);
  assert.equal(s.status, "running");
});

test("word command steers one lane, clamps at the edges, advances the word", () => {
  const s = running();
  const next = s.nextWord;
  applyCommand(s, { type: "word", dir: -1, nitro: false, chars: 4 });
  assert.equal(s.player.lane, 1);
  assert.equal(s.word, next);
  run(s, 1);
  assert.ok(Math.abs(s.player.x - laneX(1)) < 0.05, "spring settles within 1 s");
  s.player.lane = 0;
  const ev = applyCommand(s, { type: "word", dir: -1, nitro: false, chars: 4 });
  assert.equal(s.player.lane, 0);
  assert.ok(!ev.some((e) => e.type === "laneChange"));
  s.player.lane = LANES - 1;
  applyCommand(s, { type: "word", dir: 1, nitro: false, chars: 4 });
  assert.equal(s.player.lane, LANES - 1);
});

test("nitro surges toward top speed for 1 s; brake slows hard for 1 s", () => {
  const s = running();
  const cruise = s.player.speed;
  applyCommand(s, { type: "word", dir: 1, nitro: true, chars: 4 });
  run(s, 0.9);
  assert.ok(s.player.speed > cruise + 15);
  run(s, 3);
  assert.ok(s.player.speed < cruise + 15, "settles back after the burst");
  applyCommand(s, { type: "brake" });
  run(s, 1);
  assert.ok(s.player.speed < cruise * 0.7);
});

test("hitting a car costs a life, resets the combo, ends the run at zero", () => {
  const s = running();
  s.stats.combo = 5;
  s.stats.multiplier = 2;
  put(s, 2, 30, 30);
  const ev = run(s, 3);
  assert.ok(ev.some((e) => e.type === "collision"));
  assert.equal(s.player.lives, 2);
  assert.equal(s.stats.multiplier, 1);
  s.player.lives = 1;
  s.player.invulnT = 0;
  put(s, s.player.lane, 20, 20);
  assert.ok(run(s, 3).some((e) => e.type === "gameOver"));
  assert.equal(s.status, "over");
});

test("passes: 2 lanes away is standard, adjacent is dangerous; multiplier grows", () => {
  const s = running();
  put(s, 0, 30);
  const ev = run(s, 4).filter((e) => e.type === "overtake");
  assert.equal(ev.length, 1);
  assert.deepEqual([ev[0].grade, ev[0].points], ["standard", POINTS.standard]);
  put(s, 3, 30);
  const ev2 = run(s, 4).filter((e) => e.type === "overtake");
  assert.equal(ev2[0].grade, "dangerous");
  assert.equal(ev2[0].points, Math.round(POINTS.dangerous * 1.2));
  assert.equal(s.stats.multiplier, 1.4);
});

test("cutting out from right behind a car is a clean cut", () => {
  const s = running();
  put(s, 2, 10);
  applyCommand(s, { type: "word", dir: 1, nitro: false, chars: 4 });
  const ev = run(s, 4).filter((e) => e.type === "overtake");
  assert.equal(ev[0].grade, "cleanCut");
  assert.equal(s.stats.cleanCuts, 1);
  assert.equal(s.player.lives, 3);
});

test("mergers indicate before sliding (or rarely cut); cruisers hold their lane", () => {
  const s = running(3);
  const cruiser = put(s, 1, 200, 70);
  const merger = put(s, 3, 120, 70);
  Object.assign(merger, { kind: "merger", mergeCd: 0 });
  let signalled = false;
  for (let i = 0; i < 60 * 20 && merger.lane === 3; i++) {
    step(s, 1 / 60);
    signalled ||= merger.signal !== 0;
    s.player.s = merger.s - 60; // keep the player out of the way
  }
  assert.notEqual(merger.lane, 3, "merged within 20 s");
  assert.ok(signalled || merger.latSpeed === 6, "indicated unless it was a surprise cut");
  assert.equal(cruiser.lane, 1);
});

test("a minute of traffic: cars never drive through each other and keep spawning", () => {
  const s = createState(9);
  applyCommand(s, { type: "key", correct: true });
  for (let i = 0; i < 60 * 60; i++) {
    step(s, 1 / 60);
    s.player.lives = 3; // keep it running
    for (const a of s.npcs)
      for (const b of s.npcs) {
        if (a === b || a.hit || b.hit) continue;
        const overlap = Math.abs(a.s - b.s) < (a.length + b.length) / 2 && Math.abs(a.x - b.x) < (a.width + b.width) / 2;
        assert.ok(!overlap, `npc ${a.id} overlaps ${b.id}`);
      }
  }
  assert.ok(s.npcs.length >= 8);
  assert.ok(s.stats.passes > 10);
});

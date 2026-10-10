import assert from "node:assert/strict";
import { test } from "node:test";
import { COMBO_TIME, LANES, MPH, POINTS, SPEED_CAMERA, laneX } from "./config.ts";
import { isPrefix, matchWord } from "./input.ts";
import { applyCommand, createState, rand, seedFromDate, snapshot, spawn, step } from "./sim.ts";
import type { GameState, Npc } from "./types.ts";
import { PACKS, WORDS, bucketize, parseWordList, pickWord } from "./words.ts";

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

/** A seeded random source, for tests that call word helpers directly. */
const rng = (seed: number) => {
  const st = createState(seed);
  return () => rand(st);
};

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
  assert.deepEqual(applyCommand(s, { type: "key", correct: true }), [{ type: "start" }, { type: "key", correct: true }]);
  assert.equal(s.status, "running");
});

test("word command steers one lane, clamps at the edges, advances the word", () => {
  const s = running();
  const next = s.nextWord;
  applyCommand(s, { type: "word", dir: -1, nitro: false });
  assert.equal(s.player.lane, 1);
  assert.equal(s.word, next);
  run(s, 1);
  assert.ok(Math.abs(s.player.x - laneX(1)) < 0.05, "spring settles within 1 s");
  s.player.lane = 0;
  const ev = applyCommand(s, { type: "word", dir: -1, nitro: false });
  assert.equal(s.player.lane, 0);
  assert.ok(!ev.some((e) => e.type === "laneChange"));
  s.player.lane = LANES - 1;
  applyCommand(s, { type: "word", dir: 1, nitro: false });
  assert.equal(s.player.lane, LANES - 1);
});

test("Enter-submitted word keeps the lane, advances the word and gives a short surge", () => {
  const s = running();
  const cruise = s.player.speed;
  const next = s.nextWord;
  const ev = applyCommand(s, { type: "word", dir: 0, nitro: false });
  assert.equal(s.player.lane, 2);
  assert.equal(s.word, next);
  assert.ok(ev.some((e) => e.type === "boost") && !ev.some((e) => e.type === "laneChange"));
  run(s, 0.6);
  assert.ok(s.player.speed > cruise + 3);
  run(s, 3);
  assert.ok(s.player.speed < cruise + 1, "settles back to cruise");
});

test("nitro surges toward top speed for 1 s; brake slows hard for 1 s", () => {
  const s = running();
  const cruise = s.player.speed;
  applyCommand(s, { type: "word", dir: 1, nitro: true });
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
  applyCommand(s, { type: "word", dir: 1, nitro: false });
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

test("traffic stays spread out: the view ahead is never empty", () => {
  for (const seed of [3, 11, 42]) {
    const s = createState(seed);
    applyCommand(s, { type: "key", correct: true });
    let fewest = Infinity;
    for (let i = 0; i < 90 * 60; i++) {
      step(s, 1 / 60);
      s.player.lives = 3;
      if (i > 5 * 60 && i % 30 === 0) fewest = Math.min(fewest, s.npcs.filter((n) => n.s - s.player.s > -25 && n.s - s.player.s < 140).length);
    }
    assert.ok(fewest >= 3, `seed ${seed}: only ${fewest} cars in view`);
  }
});

test("combo timer: the multiplier holds after a pass, then drains a step a second", () => {
  const s = running();
  put(s, 0, 20);
  for (let i = 0; i < 300 && !step(s, 1 / 60).some((e) => e.type === "overtake"); i++);
  assert.equal(s.stats.multiplier, 1.2);
  s.npcs = [];
  run(s, COMBO_TIME - 0.5); // still inside the window
  assert.equal(s.stats.multiplier, 1.2);
  run(s, 1);
  assert.equal(s.stats.multiplier, 1);
  assert.equal(s.stats.combo, 0);
});

test("slipstream: close behind a car fills the meter, and the next word fires a free nitro", () => {
  const s = running();
  const lead = put(s, 2, 6);
  lead.speed = lead.cruise = s.player.speed; // hold the gap so only the draft changes
  const ev = run(s, 1);
  assert.equal(s.player.draft, 1);
  assert.ok(ev.some((e) => e.type === "draftReady"));
  const word = applyCommand(s, { type: "word", dir: 1, nitro: false });
  assert.ok(word.some((e) => e.type === "slipstream") && word.some((e) => e.type === "nitro"));
  assert.ok(s.player.nitroT > 0);
  assert.equal(s.player.draft, 0);
  s.npcs = [];
  run(s, 2);
  assert.equal(s.player.draft, 0, "no car ahead, no draft");
});

test("speed traps pay out only at or above the camera's limit", () => {
  const s = running();
  const cam = SPEED_CAMERA.offset + SPEED_CAMERA.period * 3;
  s.player.s = cam - 1;
  s.player.speed = 120 * MPH;
  s.npcs = []; // the jump would otherwise count every car it skipped as a pass
  assert.ok(!step(s, 0.1).some((e) => e.type === "speedTrap"));
  s.player.s = cam + SPEED_CAMERA.period - 1;
  s.player.speed = 165 * MPH;
  s.player.nitroT = 1; // hold the speed
  s.npcs = [];
  const before = s.stats.score;
  const trap = step(s, 0.1).find((e) => e.type === "speedTrap");
  assert.ok(trap && trap.type === "speedTrap" && trap.mph >= 165 && trap.points >= 350);
  assert.equal(s.stats.score, before + (trap.type === "speedTrap" ? trap.points : 0));
});

test("zen: crashes cost no lives; `end` finishes any run", () => {
  const s = createState(1, { mode: "zen" });
  s.npcs = [];
  applyCommand(s, { type: "key", correct: true });
  put(s, 2, 20, 30);
  assert.ok(run(s, 3).some((e) => e.type === "collision"));
  assert.equal(s.player.lives, 3);
  assert.equal(s.status, "running");
  assert.deepEqual(applyCommand(s, { type: "end" }), [{ type: "gameOver" }]);
  assert.equal(s.status, "over");
});

test("time attack ends after 90 seconds; rush hour packs in more traffic", () => {
  const t = createState(5, { mode: "timeAttack" });
  applyCommand(t, { type: "key", correct: true });
  let over = false;
  for (let i = 0; i < 89 * 60; i++) step(t, 1 / 60), (t.player.lives = 3);
  assert.equal(t.status, "running");
  for (let i = 0; i < 2 * 60 && !over; i++) over = step(t, 1 / 60).some((e) => e.type === "gameOver");
  assert.ok(over);
  assert.equal(snapshot(t).status, "over");

  const count = (mode: "classic" | "rush") => {
    const s = createState(8, { mode });
    applyCommand(s, { type: "key", correct: true });
    let sum = 0;
    for (let i = 0; i < 30 * 60; i++) {
      step(s, 1 / 60);
      s.player.lives = 3;
      if (i % 60 === 0) sum += s.npcs.filter((n) => n.s - s.player.s > -15 && n.s - s.player.s < 125).length;
    }
    return sum;
  };
  assert.ok(count("rush") > count("classic") * 1.4);
});

test("word packs: custom lists are cleaned and bucketed; picks skip empty buckets", () => {
  for (const pack of Object.values(PACKS)) assert.ok(pack.flat().every((w) => /^[a-z]+$/.test(w)) && pack.flat().length >= 60);
  assert.deepEqual(parseWordList("Hello, world;  a  42go hello  Typing\nrace"), ["hello", "world", "typing", "race"]);
  const buckets = bucketize(["supercalifragilistic".slice(0, 14), "keyboard", "type"]);
  assert.deepEqual(buckets.map((b) => b.length), [0, 1, 0, 0, 2]);
  const r = rng(4);
  for (let i = 0; i < 50; i++) assert.ok(["type", "keyboard", "supercalifragi"].includes(pickWord(r, i / 50, "", buckets).toLowerCase()));
  const s = createState(2, { words: bucketize(parseWordList("alpha bravo charlie delta echo foxtrot golf hotel india juliet")) });
  assert.ok(["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet"].includes(s.word.toLowerCase()));
});

test("the daily seed is stable for a date and differs between dates", () => {
  assert.equal(seedFromDate("2026-10-10"), seedFromDate("2026-10-10"));
  assert.notEqual(seedFromDate("2026-10-10"), seedFromDate("2026-10-11"));
  assert.deepEqual(snapshot(createState(seedFromDate("2026-10-10"))).word, snapshot(createState(seedFromDate("2026-10-10"))).word);
});

test("run counters: best combo and the longest crash-free stretch", () => {
  const s = running();
  put(s, 0, 30);
  run(s, 4);
  assert.equal(s.stats.maxCombo, 1);
  assert.ok(Math.abs(s.stats.bestClean - s.player.s) < 1e-9);
  put(s, s.player.lane, 30, 30);
  assert.ok(run(s, 3).some((e) => e.type === "collision"));
  const crashAt = s.stats.cleanFrom;
  assert.ok(crashAt > 0);
  const before = s.stats.bestClean;
  s.npcs = [];
  run(s, 1);
  assert.equal(s.stats.bestClean, before); // a short stretch after the crash does not beat the one before it
  assert.equal(s.stats.maxCombo, 1); // the crash reset the combo, not the best
});

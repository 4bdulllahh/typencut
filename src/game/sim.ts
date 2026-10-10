import {
  BOOST_MPH, BOOST_TIME, BRAKE_TIME, CLEAN_CUT_GAP, COMBO_TIME, DRAFT_RANGE, RUSH_GAP, SPEED_CAMERA, TIME_ATTACK_S, CRUISE_MPH, CRUISERS, INVULN_TIME, LANES, MAX_MULTIPLIER, MERGERS, MODELS, MPH,
  MULTIPLIER_STEP, NITRO_MPH, NITRO_TIME, PLAYER_DIMS, POINTS, START_LIVES, SURPRISE_CUT_CHANCE, laneX, toMph,
} from "./config.ts";
import type { Command, GameEvent, GameState, Mode, Npc, PassGrade } from "./types.ts";
import { WORDS, pickWord } from "./words.ts";

const LAT_K = 90; // lane-change spring stiffness (critically damped, ~0.5 s settle)
const LAT_C = 2 * Math.sqrt(LAT_K);
const SPAWN_AT = 200; // m ahead, just past the fog
const DESPAWN = [-40, 460] as const;

/** mulberry32 on the state's seed, so a run (or a ghost) replays from its seed. */
export function rand(state: GameState): number {
  state.seed = (state.seed + 0x6d2b79f5) | 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step);

/** 0 → 1 difficulty from distance and score. */
export const progress = (s: GameState) => Math.min(1, s.player.s / 8000 + s.stats.score / 60000);
export const cruiseSpeed = (p: number) => (CRUISE_MPH[0] + (CRUISE_MPH[1] - CRUISE_MPH[0]) * p) * MPH;

export interface RunOptions {
  seed?: number;
  mode?: Mode;
  words?: string[][]; // length buckets, see `bucketize`
}

/** FNV-1a of a date string such as "2026-10-10": the daily challenge's seed. */
export const seedFromDate = (date: string) => [...date].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) | 0;

export function createState(seed = Date.now(), { mode = "classic", words = WORDS }: Omit<RunOptions, "seed"> = {}): GameState {
  const state: GameState = {
    status: "ready",
    mode,
    seed: seed | 0,
    nextId: 1,
    player: {
      s: 0, x: laneX(2), vx: 0, lane: 2, prevLane: 2, laneAge: 99, speed: cruiseSpeed(0),
      nitroT: 0, brakeT: 0, boostT: 0, draft: 0, invulnT: 0, lives: START_LIVES, cutId: 0,
    },
    npcs: [],
    stats: {
      score: 0, combo: 0, multiplier: 1, comboT: 0, passes: 0, cleanCuts: 0, maxSpeed: 0,
      keys: 0, correctKeys: 0, words: 0, misses: 0, elapsed: 0, maxCombo: 0, traps: 0, slipstreams: 0, cleanFrom: 0, bestClean: 0,
    },
    word: "",
    nextWord: "",
    laneGap: [],
    words,
  };
  state.word = pickWord(() => rand(state), 0, "", words);
  state.nextWord = pickWord(() => rand(state), 0, state.word, words);
  // Pre-fill every lane, keeping the player's lane clear for the first stretch.
  for (let lane = 0; lane < LANES; lane++) {
    for (let s = 40 + rand(state) * laneGap(state); s < SPAWN_AT; s += laneGap(state)) spawn(state, s, lane, 2);
    state.laneGap[lane] = laneGap(state);
  }
  return state;
}

export function applyCommand(state: GameState, cmd: Command): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.status === "over") return events;
  const { player: pl, stats: st } = state;
  if (cmd.type === "key") {
    if (state.status === "ready") {
      state.status = "running";
      events.push({ type: "start" });
    }
    st.keys++;
    if (cmd.correct) st.correctKeys++;
    events.push({ type: "key", correct: cmd.correct });
    return events;
  }
  if (state.status !== "running") return events;
  if (cmd.type === "end") {
    state.status = "over";
    events.push({ type: "gameOver" });
  } else if (cmd.type === "miss") {
    st.misses++;
    events.push({ type: "miss" });
  } else if (cmd.type === "brake") {
    pl.brakeT = BRAKE_TIME;
    pl.nitroT = 0;
    events.push({ type: "brake" });
  } else {
    st.words++;
    const to = pl.lane + cmd.dir;
    const free = !cmd.nitro && pl.draft >= 1; // slipstream: a full meter turns this word into a nitro
    const nitro = cmd.nitro || free;
    if (cmd.dir === 0) {
      if (!nitro) {
        pl.boostT = BOOST_TIME;
        pl.brakeT = 0;
        events.push({ type: "boost" });
      }
    } else if (to >= 0 && to < LANES) {
      // Clean-cut candidate: the car right ahead in the lane we are leaving.
      const ahead = state.npcs
        .filter((n) => !n.hit && Math.abs(n.x - laneX(pl.lane)) < 1.5)
        .map((n) => ({ n, gap: n.s - pl.s - (n.length + PLAYER_DIMS.length) / 2 }))
        .filter((a) => a.gap > -1 && a.gap < CLEAN_CUT_GAP)
        .sort((a, b) => a.gap - b.gap)[0];
      pl.cutId = ahead ? ahead.n.id : 0;
      pl.prevLane = pl.lane;
      pl.lane = to;
      pl.laneAge = 0;
      events.push({ type: "laneChange", dir: cmd.dir });
    }
    if (free) {
      pl.draft = 0;
      st.slipstreams++;
      events.push({ type: "slipstream" });
    }
    if (nitro) {
      pl.nitroT = NITRO_TIME;
      pl.brakeT = 0;
      events.push({ type: "nitro" });
    }
    state.word = state.nextWord;
    state.nextWord = pickWord(() => rand(state), progress(state), state.word, state.words);
    events.push({ type: "word", word: state.word });
  }
  return events;
}

export function step(state: GameState, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.status !== "running") return events;
  const { player: pl, stats: st } = state;
  const p = progress(state);
  st.elapsed += dt;
  if (state.mode === "timeAttack" && st.elapsed >= TIME_ATTACK_S) {
    state.status = "over";
    events.push({ type: "gameOver" });
    return events;
  }

  // Player: speed
  pl.nitroT = Math.max(0, pl.nitroT - dt);
  pl.brakeT = Math.max(0, pl.brakeT - dt);
  pl.boostT = Math.max(0, pl.boostT - dt);
  pl.invulnT = Math.max(0, pl.invulnT - dt);
  pl.laneAge += dt;
  const cruise = cruiseSpeed(p);
  let target = cruise;
  let accel = pl.speed > cruise ? 12 : 5;
  if (pl.brakeT > 0) [target, accel] = [cruise * 0.4, 22];
  else if (pl.nitroT > 0) [target, accel] = [NITRO_MPH * MPH, 45];
  else if (pl.boostT > 0) [target, accel] = [cruise + BOOST_MPH * MPH, 14];
  pl.speed = approach(pl.speed, target, accel * dt);
  const camera = (s: number) => Math.floor((s - SPEED_CAMERA.offset) / SPEED_CAMERA.period);
  const before = camera(pl.s);
  pl.s += pl.speed * dt;
  st.bestClean = Math.max(st.bestClean, pl.s - st.cleanFrom);
  if (camera(pl.s) > before && toMph(pl.speed) >= SPEED_CAMERA.mph) {
    const mph = toMph(pl.speed);
    const points = Math.round((200 + 10 * (mph - SPEED_CAMERA.mph)) * st.multiplier);
    st.score += points;
    st.traps++;
    events.push({ type: "speedTrap", mph: Math.round(mph), points });
  }

  // Combo timer: a pass refills it; once empty the multiplier drops a step every second.
  if (st.combo > 0) {
    st.comboT -= dt;
    if (st.comboT <= 0) {
      st.combo = Math.min(st.combo, MAX_COMBO) - 1;
      st.multiplier = multiplier(st.combo);
      st.comboT = st.combo > 0 ? 1 : 0;
    }
  }

  // Slipstream: close behind a car in our lane fills the meter (faster the closer); away from one it fades.
  if (pl.draft < 1) {
    const gap = draftGap(state);
    if (gap === null) pl.draft = Math.max(0, pl.draft - dt * 0.25);
    else {
      pl.draft = Math.min(1, pl.draft + dt * 3 * (1 - gap / DRAFT_RANGE));
      if (pl.draft === 1) events.push({ type: "draftReady" });
    }
  }
  st.maxSpeed = Math.max(st.maxSpeed, pl.speed);

  // Player: lateral spring (semi-implicit Euler)
  pl.vx += (LAT_K * (laneX(pl.lane) - pl.x) - LAT_C * pl.vx) * dt;
  pl.x += pl.vx * dt;

  // Traffic
  for (const n of state.npcs) {
    if (n.kind === "merger") think(state, n, dt);
    const tx = laneX(n.targetLane);
    n.x = approach(n.x, tx, n.latSpeed * dt);
    if (n.x === tx) {
      n.lane = n.targetLane;
      if (n.signalT <= 0) n.signal = 0;
    }
    let want = n.cruise;
    const lead = leader(state, n);
    if (lead && lead.gap < 6) want = Math.min(want, lead.speed * 0.85);
    else if (lead && lead.gap < 25) want = Math.min(want, lead.speed);
    n.speed = approach(n.speed, want, (want < n.speed ? 12 : 3) * dt);
    n.s += n.speed * dt;
  }

  // Contacts and passes
  for (const n of state.npcs) {
    const rel = n.s - pl.s;
    const halfL = (n.length + PLAYER_DIMS.length) / 2;
    const halfW = (n.width + PLAYER_DIMS.width) / 2;
    if (!n.hit && pl.invulnT <= 0 && Math.abs(rel) < halfL && Math.abs(n.x - pl.x) < halfW * 0.92) {
      collide(state, n, events);
      if (pl.lives <= 0) return events;
    }
    if (!n.passed && rel < -halfL) {
      n.passed = true;
      if (!n.hit) scorePass(state, n, events);
    } else if (n.passed && rel > 10) n.passed = false;
  }

  state.npcs = state.npcs.filter((n) => n.s - pl.s > DESPAWN[0] && n.s - pl.s < DESPAWN[1]);
  // Each lane gets its next car once its last one has drifted a random gap behind the spawn line,
  // so traffic stays evenly spread instead of bunching where a slow-drifting car hogs a global count.
  for (let lane = 0; lane < LANES; lane++) {
    let last = -Infinity;
    for (const n of state.npcs) if (n.targetLane === lane && n.s - pl.s <= SPAWN_AT) last = Math.max(last, n.s);
    if (last < pl.s + SPAWN_AT - state.laneGap[lane] && spawn(state, pl.s + SPAWN_AT, lane)) state.laneGap[lane] = laneGap(state);
  }
  return events;
}

const MAX_COMBO = Math.round((MAX_MULTIPLIER - 1) / MULTIPLIER_STEP); // passes that reach the top multiplier
const multiplier = (combo: number) => Math.min(MAX_MULTIPLIER, 1 + combo * MULTIPLIER_STEP);

/** Bumper gap to the nearest car ahead in the player's lane, if it is within slipstream range. */
function draftGap(state: GameState): number | null {
  const pl = state.player;
  let best: number | null = null;
  for (const n of state.npcs) {
    if (n.hit || Math.abs(n.x - pl.x) > (n.width + PLAYER_DIMS.width) * 0.4) continue;
    const gap = n.s - pl.s - (n.length + PLAYER_DIMS.length) / 2;
    if (gap > 0 && gap < DRAFT_RANGE && (best === null || gap < best)) best = gap;
  }
  return best;
}

/** Nearest car (or the player) ahead that overlaps this one sideways. */
function leader(state: GameState, n: Npc): { gap: number; speed: number } | null {
  let best: { gap: number; speed: number } | null = null;
  const consider = (s: number, x: number, length: number, width: number, speed: number) => {
    if (s <= n.s || Math.abs(x - n.x) > (width + n.width) / 2 + 0.3) return;
    const gap = s - n.s - (length + n.length) / 2;
    if (!best || gap < best.gap) best = { gap, speed };
  };
  for (const o of state.npcs) if (o !== n) consider(o.s, o.x, o.length, o.width, o.speed);
  const pl = state.player;
  consider(pl.s, pl.x, PLAYER_DIMS.length, PLAYER_DIMS.width, pl.speed);
  return best;
}

const laneClear = (state: GameState, lane: number, s: number, self: Npc) =>
  !state.npcs.some((o) => o !== self && Math.abs(o.x - laneX(lane)) < 2.4 && Math.abs(o.s - s) < 14);

/** Red mergers: indicate 1.5–2 s then slide, or (rarely) cut straight across. */
function think(state: GameState, n: Npc, dt: number) {
  if (n.signalT > 0) {
    n.signalT -= dt;
    if (n.signalT > 0) return;
    n.signalT = 0;
    const to = n.lane + n.signal;
    if (laneClear(state, to, n.s, n)) [n.targetLane, n.latSpeed] = [to, 2.4];
    else n.signal = 0;
    return;
  }
  if (n.lane !== n.targetLane) return;
  n.mergeCd -= dt;
  if (n.mergeCd > 0) return;
  n.mergeCd = 2 + rand(state) * 4;
  let dir: -1 | 1 = rand(state) < 0.5 ? -1 : 1;
  if (n.lane + dir < 0 || n.lane + dir >= LANES) dir = -dir as -1 | 1;
  const to = n.lane + dir;
  const pl = state.player;
  // Never side-swipe a player who is already alongside: that would be unavoidable.
  if (Math.abs(laneX(to) - pl.x) < 2.4 && Math.abs(n.s - pl.s) < 8) return;
  if (!laneClear(state, to, n.s, n)) return;
  if (rand(state) < SURPRISE_CUT_CHANCE) [n.targetLane, n.latSpeed, n.signal] = [to, 6, 0];
  else [n.signal, n.signalT] = [dir, 1.5 + rand(state) * 0.5];
}

function collide(state: GameState, n: Npc, events: GameEvent[]) {
  const { player: pl, stats: st } = state;
  n.hit = true;
  n.speed += 3;
  if (state.mode !== "zen") pl.lives--;
  pl.invulnT = INVULN_TIME;
  pl.speed *= 0.5;
  pl.nitroT = 0;
  pl.cutId = 0;
  pl.vx += Math.sign(pl.x - n.x || 1) * 4;
  st.combo = 0;
  st.comboT = 0;
  st.multiplier = 1;
  st.cleanFrom = pl.s;
  events.push({ type: "collision", npcId: n.id, lives: pl.lives });
  if (pl.lives <= 0) {
    state.status = "over";
    events.push({ type: "gameOver" });
  }
}

function scorePass(state: GameState, n: Npc, events: GameEvent[]) {
  const { player: pl, stats: st } = state;
  const gap = Math.abs(n.x - pl.x) - (n.width + PLAYER_DIMS.width) / 2;
  let grade: PassGrade = gap < 2 ? "dangerous" : "standard";
  if (n.id === pl.cutId) {
    grade = "cleanCut";
    pl.cutId = 0;
    st.cleanCuts++;
  }
  const points = Math.round(POINTS[grade] * st.multiplier);
  st.score += points;
  st.passes++;
  st.combo++;
  st.maxCombo = Math.max(st.maxCombo, st.combo);
  st.comboT = COMBO_TIME;
  st.multiplier = multiplier(st.combo);
  events.push({ type: "overtake", grade, points, npcId: n.id });
}

/** Road distance before the next car in a lane: wide early, tighter as difficulty rises. */
const laneGap = (state: GameState) => (90 - 38 * progress(state)) * (0.6 + rand(state) * 0.8) * (state.mode === "rush" ? RUSH_GAP : 1);

/** Adds one car at road distance `s` if there is room. `avoidLane` keeps a lane clear (start of a run). */
export function spawn(state: GameState, s: number, lane = Math.floor(rand(state) * LANES), avoidLane = -1): Npc | null {
  const p = progress(state);
  const kind = rand(state) < 0.3 + p * 0.15 ? "merger" : "cruiser";
  const pool = kind === "merger" ? MERGERS : CRUISERS;
  const model = pool[Math.floor(rand(state) * pool.length)];
  const mph = lane === 0 ? 85 + rand(state) * 10 : 60 + rand(state) * 20;
  if (lane === avoidLane && s - state.player.s < 120) return null;
  if (state.npcs.some((o) => Math.abs(o.s - s) < 22 && Math.abs(o.x - laneX(lane)) < 2)) return null;
  if (state.npcs.filter((o) => Math.abs(o.s - s) < 14).length >= 3) return null; // always leave a gap
  const n: Npc = {
    id: state.nextId++, model, kind, length: MODELS[model].length, width: MODELS[model].width,
    s, x: laneX(lane), lane, targetLane: lane, latSpeed: 2.4,
    speed: mph * MPH, cruise: mph * MPH,
    signal: 0, signalT: 0, mergeCd: 1 + rand(state) * 3, passed: false, hit: false,
  };
  state.npcs.push(n);
  return n;
}

export const accuracy = (st: GameState["stats"]) => (st.keys ? (st.correctKeys / st.keys) * 100 : 100);

/** Plain numbers for the HUD (rendering reads `state` directly). */
export function snapshot(s: GameState) {
  const { player: pl, stats: st } = s;
  return {
    status: s.status,
    mode: s.mode,
    timeLeft: s.mode === "timeAttack" ? Math.max(0, TIME_ATTACK_S - st.elapsed) : null,
    word: s.word,
    nextWord: s.nextWord,
    speedMph: toMph(pl.speed),
    maxSpeedMph: toMph(st.maxSpeed),
    lives: pl.lives,
    score: st.score,
    multiplier: st.multiplier,
    combo: st.combo,
    comboT: st.comboT,
    draft: pl.draft,
    cleanCuts: st.cleanCuts,
    accuracy: accuracy(st),
    distance: pl.s,
    nitro: pl.nitroT > 0,
    brake: pl.brakeT > 0,
  };
}
export type Snapshot = ReturnType<typeof snapshot>;

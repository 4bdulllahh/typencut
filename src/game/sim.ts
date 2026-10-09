import {
  BRAKE_TIME, CLEAN_CUT_GAP, CRUISE_MPH, CRUISERS, INVULN_TIME, LANES, MAX_MULTIPLIER, MERGERS, MODELS, MPH,
  MULTIPLIER_STEP, NITRO_MPH, NITRO_TIME, PLAYER_DIMS, POINTS, START_LIVES, SURPRISE_CUT_CHANCE, laneX, toMph,
} from "./config.ts";
import type { Command, GameEvent, GameState, Npc, PassGrade } from "./types.ts";
import { pickWord } from "./words.ts";

const LAT_K = 90; // lane-change spring stiffness (critically damped, ~0.5 s settle)
const LAT_C = 2 * Math.sqrt(LAT_K);
const SPAWN_AHEAD = [230, 320] as const;
const DESPAWN = [-80, 460] as const;

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

export function createState(seed = Date.now()): GameState {
  const state: GameState = {
    status: "ready",
    seed: seed | 0,
    nextId: 1,
    player: {
      s: 0, x: laneX(2), vx: 0, lane: 2, prevLane: 2, laneAge: 99, speed: cruiseSpeed(0),
      nitroT: 0, brakeT: 0, invulnT: 0, lives: START_LIVES, cutId: 0,
    },
    npcs: [],
    stats: {
      score: 0, combo: 0, multiplier: 1, passes: 0, cleanCuts: 0, maxSpeed: 0,
      keys: 0, correctKeys: 0, words: 0, chars: 0, misses: 0, elapsed: 0,
    },
    word: "",
    nextWord: "",
  };
  state.word = pickWord(() => rand(state), 0);
  state.nextWord = pickWord(() => rand(state), 0, state.word);
  // Pre-fill the road, keeping the player's lane clear for the first stretch.
  for (let i = 0; i < 40; i++) spawn(state, 50 + rand(state) * 270, 2);
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
    return events;
  }
  if (state.status !== "running") return events;
  if (cmd.type === "miss") {
    st.misses++;
    events.push({ type: "miss" });
  } else if (cmd.type === "brake") {
    pl.brakeT = BRAKE_TIME;
    pl.nitroT = 0;
    events.push({ type: "brake" });
  } else {
    st.words++;
    st.chars += cmd.chars;
    const to = pl.lane + cmd.dir;
    if (to >= 0 && to < LANES) {
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
    if (cmd.nitro) {
      pl.nitroT = NITRO_TIME;
      pl.brakeT = 0;
      events.push({ type: "nitro" });
    }
    state.word = state.nextWord;
    state.nextWord = pickWord(() => rand(state), progress(state), state.word);
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

  // Player: speed
  pl.nitroT = Math.max(0, pl.nitroT - dt);
  pl.brakeT = Math.max(0, pl.brakeT - dt);
  pl.invulnT = Math.max(0, pl.invulnT - dt);
  pl.laneAge += dt;
  const cruise = cruiseSpeed(p);
  let target = cruise;
  let accel = pl.speed > cruise ? 12 : 5;
  if (pl.brakeT > 0) [target, accel] = [cruise * 0.4, 22];
  else if (pl.nitroT > 0) [target, accel] = [NITRO_MPH * MPH, 45];
  pl.speed = approach(pl.speed, target, accel * dt);
  pl.s += pl.speed * dt;
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
  if (state.npcs.length < Math.round(10 + p * 10)) {
    spawn(state, pl.s + SPAWN_AHEAD[0] + rand(state) * (SPAWN_AHEAD[1] - SPAWN_AHEAD[0]));
  }
  return events;
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
  pl.lives--;
  pl.invulnT = INVULN_TIME;
  pl.speed *= 0.5;
  pl.nitroT = 0;
  pl.cutId = 0;
  pl.vx += Math.sign(pl.x - n.x || 1) * 4;
  st.combo = 0;
  st.multiplier = 1;
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
  st.multiplier = Math.min(MAX_MULTIPLIER, 1 + st.combo * MULTIPLIER_STEP);
  events.push({ type: "overtake", grade, points, npcId: n.id });
}

/** Adds one car at road distance `s` if there is room. `avoidLane` keeps a lane clear (start of a run). */
export function spawn(state: GameState, s: number, avoidLane = -1): Npc | null {
  const p = progress(state);
  const lane = Math.floor(rand(state) * LANES);
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

export const wpm = (st: GameState["stats"]) => (st.chars / 5) / (Math.max(st.elapsed, 5) / 60);
export const accuracy = (st: GameState["stats"]) => (st.keys ? (st.correctKeys / st.keys) * 100 : 100);

/** Plain numbers for the HUD (rendering reads `state` directly). */
export function snapshot(s: GameState) {
  const { player: pl, stats: st } = s;
  return {
    status: s.status,
    word: s.word,
    nextWord: s.nextWord,
    speedMph: toMph(pl.speed),
    maxSpeedMph: toMph(st.maxSpeed),
    lives: pl.lives,
    score: st.score,
    multiplier: st.multiplier,
    combo: st.combo,
    cleanCuts: st.cleanCuts,
    wpm: wpm(st),
    accuracy: accuracy(st),
    distance: pl.s,
    nitro: pl.nitroT > 0,
    brake: pl.brakeT > 0,
  };
}
export type Snapshot = ReturnType<typeof snapshot>;

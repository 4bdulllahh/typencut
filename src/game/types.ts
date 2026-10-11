export type PlayerModel = "gt3rs" | "turbos" | "m4";
export type CarModel = PlayerModel | "yaris" | "civic" | "malibu" | "rogue" | "f150" | "m3" | "c63" | "a5";
export type NpcKind = "cruiser" | "merger";
export type Dir = -1 | 1;
export type PassGrade = "standard" | "dangerous" | "cleanCut";
export type Status = "ready" | "running" | "over";
/** daily = classic rules on a seed taken from the date. zen = crashes cost no lives. Every mode plays with typing or driving controls (GameState.driving). */
export type Mode = "classic" | "zen" | "rush" | "timeAttack" | "daily";
/** Looks and sound only: the simulation drives the same in every weather. */
export type Weather = "clear" | "rain" | "fog";

export interface Npc {
  id: number;
  model: CarModel;
  kind: NpcKind;
  length: number;
  width: number;
  s: number; // distance along the road (m)
  x: number; // lateral position (m)
  lane: number;
  targetLane: number;
  latSpeed: number; // m/s while sliding between lanes
  speed: number; // m/s
  cruise: number; // m/s it wants to hold
  signal: -1 | 0 | 1; // amber indicator side
  signalT: number; // seconds left before the slide starts
  mergeCd: number; // seconds until it may think about merging again
  passed: boolean;
  hit: boolean;
}

/** A floating heart on the road: driving through it gives back a life. */
export interface Heart {
  id: number;
  s: number;
  x: number;
  lane: number;
}

export interface Player {
  s: number;
  x: number;
  vx: number;
  lane: number;
  prevLane: number;
  laneAge: number; // seconds since the last lane change
  speed: number;
  nitroT: number;
  nitroCd: number; // seconds until nitro can fire again
  throttle: boolean; // driving controls: pedals held
  braking: boolean;
  gear: number; // driving: current gear (1–7)
  shiftT: number; // driving: seconds left in an upshift (no pull)
  brakeT: number;
  boostT: number;
  draft: number; // slipstream meter 0–1; full = the next word fires a free nitro
  invulnT: number;
  lives: number;
  cutId: number; // npc we just cut out from behind (clean-cut candidate), 0 = none
}

export interface Stats {
  score: number;
  combo: number;
  multiplier: number;
  comboT: number; // seconds before the multiplier starts draining
  passes: number;
  cleanCuts: number;
  maxSpeed: number; // m/s
  keys: number;
  correctKeys: number;
  words: number;
  misses: number;
  elapsed: number; // seconds of running time
  maxCombo: number;
  traps: number; // speed traps triggered
  slipstreams: number; // free nitros from a full draft meter
  cleanFrom: number; // road distance of the last crash (0 = none yet)
  bestClean: number; // longest stretch without a crash (m)
}

export interface GameState {
  status: Status;
  mode: Mode;
  driving: boolean; // driving controls (pedals + lane keys) instead of typing
  seed: number;
  nextId: number;
  player: Player;
  npcs: Npc[];
  hearts: Heart[];
  heartT: number; // running seconds since the last heart roll
  stats: Stats;
  word: string;
  nextWord: string;
  laneGap: number[]; // per lane: gap before its next car spawns
  words: string[][]; // the word pack, in length buckets
}

export type Command =
  | { type: "key"; correct: boolean }
  | { type: "word"; dir: Dir | 0; nitro: boolean } // dir 0 = submitted with Enter: no steer, small boost
  | { type: "drive"; dir: Dir | 0; nitro: boolean } // driving controls: a lane change, or (dir 0) a nitro; no word
  | { type: "pedal"; throttle?: boolean; brake?: boolean } // driving controls: pedals pressed or released
  | { type: "miss" }
  | { type: "brake" }
  | { type: "end" }; // finish the run now (the only way out of zen)

export type GameEvent =
  | { type: "start" }
  | { type: "key"; correct: boolean }
  | { type: "word"; word: string }
  | { type: "miss" }
  | { type: "laneChange"; dir: Dir }
  | { type: "nitro" }
  | { type: "nitroDenied" } // asked for nitro while it was still recharging
  | { type: "boost" }
  | { type: "slipstream" } // the draft meter filled and recharged nitro
  | { type: "speedTrap"; mph: number; points: number }
  | { type: "brake" }
  | { type: "overtake"; grade: PassGrade; points: number; npcId: number }
  | { type: "collision"; npcId: number; lives: number }
  | { type: "heart"; lives: number; healed: boolean }
  | { type: "gameOver" }
  | { type: "restart" };

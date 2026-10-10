export type CarModel = "gt3rs" | "yaris" | "civic" | "malibu" | "rogue" | "f150" | "m3" | "c63" | "a5";
export type NpcKind = "cruiser" | "merger";
export type Dir = -1 | 1;
export type PassGrade = "standard" | "dangerous" | "cleanCut";
export type Status = "ready" | "running" | "over";
/** daily = classic rules on a seed taken from the date. zen = crashes cost no lives. */
export type Mode = "classic" | "zen" | "rush" | "timeAttack" | "daily";

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

export interface Player {
  s: number;
  x: number;
  vx: number;
  lane: number;
  prevLane: number;
  laneAge: number; // seconds since the last lane change
  speed: number;
  nitroT: number;
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
}

export interface GameState {
  status: Status;
  mode: Mode;
  seed: number;
  nextId: number;
  player: Player;
  npcs: Npc[];
  stats: Stats;
  word: string;
  nextWord: string;
  laneGap: number[]; // per lane: gap before its next car spawns
  words: string[][]; // the word pack, in length buckets
}

export type Command =
  | { type: "key"; correct: boolean }
  | { type: "word"; dir: Dir | 0; nitro: boolean } // dir 0 = submitted with Enter: no steer, small boost
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
  | { type: "boost" }
  | { type: "draftReady" }
  | { type: "slipstream" } // a word spent a full draft meter on a free nitro
  | { type: "speedTrap"; mph: number; points: number }
  | { type: "brake" }
  | { type: "overtake"; grade: PassGrade; points: number; npcId: number }
  | { type: "collision"; npcId: number; lives: number }
  | { type: "gameOver" }
  | { type: "restart" };

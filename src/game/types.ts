export type CarModel = "gt3rs" | "yaris" | "civic" | "malibu" | "rogue" | "f150" | "m3" | "c63" | "a5";
export type NpcKind = "cruiser" | "merger";
export type Dir = -1 | 1;
export type PassGrade = "standard" | "dangerous" | "cleanCut";
export type Status = "ready" | "running" | "over";

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
  invulnT: number;
  lives: number;
  cutId: number; // npc we just cut out from behind (clean-cut candidate), 0 = none
}

export interface Stats {
  score: number;
  combo: number;
  multiplier: number;
  passes: number;
  cleanCuts: number;
  maxSpeed: number; // m/s
  keys: number;
  correctKeys: number;
  words: number;
  chars: number; // chars of completed words, incl. the steering key
  misses: number;
  elapsed: number; // seconds of running time
}

export interface GameState {
  status: Status;
  seed: number;
  nextId: number;
  player: Player;
  npcs: Npc[];
  stats: Stats;
  word: string;
  nextWord: string;
}

export type Command =
  | { type: "key"; correct: boolean }
  | { type: "word"; dir: Dir; nitro: boolean; chars: number }
  | { type: "miss" }
  | { type: "brake" };

export type GameEvent =
  | { type: "start" }
  | { type: "word"; word: string }
  | { type: "miss" }
  | { type: "laneChange"; dir: Dir }
  | { type: "nitro" }
  | { type: "brake" }
  | { type: "overtake"; grade: PassGrade; points: number; npcId: number }
  | { type: "collision"; npcId: number; lives: number }
  | { type: "gameOver" }
  | { type: "restart" };

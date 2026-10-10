import { accuracy } from "./sim.ts";
import type { GameState, PlayerModel } from "./types.ts";

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  /** Checked on every engine event during a run, and once more at game over. */
  met: (s: GameState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "cut1", name: "Clean cut", desc: "Cut out from right behind a car", met: (s) => s.stats.cleanCuts >= 1 },
  { id: "cut5", name: "Surgeon", desc: "5 clean cuts in one run", met: (s) => s.stats.cleanCuts >= 5 },
  { id: "combo10", name: "On a roll", desc: "10 passes in a row", met: (s) => s.stats.maxCombo >= 10 },
  { id: "combo20", name: "Full send", desc: "Reach the ×5 multiplier", met: (s) => s.stats.maxCombo >= 20 },
  { id: "passes100", name: "Century", desc: "100 passes in one run", met: (s) => s.stats.passes >= 100 },
  { id: "trap1", name: "Say cheese", desc: "Set off a speed trap", met: (s) => s.stats.traps >= 1 },
  { id: "trap5", name: "Most wanted", desc: "5 speed traps in one run", met: (s) => s.stats.traps >= 5 },
  { id: "slip1", name: "Slipstreamer", desc: "Fire a free nitro from the draft", met: (s) => s.stats.slipstreams >= 1 },
  { id: "clean5k", name: "Clean sheet", desc: "5 km without a crash", met: (s) => s.stats.bestClean >= 5000 },
  { id: "score10k", name: "Five figures", desc: "10,000 points in one run", met: (s) => s.stats.score >= 10_000 },
  { id: "score50k", name: "High roller", desc: "50,000 points in one run", met: (s) => s.stats.score >= 50_000 },
  { id: "accurate", name: "Sharpshooter", desc: "100 words at 98% accuracy or better", met: (s) => s.stats.words >= 100 && accuracy(s.stats) >= 98 },
  { id: "clock", name: "Beat the clock", desc: "20,000 points in Time attack", met: (s) => s.mode === "timeAttack" && s.stats.score >= 20_000 },
  { id: "rush", name: "Gridlock", desc: "50 passes in Rush hour", met: (s) => s.mode === "rush" && s.stats.passes >= 50 },
  { id: "zen", name: "Zen garden", desc: "Drive 10 km in Zen", met: (s) => s.mode === "zen" && s.player.s >= 10_000 },
  { id: "daily", name: "Daily driver", desc: "Finish a daily challenge", met: (s) => s.mode === "daily" && s.status === "over" },
];

/** Unlocks by lifetime score (every finished run, every mode). */
export const PAINTS = [
  { id: "white", name: "White", color: "#f4f3ee", cost: 0 },
  { id: "red", name: "Guards red", color: "#c41e24", cost: 15_000 },
  { id: "blue", name: "Shark blue", color: "#1f6fd1", cost: 40_000 },
  { id: "green", name: "Python green", color: "#2e9e4f", cost: 80_000 },
  { id: "orange", name: "Lava orange", color: "#e8611a", cost: 150_000 },
  { id: "black", name: "Black", color: "#16171a", cost: 250_000 },
] as const;
export type PaintId = (typeof PAINTS)[number]["id"];

export const CARS: { id: PlayerModel; name: string; cost: number }[] = [
  { id: "gt3rs", name: "911 GT3 RS", cost: 0 },
  { id: "turbos", name: "911 Turbo S", cost: 100_000 },
  { id: "m4", name: "M4 Competition", cost: 200_000 },
];

export interface Progress {
  total: number; // lifetime score
  earned: Record<string, number>; // achievement id → ms epoch it was earned
}

const KEY = "typencut.progress";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/** localStorage is user-editable: a bad total becomes 0 and unknown or malformed achievements are dropped. */
export function parseProgress(raw: string | null): Progress {
  const p: Progress = { total: 0, earned: {} };
  try {
    const d = JSON.parse(raw ?? "null");
    if (isNum(d?.total)) p.total = d.total;
    for (const a of ACHIEVEMENTS) if (isNum(d?.earned?.[a.id])) p.earned[a.id] = d.earned[a.id];
  } catch {}
  return p;
}

export function loadProgress(): Progress {
  try {
    return parseProgress(localStorage.getItem(KEY));
  } catch {
    return parseProgress(null);
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

/** Achievements this state meets that `p` does not have yet. */
export const fresh = (p: Progress, s: GameState) => ACHIEVEMENTS.filter((a) => !(a.id in p.earned) && a.met(s));

export const earn = (p: Progress, list: Achievement[], date: number): Progress => ({
  ...p,
  earned: { ...p.earned, ...Object.fromEntries(list.map((a) => [a.id, date])) },
});

/** Paints and cars whose cost lies in (before, after]: what a run's score just unlocked. */
export const unlockedBetween = (before: number, after: number) =>
  [...PAINTS, ...CARS].filter((u) => u.cost > before && u.cost <= after).map((u) => u.name);

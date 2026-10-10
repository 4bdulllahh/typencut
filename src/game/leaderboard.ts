import type { Mode } from "./types.ts";

export interface Run {
  score: number;
  accuracy: number; // %
  maxSpeedMph: number;
  cleanCuts: number;
  date: number; // ms epoch
}
export type Records = Omit<Run, "date">;
export interface Board {
  runs: Run[]; // top runs by score, best first
  best: Records; // best value of each stat across every run, not just the top ones
}

/**
 * One board per mode; classic keeps the original key so v1 boards carry over. The daily challenge
 * gets a board per date. shortcut: old daily boards are never deleted (a few hundred bytes a day); prune if that ever matters.
 */
export const boardKey = (mode: Mode, date: string) =>
  mode === "classic" ? "typencut.board" : mode === "daily" ? `typencut.board.daily.${date}` : `typencut.board.${mode}`;
export const TOP_N = 10;
const STATS = ["score", "accuracy", "maxSpeedMph", "cleanCuts"] as const;

export const emptyBoard = (): Board => ({ runs: [], best: { score: 0, accuracy: 0, maxSpeedMph: 0, cleanCuts: 0 } });

export function addRun(board: Board, run: Run): Board {
  const runs = [...board.runs, run].sort((a, b) => b.score - a.score || a.date - b.date).slice(0, TOP_N);
  const best = { ...board.best };
  for (const k of STATS) best[k] = Math.max(best[k], run[k]);
  return { runs, best };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isRun = (r: unknown): r is Run => !!r && typeof r === "object" && [...STATS, "date"].every((k) => isNum((r as Record<string, unknown>)[k]));

/** localStorage is user-editable: anything malformed is dropped rather than trusted. Extra fields (e.g. `wpm` from v1.0) are ignored. */
export function parseBoard(raw: string | null): Board {
  const board = emptyBoard();
  try {
    const data = JSON.parse(raw ?? "null");
    if (Array.isArray(data?.runs)) board.runs = data.runs.filter(isRun).slice(0, TOP_N);
    for (const k of STATS) if (isNum(data?.best?.[k])) board.best[k] = data.best[k];
  } catch {}
  return board;
}

export function loadBoard(key: string): Board {
  try {
    return parseBoard(localStorage.getItem(key));
  } catch {
    return emptyBoard();
  }
}

export function saveRun(run: Run, key: string): Board {
  const board = addRun(loadBoard(key), run);
  try {
    localStorage.setItem(key, JSON.stringify(board));
  } catch {}
  return board;
}

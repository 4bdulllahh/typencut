import type { Dir } from "./types.ts";

/** Keys that submit the typed word and steer. `<`/`>` are the shifted comma/period. */
export const STEER_KEYS: Record<string, Dir> = { ",": -1, "<": -1, ".": 1, ">": 1 };
export const DOUBLE_TAP_MS = 350;

const isAllCaps = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase();

/** Exact match steers; the same letters in ALL CAPS steer with nitro; anything else is a miss. */
export function matchWord(typed: string, target: string): { nitro: boolean } | null {
  if (!typed || typed.toLowerCase() !== target.toLowerCase()) return null;
  if (isAllCaps(typed)) return { nitro: true };
  return typed === target ? { nitro: false } : null;
}

/** Live per-keystroke check; case is only judged on submit. */
export const isPrefix = (typed: string, target: string) => target.toLowerCase().startsWith(typed.toLowerCase());

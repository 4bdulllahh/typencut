import type { Dir } from "./types.ts";

export const DOUBLE_TAP_MS = 350;

/** A key the player bound: `code` is the physical key (so Shift doesn't change it), `key` what it printed when bound. */
export interface KeyBind { code: string; key: string }
export interface SteerKeys { left: KeyBind; right: KeyBind }
export const DEFAULT_STEER: SteerKeys = { left: { code: "Comma", key: "," }, right: { code: "Period", key: "." } };

// Letters are the words; these run the game or the shift/caps-lock nitro.
const RESERVED = ["Enter", "NumpadEnter", "Backspace", "Tab", "Escape", "ShiftLeft", "ShiftRight", "CapsLock"];
/** Any key but a letter or one of the reserved ones can steer. */
export const bindable = (code: string) => /^[A-Za-z0-9]{1,32}$/.test(code) && !code.startsWith("Key") && !RESERVED.includes(code);

/** Steer direction for a keydown. Falls back to the printed key for keyboards that send no `code` (some phones). */
export function steerDir(code: string, key: string, keys: SteerKeys): Dir | 0 {
  const hit = (b: KeyBind) => (code ? code === b.code : key === b.key);
  return hit(keys.left) ? -1 : hit(keys.right) ? 1 : 0;
}

/** How a bound key is shown on screen. */
export const keyLabel = (key: string) =>
  ({ " ": "Space", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" })[key] ?? (key.length === 1 ? key.toUpperCase() : key);

/** Drive mode: WASD or the arrow keys, by physical key. */
export const DRIVE_KEYS: Record<string, "left" | "right" | "up" | "down"> = {
  KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down",
};

const isAllCaps = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase();

/** Exact match steers; the same letters in ALL CAPS steer with nitro; anything else is a miss. */
export function matchWord(typed: string, target: string): { nitro: boolean } | null {
  if (!typed || typed.toLowerCase() !== target.toLowerCase()) return null;
  if (isAllCaps(typed)) return { nitro: true };
  return typed === target ? { nitro: false } : null;
}

/** Live per-keystroke check; case is only judged on submit. */
export const isPrefix = (typed: string, target: string) => target.toLowerCase().startsWith(typed.toLowerCase());

import { MODES } from "./config.ts";
import type { Mode } from "./types.ts";
import { PACK_IDS, type PackId } from "./words.ts";

export interface Settings {
  volume: number; // 0–1, master
  muted: boolean;
  engine: boolean; // engine note on/off
  quality: "high" | "low"; // low = no shadows, 1× pixel density
  reduceMotion: boolean; // no camera shake, nitro zoom or edge blur
  touch: boolean; // on-screen steering buttons + vibration on crashes
  mode: Mode;
  pack: PackId;
  customWords: string; // the player's own list, as typed (see parseWordList)
}

const KEY = "typencut.settings";

export const defaultSettings = (reduceMotion = false, touch = false): Settings => ({
  volume: 0.8, muted: false, engine: true, quality: "high", reduceMotion, touch, mode: "classic", pack: "driving", customWords: "",
});

/** localStorage is user-editable: each field is kept only if it has the right type and range. */
export function parseSettings(raw: string | null, base: Settings): Settings {
  const s = { ...base };
  try {
    const d = JSON.parse(raw ?? "null");
    if (typeof d?.volume === "number" && d.volume >= 0 && d.volume <= 1) s.volume = d.volume;
    if (d?.quality === "high" || d?.quality === "low") s.quality = d.quality;
    for (const k of ["muted", "engine", "reduceMotion", "touch"] as const) if (typeof d?.[k] === "boolean") s[k] = d[k];
    if (MODES.includes(d?.mode)) s.mode = d.mode;
    if (PACK_IDS.includes(d?.pack)) s.pack = d.pack;
    if (typeof d?.customWords === "string" && d.customWords.length <= 5000) s.customWords = d.customWords;
  } catch {}
  return s;
}

/** Defaults follow the device: reduced motion from the OS, buttons on touch screens. */
export function loadSettings(): Settings {
  const media = (q: string) => typeof matchMedia === "function" && matchMedia(q).matches;
  const base = defaultSettings(media("(prefers-reduced-motion: reduce)"), media("(pointer: coarse)"));
  try {
    return parseSettings(localStorage.getItem(KEY), base);
  } catch {
    return base;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

import { MODES } from "./config.ts";
import { DEFAULT_STEER, bindable, type KeyBind, type SteerKeys } from "./input.ts";
import { CARS, PAINTS, type PaintId } from "./progress.ts";
import type { Mode, PlayerModel, Weather } from "./types.ts";
import { PACK_IDS, type PackId } from "./words.ts";

/** Sound channels under the master volume. */
export const MIX = ["music", "engine", "weather", "typing", "effects"] as const;
/** Soundtrack source: the owner's Spotify playlist, the drum & bass generated in code (music.ts), or none. */
export const MUSIC = ["spotify", "dnb", "off"] as const;
export type Mix = Record<(typeof MIX)[number], number>;

export interface Settings {
  volume: number; // 0–1, master
  muted: boolean;
  mix: Mix; // 0–1 per channel; engine 0 = no engine note; music sets the generated track (Spotify plays at device volume)
  music: (typeof MUSIC)[number];
  quality: "high" | "low"; // low = no shadows, 1× pixel density
  reduceMotion: boolean; // no camera shake, nitro zoom or edge blur
  touch: boolean; // on-screen steering buttons + vibration on crashes
  mode: Mode;
  pack: PackId;
  customWords: string; // the player's own list, as typed (see parseWordList)
  car: PlayerModel; // chosen in the garage; Game.tsx falls back to the GT3 RS if it is still locked
  paint: PaintId;
  weather: Weather | "random"; // random = rolled per run from its seed (see rollWeather)
  steer: SteerKeys; // lane-switch keys in the typing modes
}

const KEY = "typencut.settings";
export const WEATHERS = ["random", "clear", "rain", "fog"] as const;

export const defaultSettings = (reduceMotion = false, touch = false): Settings => ({
  volume: 0.8, muted: false, mix: { music: 0.6, engine: 0.5, weather: 0.7, typing: 0.8, effects: 0.8 }, music: "spotify", quality: "high", reduceMotion, touch, mode: "classic", pack: "driving", customWords: "", car: "gt3rs", paint: "white", weather: "random", steer: DEFAULT_STEER,
});

/** localStorage is user-editable: each field is kept only if it has the right type and range. */
export function parseSettings(raw: string | null, base: Settings): Settings {
  const s = { ...base };
  try {
    const d = JSON.parse(raw ?? "null");
    if (typeof d?.volume === "number" && d.volume >= 0 && d.volume <= 1) s.volume = d.volume;
    if (d?.quality === "high" || d?.quality === "low") s.quality = d.quality;
    for (const k of ["muted", "reduceMotion", "touch"] as const) if (typeof d?.[k] === "boolean") s[k] = d[k];
    s.mix = { ...s.mix };
    for (const k of MIX) if (typeof d?.mix?.[k] === "number" && d.mix[k] >= 0 && d.mix[k] <= 1) s.mix[k] = d.mix[k];
    if (d?.engine === false && d?.mix === undefined) s.mix.engine = 0; // the old engine on/off switch (v1.2–1.8)
    if (MODES.includes(d?.mode)) s.mode = d.mode;
    if (PACK_IDS.includes(d?.pack)) s.pack = d.pack;
    if (CARS.some((c) => c.id === d?.car)) s.car = d.car;
    if (PAINTS.some((c) => c.id === d?.paint)) s.paint = d.paint;
    if (WEATHERS.includes(d?.weather)) s.weather = d.weather;
    if (MUSIC.includes(d?.music)) s.music = d.music;
    if (typeof d?.customWords === "string" && d.customWords.length <= 5000) s.customWords = d.customWords;
    const { left, right } = d?.steer ?? {};
    if (isBind(left) && isBind(right) && left.code !== right.code) s.steer = { left: { code: left.code, key: left.key }, right: { code: right.code, key: right.key } };
  } catch {}
  return s;
}

const isBind = (b: unknown): b is KeyBind =>
  typeof (b as KeyBind)?.code === "string" && bindable((b as KeyBind).code) && typeof (b as KeyBind).key === "string" && (b as KeyBind).key.length <= 32;

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

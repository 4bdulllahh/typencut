"use client";

import { useEffect, useRef, useState } from "react";
import { COMBO_TIME, MAX_MULTIPLIER, NITRO_MPH, START_LIVES } from "@/game/config";
import type { GameEngine } from "@/game/engine";
import type { Board } from "@/game/leaderboard";
import { DNB_TRACKS } from "@/game/music";
import { ACHIEVEMENTS, CARS, PAINTS, carUnlocked, type Progress } from "@/game/progress";
import { DEFAULT_STEER, bindable, keyLabel, type SteerKeys } from "@/game/input";
import { MIX, MUSIC, WEATHERS, type Settings } from "@/game/settings";
import type { Snapshot } from "@/game/sim";
import type { GameEvent, Mode, Weather } from "@/game/types";
import { MIN_CUSTOM_WORDS, PACK_IDS, parseWordList, type PackId } from "@/game/words";
import { Icon, SECTIONS, type Section } from "./Rail";
import { shareRun } from "./shareCard";

export const MODE_INFO: Record<Mode, [name: string, blurb: string]> = {
  classic: ["Classic", "Three lives, endless road"],
  zen: ["Zen", "Crashes cost no lives; end the run from the menu"],
  rush: ["Rush hour", "Traffic nearly twice as dense"],
  timeAttack: ["Time attack", "Best score in 90 seconds"],
  daily: ["Daily challenge", "Today's road, the same for everyone, with its own best"],
};
const PACK_LABELS: Record<PackId, string> = {
  driving: "Driving", common: "Common English", programming: "Programming", spanish: "Spanish", french: "French", german: "German", custom: "Your own list",
};
const dayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
export const dayLabel = (day: string) => dayFmt.format(new Date(`${day}T00:00:00Z`));
const clock = (t: number) => `${Math.floor(Math.ceil(t) / 60)}:${String(Math.ceil(t) % 60).padStart(2, "0")}`;

const Bar = ({ pct, className, thin = false }: { pct: number; className: string; thin?: boolean }) => (
  <div className={`overflow-hidden rounded-full bg-white/20 ${thin ? "mt-0.5 h-0.5" : "mt-1 h-1.5"}`}>
    <div className={`h-full rounded-full transition-[width] duration-150 ${className}`} style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }} />
  </div>
);

/** Nitro recharge as a small ring: fills over NITRO_COOLDOWN, amber and full when nitro is ready. */
function NitroRing({ charge }: { charge: number }) {
  const ready = charge >= 1;
  const C = 2 * Math.PI * 7;
  return (
    <svg viewBox="0 0 18 18" className="size-[18px] shrink-0 -rotate-90" role="img" aria-label={ready ? "Nitro ready" : `Nitro recharging, ${Math.round(charge * 100)}%`}>
      <circle cx="9" cy="9" r="7" fill="none" strokeWidth="2.5" className="stroke-white/20" />
      <circle
        cx="9" cy="9" r="7" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, charge)))}
        className={ready ? "stroke-orange-300" : "stroke-white/70"}
      />
      {ready && <circle cx="9" cy="9" r="2.5" className="fill-orange-300" />}
    </svg>
  );
}

/** Digital dash: speedometer + nitro recharge ring + slipstream meter, hearts + multiplier with its combo timer, score + live accuracy. */
export function Dashboard({ snap }: { snap: Snapshot }) {
  const mode = snap.nitro ? "nitro" : snap.brake ? "brake" : "";
  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-4 rounded-[22px] border border-white/10 bg-black/40 px-4 py-2.5 text-white tabular-nums shadow-lg backdrop-blur-md">
      <div className="w-24">
        <div className="flex items-center gap-2">
          <div className={`text-3xl font-extrabold leading-none ${snap.nitro ? "text-orange-300" : snap.brake ? "text-rose-300" : ""}`}>{Math.round(snap.speedMph)}</div>
          <NitroRing charge={snap.nitroCharge} />
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">mph {snap.driving && `· g${snap.gear}`} {mode && `· ${mode}`}</div>
        <Bar pct={snap.speedMph / NITRO_MPH} className={snap.nitro ? "bg-orange-400" : snap.brake ? "bg-rose-400" : "bg-white"} />
        <div className="mt-1 text-[9px] font-semibold uppercase tracking-widest opacity-70">draft</div>
        <Bar pct={snap.draft} className="bg-sky-300" />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          {snap.mode === "zen" ? (
            <span className="text-xs font-bold uppercase tracking-widest text-sky-200">zen</span>
          ) : (
            <span className="text-base tracking-wider" role="img" aria-label={`${snap.lives} of ${START_LIVES} lives`}>
              {Array.from({ length: START_LIVES }, (_, i) => (
                <span key={i} className={i < snap.lives ? "text-rose-400" : "opacity-25"}>♥</span>
              ))}
            </span>
          )}
          <span className="text-lg font-extrabold">×{snap.multiplier.toFixed(1)}</span>
        </div>
        <Bar pct={(snap.multiplier - 1) / (MAX_MULTIPLIER - 1)} className="bg-amber-300" />
        <Bar thin pct={snap.comboT / COMBO_TIME} className={snap.comboT < 2 ? "bg-rose-300" : "bg-white/80"} />
        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest opacity-70">combo {snap.combo}</div>
      </div>
      <div className="text-right">
        <div className="text-xl font-extrabold leading-tight">{snap.score.toLocaleString()}</div>
        <div className="text-xs font-semibold opacity-80">{snap.driving ? `${(snap.distance / 1000).toFixed(1)} km` : `${Math.round(snap.accuracy)}% accuracy`}</div>
        {snap.timeLeft !== null && (
          <div className={`text-sm font-extrabold ${snap.timeLeft < 10 ? "text-rose-300" : "text-amber-200"}`} aria-label={`${Math.ceil(snap.timeLeft)} seconds left`}>
            {clock(snap.timeLeft)}
          </div>
        )}
      </div>
    </div>
  );
}

interface Pop { id: number; text: string; sub: string; big: boolean }

const popFor = (e: GameEvent): Omit<Pop, "id"> | null =>
  e.type === "overtake" ? { text: `+${e.points}`, sub: e.grade === "cleanCut" ? "CLEAN CUT" : e.grade === "dangerous" ? "close pass" : "", big: e.grade === "cleanCut" }
  : e.type === "speedTrap" ? { text: `+${e.points} · ${e.mph} mph`, sub: "SPEED TRAP", big: true }
  : e.type === "slipstream" ? { text: "SLIPSTREAM", sub: "nitro recharged", big: false }
  : e.type === "collision" && e.lives > 0 ? { text: "CRASH", sub: `${e.lives} ♥ left`, big: false }
  : e.type === "nitroDenied" ? { text: "NITRO RECHARGING", sub: "", big: false }
  : e.type === "heart" ? { text: e.healed ? "+1 ♥" : "♥ FULL", sub: "", big: false }
  : null;

/** Floating callouts; clean cuts and speed traps get a big banner, and a speed trap flashes the screen like a camera. */
export function Popups({ engine }: { engine: GameEngine }) {
  const [items, setItems] = useState<Pop[]>([]);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    let n = 0;
    const off = engine.on((e) => {
      if (e.type === "speedTrap") setFlash((f) => f + 1);
      const pop = popFor(e);
      if (!pop) return;
      const id = ++n;
      setItems((list) => [...list.slice(-3), { id, ...pop }]);
      setTimeout(() => setItems((list) => list.filter((p) => p.id !== id)), 1100);
    });
    return off;
  }, [engine]);
  return (
    <>
      {/* Remounting by key replays the flash; it is outside the dock, so no input loses focus. */}
      {flash > 0 && <div key={flash} className="flash pointer-events-none absolute inset-0 bg-white" />}
      {/* Small, top right under the dashboard, so the road stays clear. */}
      <div className="pointer-events-none absolute right-4 top-[136px] flex flex-col items-end gap-0.5" aria-live="polite">
        {items.map((p) => (
          <div key={p.id} className={`pop text-center font-black italic text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] ${p.big ? "text-amber-300" : ""}`}>
            {p.sub && <div className={p.big ? "text-xl tracking-tight" : "text-[10px] uppercase tracking-widest"}>{p.sub}</div>}
            <div className={p.big ? "text-lg" : "text-base"}>{p.text}</div>
          </div>
        ))}
      </div>
    </>
  );
}

const Key = ({ children }: { children: React.ReactNode }) => <kbd className="rounded bg-white/15 px-1.5 font-semibold">{children}</kbd>;

/** The controls, shared by the start card (on dark glass) and the menu (on the page colour). */
function Controls({ cut = "text-amber-300", steer, drive }: { cut?: string; steer: SteerKeys; drive: boolean }) {
  if (drive)
    return (
      <ul className="space-y-1 text-sm">
        <li>Hold <Key>W</Key> or <Key>↑</Key> to accelerate through the gears; let go and you ease off (never below 45 mph)</li>
        <li>Tap <Key>W</Key> twice quickly for <b>nitro</b> (it recharges for 3.5 s, see the ring by the speed)</li>
        <li><Key>A</Key> <Key>D</Key> or <Key>←</Key> <Key>→</Key> switch lanes: tap for one lane, hold to keep moving over</li>
        <li>Hold <Key>S</Key> or <Key>↓</Key> to brake hard</li>
        <li>Sit close behind a car to fill the <b>draft</b> meter: a full meter recharges nitro</li>
        <li>Grab the floating <b className="text-rose-400">♥</b> hearts to win back a life</li>
        <li>Cut out from right behind a car for a <b className={cut}>CLEAN CUT</b>, which recharges nitro</li>
      </ul>
    );
  return (
    <ul className="space-y-1 text-sm">
      <li>Type the word, then <Key>{keyLabel(steer.left.key)}</Key> to go left or <Key>{keyLabel(steer.right.key)}</Key> to go right</li>
      <li><Key>Enter</Key> keeps your lane with a small speed boost</li>
      <li>Sit close behind a car to fill the <b>draft</b> meter: a full meter recharges nitro</li>
      <li>Pass a speed camera at <b>150+ mph</b> for a speed-trap bonus, and keep passing or your multiplier drains</li>
      <li><b>ALL CAPS</b> fires nitro, which then recharges for 3.5 s (the ring by the speed) · <Key>Enter</Key> twice on an empty box brakes</li>
      <li>Grab the floating <b className="text-rose-400">♥</b> hearts to win back a life</li>
      <li>Cut out from right behind a car for a <b className={cut}>CLEAN CUT</b>, which recharges nitro</li>
    </ul>
  );
}

export function ReadyOverlay({ best, mode, driving, pack, day, weather, steer }: { best: number; mode: Mode; driving: boolean; pack: PackId; day: string; weather: Weather; steer: SteerKeys }) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-[26%] mx-auto max-w-md rounded-[24px] border border-white/10 bg-black/45 p-6 text-center text-white shadow-xl backdrop-blur-md">
      <h1 className="text-3xl font-black italic tracking-tight">TYPENCUT</h1>
      <p className="mb-3 mt-1 text-xs font-semibold uppercase tracking-widest text-amber-200">
        {MODE_INFO[mode][0]}
        {mode === "daily" && ` · ${dayLabel(day)}`}{driving ? " · driving" : ` · ${PACK_LABELS[pack]} words`}{weather !== "clear" && ` · ${weather}`}
      </p>
      <Controls steer={steer} drive={driving} />
      <p className="mt-4 text-sm font-semibold opacity-90">{driving ? "Hold W or ↑ to go" : "Start typing to go"}{best > 0 && ` · best ${best.toLocaleString()}`}</p>
    </div>
  );
}

/** Esc during a run. The game is stopped while this shows; Esc again (Game.tsx) or Continue carries on. */
export function PauseMenu({ onContinue, onRestart, onEnd }: { onContinue: () => void; onRestart: () => void; onEnd: () => void }) {
  const btn = "w-full rounded-full py-3 font-semibold";
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="pause-title" className="w-full max-w-xs space-y-2 rounded-panel border border-line bg-surface p-6 text-center text-fg shadow-elev-2">
        <h2 id="pause-title" className="text-2xl font-black italic tracking-tight">Paused</h2>
        <p className="pb-2 text-xs text-fg-subtle">
          <kbd>Esc</kbd> to continue
        </p>
        <button autoFocus onClick={onContinue} className={`${btn} bg-stone-900 text-white hover:bg-stone-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200`}>
          Continue
        </button>
        <button onClick={onRestart} className={`${btn} bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15`}>
          Play again
        </button>
        <button onClick={onEnd} className={`${btn} bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15`}>
          End run
        </button>
      </div>
    </div>
  );
}

/** What a run earned: achievement names and the paints/cars its score unlocked. */
export interface RunNews { achievements: string[]; unlocks: string[] }

export function GameOver({ snap, board, runDate, day, news, onRestart }: {
  snap: Snapshot;
  board: Board;
  runDate?: number;
  day: string;
  news: RunNews;
  onRestart: () => void;
}) {
  const title = snap.mode === "daily" ? `Daily challenge · ${dayLabel(day)}` : MODE_INFO[snap.mode][0];
  const newBest = snap.score > 0 && snap.score >= board.best.score;
  const stats: [string, string][] = [
    snap.driving ? ["Passes", snap.passes.toString()] : ["Accuracy", `${Math.round(snap.accuracy)}%`],
    ["Top speed", `${Math.round(snap.maxSpeedMph)} mph`],
    ["Clean cuts", snap.cleanCuts.toString()],
    ["Distance", `${(snap.distance / 1000).toFixed(1)} km`],
  ];
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="go-title" className="w-full max-w-sm rounded-panel border border-line bg-surface p-6 text-center text-fg tabular-nums shadow-elev-2">
        <h2 id="go-title" className="text-sm font-semibold uppercase tracking-widest opacity-60">
          {snap.mode === "timeAttack" && snap.timeLeft === 0 ? "Time's up" : snap.mode === "zen" ? "Run ended" : "Run over"} · {MODE_INFO[snap.mode][0]}
        </h2>
        <div className="mt-1 text-5xl font-black">{snap.score.toLocaleString()}</div>
        {newBest && <div className="mt-1 text-sm font-bold text-amber-500">New best!</div>}
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-black/5 py-2 dark:bg-white/5">
              <dt className="text-[10px] font-semibold uppercase tracking-widest opacity-60">{k}</dt>
              <dd className="text-lg font-extrabold">{v}</dd>
            </div>
          ))}
        </dl>
        {news.achievements.length + news.unlocks.length > 0 && (
          <ul className="mt-3 space-y-1 text-left text-sm">
            {news.achievements.map((a) => (
              <li key={a}><span className="text-amber-500">★</span> Achievement: <b>{a}</b></li>
            ))}
            {news.unlocks.map((u) => (
              <li key={u}><span className="text-amber-500">◆</span> Unlocked: <b>{u}</b> (pick it in the menu)</li>
            ))}
          </ul>
        )}
        <div className="mt-4 text-left xl:hidden">
          <Leaderboard board={board} highlight={runDate} mode={snap.mode} driving={snap.driving} day={day} compact />
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={() => shareRun(snap, title)} className="rounded-full bg-black/5 px-5 py-3 font-semibold hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15">
            Share
          </button>
          <button autoFocus onClick={onRestart} className="flex-1 rounded-full bg-stone-900 py-3 font-semibold text-white hover:bg-stone-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
            Play again
          </button>
        </div>
      </div>
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** Top runs by score plus best-ever records, from localStorage. */
export function Leaderboard({ board, highlight, mode, driving, day, compact = false }: { board: Board; highlight?: number; mode: Mode; driving: boolean; day: string; compact?: boolean }) {
  const runs = compact ? board.runs.slice(0, 5) : board.runs;
  const typing = !driving; // driving has no typing, so no accuracy
  const records: [string, string][] = [
    ["Score", board.best.score.toLocaleString()],
    ...(typing ? [["Accuracy", `${Math.round(board.best.accuracy)}%`] as [string, string]] : []),
    ["Top speed", `${Math.round(board.best.maxSpeedMph)} mph`],
    ["Clean cuts", board.best.cleanCuts.toString()],
  ];
  return (
    <section className="text-sm tabular-nums">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-60">
        {mode === "daily" ? `Daily challenge · ${dayLabel(day)}` : `Leaderboard · ${MODE_INFO[mode][0]}`}{driving && " · driving"}
      </h2>
      {runs.length === 0 ? (
        <p className="opacity-60">No runs yet.</p>
      ) : (
        <ol className="space-y-0.5">
          {runs.map((r, i) => (
            <li key={`${r.date}-${i}`} className={`flex gap-3 rounded-md px-2 py-0.5 ${r.date === highlight ? "bg-amber-300/30 font-bold" : ""}`}>
              <span className="w-5 opacity-50">{i + 1}</span>
              <span className="flex-1 font-semibold">{r.score.toLocaleString()}</span>
              {typing && <span className="opacity-70">{Math.round(r.accuracy)}%</span>}
              {!compact && <span className="w-14 text-right opacity-50">{dateFmt.format(r.date)}</span>}
            </li>
          ))}
        </ol>
      )}
      {!compact && (
        <>
          <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-widest opacity-60">Best run records</h2>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            {records.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="opacity-60">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}

type Toggle = "muted" | "reduceMotion" | "touch";
const MIX_LABELS: Record<(typeof MIX)[number], [string, string]> = {
  music: ["Music", "The soundtrack"],
  engine: ["Engine", "Your car's engine note"],
  weather: ["Weather", "Rain and wind"],
  typing: ["Typing", "Key clicks"],
  effects: ["Effects", "Nitro, boosts, tyres, horns, crashes, pickups"],
};

/**
 * The sub pill: one menu section, opened beside the menu pill. Collapsed it is a slim bar (Close, icon, sideways title)
 * that stays open; hovering or focusing it expands it over the game (`onHover`). The game pauses while a section is
 * open (Game.tsx); Close or Escape closes it. On phones it is always expanded, below the icon row.
 */
export function Menu({ section, expanded, shifted, onHover, onClose, settings, onSettings, progress, onEnd, board }: {
  section: Section | null;
  expanded: boolean;
  shifted: boolean; // the menu pill is expanded: slide over so this bar stays in reach beside it
  onHover: () => void;
  onClose: () => void;
  board: React.ReactNode; // the leaderboard, for the Leaderboard section
  settings: Settings;
  onSettings: (s: Settings) => void;
  progress: Progress;
  onEnd?: () => void; // only while a run is going
}) {
  const [draft, setDraft] = useState(settings.customWords);
  const draftCount = parseWordList(draft).length;
  const first = useRef<HTMLButtonElement>(null);
  const open = section !== null;
  const shown = section;
  const title = SECTIONS.find(([id]) => id === shown)?.[1];
  useEffect(() => {
    if (!open) return;
    first.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, section, onClose]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onSettings({ ...settings, [k]: v });
  const label = (text: string, hint?: string) => (
    <span>
      <span className="block font-semibold">{text}</span>
      {hint && <span className="block text-xs opacity-60">{hint}</span>}
    </span>
  );
  const toggle = (k: Toggle, text: string, hint?: string) => (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
      {label(text, hint)}
      <input type="checkbox" checked={settings[k]} onChange={(e) => set(k, e.target.checked)} className="h-5 w-5 shrink-0 accent-amber-600" />
    </label>
  );
  const soon = (label: string, hint: string) => (
    <li>
      <button disabled className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left opacity-60">
        <span>
          <span className="block font-semibold">{label}</span>
          <span className="block text-xs opacity-80">{hint}</span>
        </span>
        <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest dark:bg-white/10">Soon</span>
      </button>
    </li>
  );
  if (!shown) return null;
  return (
    <div className={`z-40 shrink-0 max-sm:absolute max-sm:inset-x-3 max-sm:bottom-3 max-sm:top-[94px] sm:relative sm:w-14 sm:transition-transform sm:duration-200 ${shifted ? "sm:translate-x-[156px]" : ""}`} onMouseEnter={onHover} onFocus={(e) => e.target.matches(":focus-visible") && onHover()}>
      <section
        id="game-menu"
        aria-label={title}
        className={`flex overflow-hidden rounded-panel border border-line bg-surface shadow-elev-1 max-sm:h-full sm:absolute sm:inset-y-0 sm:left-0 sm:transition-[width] sm:duration-200 ${expanded ? "sm:w-80 sm:shadow-elev-2" : "sm:w-14"}`}
      >
        {/* Collapsed: a slim bar like the resting menu pill. */}
        <div className={`hidden w-14 shrink-0 flex-col items-center gap-4 py-3 ${expanded ? "" : "sm:flex"}`}>
          <button onClick={onClose} aria-label={`Close ${title}`} className="grid size-9 place-items-center rounded-full border border-line text-fg-subtle hover:bg-surface-muted hover:text-fg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-4" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <span className="text-accent"><Icon name={shown} /></span>
          <span className="text-sm font-bold text-fg-subtle [writing-mode:vertical-rl]">{title}</span>
        </div>
        <div className={`flex min-h-0 w-full shrink-0 flex-col gap-5 overflow-y-auto p-5 sm:w-80 ${expanded ? "" : "sm:hidden"}`}>
        <div className="flex items-center justify-between">
          <span>
            <span className="block text-lg font-bold">{title}</span>
            <span className="block text-xs font-semibold uppercase tracking-widest text-fg-subtle">Paused</span>
          </span>
          <button ref={first} onClick={onClose} className="rounded-full border border-line px-3 py-1 text-sm font-semibold hover:bg-surface-muted">
            Close
          </button>
        </div>
        {shown === "play" && (
          <ul className="-mx-3 space-y-1">
            {soon("Multiplayer", "Race friends live")}
          </ul>
        )}
        {shown === "play" && onEnd && (
          <button onClick={onEnd} className="-mt-2 rounded-xl bg-black/5 px-3 py-2 text-left text-sm font-semibold hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15">
            End this run
          </button>
        )}
        {shown === "play" && (<>
        <fieldset className="text-sm">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-widest opacity-60">Play by</legend>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10">
            {(["typing", "driving"] as const).map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="controls" checked={settings.controls === c} onChange={() => set("controls", c)} className="peer sr-only" />
                <span className="block rounded-lg py-1.5 text-center font-semibold capitalize peer-checked:bg-white peer-checked:shadow peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 dark:peer-checked:bg-slate-700">
                  {c}
                </span>
              </label>
            ))}
          </div>
          <span className="mt-1 block text-xs opacity-60">
            {settings.controls === "typing" ? "Type each word to steer" : "No typing: hold W to accelerate, A/D to change lanes, S to brake"}. Works in every mode, with its own leaderboard.
          </span>
        </fieldset>
        <fieldset className="text-sm">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-widest opacity-60">Mode</legend>
          {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
            <label key={m} className="flex cursor-pointer items-start gap-2 py-1">
              <input type="radio" name="mode" checked={settings.mode === m} onChange={() => set("mode", m)} className="mt-1 accent-amber-600" />
              {label(MODE_INFO[m][0], MODE_INFO[m][1])}
            </label>
          ))}
        </fieldset>
        <section className="text-sm">
          {settings.controls === "typing" && (<>
          <fieldset>
            <legend className="mb-1 block text-xs font-semibold uppercase tracking-widest opacity-60">Words</legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10">
              {PACK_IDS.map((id) => (
                <label key={id} className={`cursor-pointer ${id === "custom" ? "col-span-2" : ""}`}>
                  <input type="radio" name="pack" checked={settings.pack === id} onChange={() => set("pack", id)} className="peer sr-only" />
                  <span className="block rounded-lg px-2 py-1.5 text-center text-xs font-semibold peer-checked:bg-white peer-checked:shadow peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 dark:peer-checked:bg-slate-700">
                    {PACK_LABELS[id]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {settings.pack === "custom" && (
            <div className="mt-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 5000))}
                rows={4}
                placeholder="Paste or type words, separated by spaces or commas"
                aria-label="Your own words"
                className="w-full rounded-xl bg-black/5 px-3 py-2 dark:bg-white/10"
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className={`text-xs ${draftCount < MIN_CUSTOM_WORDS ? "text-rose-600 dark:text-rose-300" : "opacity-60"}`}>
                  {draftCount < MIN_CUSTOM_WORDS ? `${draftCount} words: add at least ${MIN_CUSTOM_WORDS} (letters only)` : `${draftCount} words`}
                </span>
                <button
                  onClick={() => set("customWords", draft)}
                  disabled={draftCount < MIN_CUSTOM_WORDS || draft === settings.customWords}
                  className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
                >
                  Use these words
                </button>
              </div>
            </div>
          )}
          </>)}
          <p className="mt-2 text-xs opacity-60">Changing the mode, controls or words starts a new run.</p>
        </section>
        </>)}
        {shown === "garage" && (
        <section className="text-sm">
          <h2 className="mb-1 flex justify-between text-xs font-semibold uppercase tracking-widest opacity-60">
            Garage <span className="normal-case tracking-normal tabular-nums">{progress.total.toLocaleString()} lifetime pts</span>
          </h2>
          {CARS.map((c, i, all) => {
            const current = all.find((o) => o.id === settings.car && carUnlocked(o, progress))?.id ?? all[0].id; // as Game.tsx drives it
            const locked = !carUnlocked(c, progress);
            const needs = ACHIEVEMENTS.find((a) => a.id === c.needs);
            return (
              <div key={c.id}>
                {needs && !CARS[i - 1].needs && <h3 className="mb-0.5 mt-2 text-xs font-semibold uppercase tracking-widest opacity-60">Hypercars</h3>}
                <label className={`flex items-center gap-2 py-1 ${locked ? "opacity-50" : "cursor-pointer"}`}>
                  <input type="radio" name="car" checked={current === c.id} disabled={locked} onChange={() => set("car", c.id)} className="accent-amber-600" />
                  <span className="flex-1 font-semibold">{c.name}</span>
                  {locked && <span className="text-xs tabular-nums">🔒 {needs ? needs.name : c.cost.toLocaleString()}</span>}
                </label>
              </div>
            );
          })}
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Paint">
            {PAINTS.map((p) => {
              const locked = progress.total < p.cost;
              return (
                <button
                  key={p.id}
                  onClick={() => set("paint", p.id)}
                  disabled={locked}
                  aria-pressed={settings.paint === p.id}
                  aria-label={locked ? `${p.name}, unlocks at ${p.cost.toLocaleString()} lifetime points` : p.name}
                  title={locked ? `${p.name} · ${p.cost.toLocaleString()} pts` : p.name}
                  className="grid h-8 w-8 place-items-center rounded-full border-2 border-black/15 text-xs aria-pressed:ring-2 aria-pressed:ring-amber-500 aria-pressed:ring-offset-2 disabled:opacity-40 dark:border-white/20 ring-offset-surface"
                  style={{ background: p.color }}
                >
                  {locked && "🔒"}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs opacity-60">Every finished run adds its score to your lifetime points. Hypercars unlock with their achievement. Every car drives the same.</p>
        </section>
        )}
        {shown === "achievements" && (
        <section className="text-sm">
          <h2 className="mb-1 flex justify-between text-xs font-semibold uppercase tracking-widest opacity-60">
            Achievements <span className="tabular-nums">{Object.keys(progress.earned).length}/{ACHIEVEMENTS.length}</span>
          </h2>
          <ul className="space-y-1">
            {ACHIEVEMENTS.map((a) => {
              const got = a.id in progress.earned;
              return (
                <li key={a.id} className={`flex gap-2 ${got ? "" : "opacity-50"}`}>
                  <span aria-hidden className={got ? "text-amber-600 dark:text-amber-300" : ""}>{got ? "★" : "☆"}</span>
                  <span>
                    <span className="block font-semibold">{a.name}<span className="sr-only">{got ? " (earned)" : " (not yet)"}</span></span>
                    <span className="block text-xs opacity-70">{a.desc}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        )}
        {shown === "board" && board}
        {shown === "settings" && (
        <section className="text-sm">
          <label className="block py-1.5">
            <span className="flex justify-between font-semibold">
              Master volume <span className="tabular-nums opacity-60">{settings.muted ? "muted" : `${Math.round(settings.volume * 100)}%`}</span>
            </span>
            <input
              type="range" min={0} max={100} value={Math.round(settings.volume * 100)}
              onChange={(e) => set("volume", Number(e.target.value) / 100)}
              className="mt-1 w-full accent-amber-600"
            />
          </label>
          <div className="space-y-1 border-l-2 border-line pl-3">
            {MIX.map((k) => (
              <label key={k} className="block py-0.5">
                <span className="flex justify-between gap-2">
                  <span>
                    <span className="font-semibold">{MIX_LABELS[k][0]}</span> <span className="text-xs opacity-60">{MIX_LABELS[k][1]}</span>
                  </span>
                  <span className="tabular-nums opacity-60">{Math.round(settings.mix[k] * 100)}%</span>
                </span>
                <input
                  type="range" min={0} max={100} value={Math.round(settings.mix[k] * 100)}
                  onChange={(e) => set("mix", { ...settings.mix, [k]: Number(e.target.value) / 100 })}
                  className="w-full accent-amber-600"
                />
              </label>
            ))}
          </div>
          {toggle("muted", "Mute")}
          <fieldset className="py-1.5">
            <legend className="font-semibold">Music</legend>
            <span className="block text-xs opacity-60">Drum &amp; bass made in code: pick a track, or turn it off</span>
            <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10">
              {MUSIC.map((m) => (
                <label key={m} className="cursor-pointer">
                  <input type="radio" name="music" checked={settings.music === m} onChange={() => set("music", m)} className="peer sr-only" />
                  <span className="block rounded-lg py-1 text-center text-xs font-semibold peer-checked:bg-white peer-checked:shadow peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 dark:peer-checked:bg-slate-700">
                    {{ dnb: "On", off: "Off" }[m]}
                  </span>
                </label>
              ))}
            </div>
            {settings.music === "dnb" && (
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10" role="radiogroup" aria-label="Track">
                {DNB_TRACKS.map((t, i) => (
                  <label key={t.name} className="cursor-pointer">
                    <input type="radio" name="track" checked={settings.track === i} onChange={() => set("track", i)} className="peer sr-only" />
                    <span className="block truncate rounded-lg px-2 py-1 text-xs font-semibold peer-checked:bg-white peer-checked:shadow peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 dark:peer-checked:bg-slate-700">
                      <span className="tabular-nums opacity-50">{i + 1}</span> {t.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <fieldset className="py-1.5">
            <legend className="font-semibold">Graphics</legend>
            <span className="block text-xs opacity-60">Low drops shadows and sharpness for slower devices</span>
            <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10">
              {(["high", "low"] as const).map((q) => (
                <label key={q} className="cursor-pointer">
                  <input type="radio" name="quality" checked={settings.quality === q} onChange={() => set("quality", q)} className="peer sr-only" />
                  <span className="block rounded-lg py-1 text-center font-semibold capitalize peer-checked:bg-white peer-checked:shadow peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 dark:peer-checked:bg-slate-700">
                    {q}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="py-1.5">
            <legend className="font-semibold">Weather</legend>
            <span className="block text-xs opacity-60">Random picks a new one for each run. Looks and sound only: the car drives the same</span>
            <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10">
              {WEATHERS.map((w) => (
                <label key={w} className="cursor-pointer">
                  <input type="radio" name="weather" checked={settings.weather === w} onChange={() => set("weather", w)} className="peer sr-only" />
                  <span className="block rounded-lg py-1 text-center text-xs font-semibold capitalize peer-checked:bg-white peer-checked:shadow peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 dark:peer-checked:bg-slate-700">
                    {w}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <SteerPicker steer={settings.steer} onChange={(v) => set("steer", v)} />
          {toggle("reduceMotion", "Reduce motion", "No camera shake, nitro zoom or edge blur")}
          {toggle("touch", "On-screen controls", "Steering buttons, and vibration on crashes")}
        </section>
        )}
        {shown === "help" && (
          <div className="[&_kbd]:bg-black/10 dark:[&_kbd]:bg-white/15">
            <Controls cut="text-amber-700 dark:text-amber-300" steer={settings.steer} drive={settings.controls === "driving"} />
          </div>
        )}
        </div>
      </section>
    </div>
  );
}

/** Rebind the lane-switch keys: click a side, press any key but a letter (letters are the words). Escape cancels. */
function SteerPicker({ steer, onChange }: { steer: SteerKeys; onChange: (s: SteerKeys) => void }) {
  const [wait, setWait] = useState<"left" | "right" | null>(null);
  const [error, setError] = useState("");
  const capture = (side: "left" | "right") => (e: React.KeyboardEvent) => {
    if (wait !== side || e.key === "Tab") return; // Tab still moves focus away
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") return setWait(null);
    const other = steer[side === "left" ? "right" : "left"];
    if (!bindable(e.code)) setError(/^Key/.test(e.code) ? "Letters are for typing words: pick another key." : `${keyLabel(e.key)} is taken by the game.`);
    else if (e.code === other.code) setError("That key already steers the other way.");
    else {
      onChange({ ...steer, [side]: { code: e.code, key: e.key } });
      setError("");
      setWait(null);
    }
  };
  const changed = steer.left.code !== DEFAULT_STEER.left.code || steer.right.code !== DEFAULT_STEER.right.code;
  return (
    <fieldset className="py-1.5">
      <legend className="font-semibold">Lane-switch keys</legend>
      <span className="block text-xs opacity-60">For the typing modes. Click a side, then press any key except a letter</span>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {(["left", "right"] as const).map((side) => (
          <button
            key={side}
            onClick={() => (setWait(wait === side ? null : side), setError(""))}
            onKeyDown={capture(side)}
            onBlur={() => wait === side && setWait(null)}
            aria-label={`${side === "left" ? "Left" : "Right"}: ${keyLabel(steer[side].key)}. ${wait === side ? "Press the new key" : "Click to change"}`}
            className={`rounded-xl border px-3 py-2 text-left ${wait === side ? "border-amber-500 bg-accent-soft" : "border-line bg-surface-muted hover:border-amber-500/60"}`}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-widest opacity-60">{side === "left" ? "‹ Left" : "Right ›"}</span>
            <span className="block text-base font-bold">{wait === side ? "Press a key…" : keyLabel(steer[side].key)}</span>
          </button>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <span role="status" className="text-rose-600 dark:text-rose-300">{error}</span>
        {changed && (
          <button onClick={() => onChange(DEFAULT_STEER)} className="shrink-0 font-semibold underline-offset-2 hover:underline">
            Reset to , and .
          </button>
        )}
      </div>
    </fieldset>
  );
}

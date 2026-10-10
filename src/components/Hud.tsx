"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_MULTIPLIER, NITRO_MPH, START_LIVES } from "@/game/config";
import type { GameEngine } from "@/game/engine";
import type { Board } from "@/game/leaderboard";
import type { Settings } from "@/game/settings";
import type { Snapshot } from "@/game/sim";

const Bar = ({ pct, className }: { pct: number; className: string }) => (
  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
    <div className={`h-full rounded-full transition-[width] duration-150 ${className}`} style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }} />
  </div>
);

/** Digital dash: speedometer, hearts + combo multiplier, score + live accuracy. */
export function Dashboard({ snap }: { snap: Snapshot }) {
  const mode = snap.nitro ? "nitro" : snap.brake ? "brake" : "";
  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-4 rounded-2xl bg-black/40 px-4 py-2.5 text-white tabular-nums shadow-lg backdrop-blur-md">
      <div className="w-20">
        <div className={`text-3xl font-extrabold leading-none ${snap.nitro ? "text-orange-300" : snap.brake ? "text-rose-300" : ""}`}>{Math.round(snap.speedMph)}</div>
        <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">mph {mode && `· ${mode}`}</div>
        <Bar pct={snap.speedMph / NITRO_MPH} className={snap.nitro ? "bg-orange-400" : snap.brake ? "bg-rose-400" : "bg-white"} />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-base tracking-wider" role="img" aria-label={`${snap.lives} of ${START_LIVES} lives`}>
            {Array.from({ length: START_LIVES }, (_, i) => (
              <span key={i} className={i < snap.lives ? "text-rose-400" : "opacity-25"}>♥</span>
            ))}
          </span>
          <span className="text-lg font-extrabold">×{snap.multiplier.toFixed(1)}</span>
        </div>
        <Bar pct={(snap.multiplier - 1) / (MAX_MULTIPLIER - 1)} className="bg-amber-300" />
        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest opacity-70">combo {snap.combo}</div>
      </div>
      <div className="text-right">
        <div className="text-xl font-extrabold leading-tight">{snap.score.toLocaleString()}</div>
        <div className="text-xs font-semibold opacity-80">{Math.round(snap.accuracy)}% accuracy</div>
      </div>
    </div>
  );
}

interface Pop { id: number; text: string; sub: string; big: boolean }

/** Floating "+points" callouts; a clean cut gets the big CLEAN CUT banner. */
export function Popups({ engine }: { engine: GameEngine }) {
  const [items, setItems] = useState<Pop[]>([]);
  useEffect(() => {
    let n = 0;
    const off = engine.on((e) => {
      const pop =
        e.type === "overtake" ? { text: `+${e.points}`, sub: e.grade === "cleanCut" ? "CLEAN CUT" : e.grade === "dangerous" ? "close pass" : "", big: e.grade === "cleanCut" }
        : e.type === "collision" && e.lives > 0 ? { text: "CRASH", sub: `${e.lives} ♥ left`, big: false }
        : null;
      if (!pop) return;
      const id = ++n;
      setItems((list) => [...list.slice(-3), { id, ...pop }]);
      setTimeout(() => setItems((list) => list.filter((p) => p.id !== id)), 1100);
    });
    return off;
  }, [engine]);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[30%] flex flex-col items-center gap-1" aria-live="polite">
      {items.map((p) => (
        <div key={p.id} className={`pop text-center font-black italic text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] ${p.big ? "text-amber-300" : ""}`}>
          {p.sub && <div className={p.big ? "text-5xl tracking-tight" : "text-sm uppercase tracking-widest"}>{p.sub}</div>}
          <div className={p.big ? "text-3xl" : "text-2xl"}>{p.text}</div>
        </div>
      ))}
    </div>
  );
}

const Key = ({ children }: { children: React.ReactNode }) => <kbd className="rounded bg-white/15 px-1.5 font-semibold">{children}</kbd>;

/** The controls, shared by the start card (on dark glass) and the menu (on the page colour). */
function Controls({ cut = "text-amber-300" }: { cut?: string }) {
  return (
    <ul className="space-y-1 text-sm">
      <li>Type the word, then <Key>,</Key> to go left or <Key>.</Key> to go right</li>
      <li><Key>Enter</Key> keeps your lane with a small speed boost</li>
      <li><b>ALL CAPS</b> fires nitro · <Key>Enter</Key> twice on an empty box brakes</li>
      <li>Cut out from right behind a car for a <b className={cut}>CLEAN CUT</b></li>
    </ul>
  );
}

export function ReadyOverlay({ best }: { best: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-[26%] rounded-2xl bg-black/45 p-5 text-center text-white shadow-xl backdrop-blur-md">
      <h1 className="mb-3 text-3xl font-black italic tracking-tight">TYPENCUT</h1>
      <Controls />
      <p className="mt-4 text-sm font-semibold opacity-90">Start typing to go{best > 0 && ` · best ${best.toLocaleString()}`}</p>
    </div>
  );
}

export function GameOver({ snap, board, runDate, onRestart }: { snap: Snapshot; board: Board; runDate?: number; onRestart: () => void }) {
  const newBest = snap.score > 0 && snap.score >= board.best.score;
  const stats: [string, string][] = [
    ["Accuracy", `${Math.round(snap.accuracy)}%`],
    ["Top speed", `${Math.round(snap.maxSpeedMph)} mph`],
    ["Clean cuts", snap.cleanCuts.toString()],
    ["Distance", `${(snap.distance / 1000).toFixed(1)} km`],
  ];
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="go-title" className="w-full max-w-sm rounded-2xl bg-white p-5 text-center text-stone-800 tabular-nums shadow-2xl dark:bg-slate-900 dark:text-slate-100">
        <h2 id="go-title" className="text-sm font-semibold uppercase tracking-widest opacity-60">Run over</h2>
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
        <div className="mt-4 text-left xl:hidden">
          <Leaderboard board={board} highlight={runDate} compact />
        </div>
        <button autoFocus onClick={onRestart} className="mt-5 w-full rounded-full bg-stone-900 py-3 font-semibold text-white hover:bg-stone-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
          Play again
        </button>
      </div>
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** Top runs by score plus best-ever records, from localStorage. */
export function Leaderboard({ board, highlight, compact = false }: { board: Board; highlight?: number; compact?: boolean }) {
  const runs = compact ? board.runs.slice(0, 5) : board.runs;
  const records: [string, string][] = [
    ["Score", board.best.score.toLocaleString()],
    ["Accuracy", `${Math.round(board.best.accuracy)}%`],
    ["Top speed", `${Math.round(board.best.maxSpeedMph)} mph`],
    ["Clean cuts", board.best.cleanCuts.toString()],
  ];
  return (
    <section className="text-sm tabular-nums">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-60">Leaderboard</h2>
      {runs.length === 0 ? (
        <p className="opacity-60">No runs yet.</p>
      ) : (
        <ol className="space-y-0.5">
          {runs.map((r, i) => (
            <li key={`${r.date}-${i}`} className={`flex gap-3 rounded-md px-2 py-0.5 ${r.date === highlight ? "bg-amber-300/30 font-bold" : ""}`}>
              <span className="w-5 opacity-50">{i + 1}</span>
              <span className="flex-1 font-semibold">{r.score.toLocaleString()}</span>
              <span className="opacity-70">{Math.round(r.accuracy)}%</span>
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

type Toggle = "muted" | "engine" | "reduceMotion" | "touch";

/** Slide-in panel on the left with the settings. The game pauses while it is open (Game.tsx); Escape or the backdrop closes it. */
export function Menu({ open, onClose, settings, onSettings }: { open: boolean; onClose: () => void; settings: Settings; onSettings: (s: Settings) => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
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
  return (
    <div className={`fixed inset-0 z-30 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <nav
        id="game-menu"
        aria-label="Menu"
        inert={!open}
        className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto bg-[#f4ead9] p-5 shadow-2xl transition-transform duration-200 dark:bg-[#0b1022] ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xl font-black italic tracking-tight">TYPENCUT</span>
          <button ref={first} onClick={onClose} className="rounded-full px-3 py-1 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10">
            Close
          </button>
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest opacity-60">Paused</p>
        <ul className="-mx-3 space-y-1">
          {soon("Multiplayer", "Race friends live")}
        </ul>
        <section className="text-sm">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest opacity-60">Settings</h2>
          <label className="block py-1.5">
            <span className="flex justify-between font-semibold">
              Volume <span className="tabular-nums opacity-60">{settings.muted ? "muted" : `${Math.round(settings.volume * 100)}%`}</span>
            </span>
            <input
              type="range" min={0} max={100} value={Math.round(settings.volume * 100)}
              onChange={(e) => set("volume", Number(e.target.value) / 100)}
              className="mt-1 w-full accent-amber-600"
            />
          </label>
          {toggle("muted", "Mute")}
          {toggle("engine", "Engine sound", "Revs rise with speed and drop on each gear change")}
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
          {toggle("reduceMotion", "Reduce motion", "No camera shake, nitro zoom or edge blur")}
          {toggle("touch", "On-screen controls", "Steering buttons, and vibration on crashes")}
        </section>
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-60">How to play</h2>
          <div className="[&_kbd]:bg-black/10 dark:[&_kbd]:bg-white/15">
            <Controls cut="text-amber-700 dark:text-amber-300" />
          </div>
        </section>
      </nav>
    </div>
  );
}

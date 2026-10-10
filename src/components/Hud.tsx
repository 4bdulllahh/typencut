"use client";

import { useEffect, useState } from "react";
import { MAX_MULTIPLIER, NITRO_MPH, START_LIVES } from "@/game/config";
import type { GameEngine } from "@/game/engine";
import type { Board } from "@/game/leaderboard";
import type { Snapshot } from "@/game/sim";

const Bar = ({ pct, className }: { pct: number; className: string }) => (
  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
    <div className={`h-full rounded-full transition-[width] duration-150 ${className}`} style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }} />
  </div>
);

/** Digital dash: speedometer, hearts + combo multiplier, score + live WPM. */
export function Dashboard({ snap }: { snap: Snapshot }) {
  const mode = snap.nitro ? "nitro" : snap.brake ? "brake" : "";
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 grid grid-cols-[auto_1fr_auto] gap-4 rounded-2xl bg-black/40 px-4 py-2.5 font-mono text-white shadow-lg backdrop-blur-md">
      <div className="w-20">
        <div className={`text-3xl font-bold leading-none tabular-nums ${snap.nitro ? "text-orange-300" : snap.brake ? "text-rose-300" : ""}`}>{Math.round(snap.speedMph)}</div>
        <div className="text-[10px] uppercase tracking-widest opacity-70">mph {mode && `· ${mode}`}</div>
        <Bar pct={snap.speedMph / NITRO_MPH} className={snap.nitro ? "bg-orange-400" : snap.brake ? "bg-rose-400" : "bg-white"} />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-base tracking-wider" role="img" aria-label={`${snap.lives} of ${START_LIVES} lives`}>
            {Array.from({ length: START_LIVES }, (_, i) => (
              <span key={i} className={i < snap.lives ? "text-rose-400" : "opacity-25"}>♥</span>
            ))}
          </span>
          <span className="text-lg font-bold tabular-nums">×{snap.multiplier.toFixed(1)}</span>
        </div>
        <Bar pct={(snap.multiplier - 1) / (MAX_MULTIPLIER - 1)} className="bg-amber-300" />
        <div className="mt-0.5 text-[10px] uppercase tracking-widest opacity-70">combo {snap.combo}</div>
      </div>
      <div className="text-right">
        <div className="text-xl font-bold leading-tight tabular-nums">{snap.score.toLocaleString()}</div>
        <div className="text-xs opacity-80 tabular-nums">{Math.round(snap.wpm)} wpm</div>
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

export function ReadyOverlay({ best }: { best: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-[24%] rounded-2xl bg-black/45 p-5 text-center text-white shadow-xl backdrop-blur-md">
      <h1 className="text-3xl font-black italic tracking-tight">TYPENCUT</h1>
      <ul className="mt-3 space-y-1 text-sm">
        <li>Type the word, then <kbd className="rounded bg-white/15 px-1.5 font-mono">,</kbd> to go left or <kbd className="rounded bg-white/15 px-1.5 font-mono">.</kbd> to go right</li>
        <li><b>ALL CAPS</b> fires nitro · <kbd className="rounded bg-white/15 px-1.5 font-mono">Enter</kbd> twice brakes</li>
        <li>Cut out from right behind a car for a <b className="text-amber-300">CLEAN CUT</b></li>
      </ul>
      <p className="mt-4 text-sm font-semibold opacity-90">Start typing to go{best > 0 && ` · best ${best.toLocaleString()}`}</p>
    </div>
  );
}

export function GameOver({ snap, board, runDate, onRestart }: { snap: Snapshot; board: Board; runDate?: number; onRestart: () => void }) {
  const newBest = snap.score > 0 && snap.score >= board.best.score;
  const stats: [string, string][] = [
    ["WPM", Math.round(snap.wpm).toString()],
    ["Accuracy", `${Math.round(snap.accuracy)}%`],
    ["Max speed", `${Math.round(snap.maxSpeedMph)} mph`],
    ["Clean cuts", snap.cleanCuts.toString()],
  ];
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="go-title" className="w-full max-w-sm rounded-2xl bg-white p-5 text-center text-stone-800 shadow-2xl dark:bg-slate-900 dark:text-slate-100">
        <h2 id="go-title" className="text-sm font-semibold uppercase tracking-widest opacity-60">Run over</h2>
        <div className="mt-1 text-5xl font-black tabular-nums">{snap.score.toLocaleString()}</div>
        {newBest && <div className="mt-1 text-sm font-bold text-amber-500">New best!</div>}
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-black/5 py-2 dark:bg-white/5">
              <dt className="text-[10px] uppercase tracking-widest opacity-60">{k}</dt>
              <dd className="font-mono text-lg font-bold tabular-nums">{v}</dd>
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
    ["WPM", Math.round(board.best.wpm).toString()],
    ["Accuracy", `${Math.round(board.best.accuracy)}%`],
    ["Top speed", `${Math.round(board.best.maxSpeedMph)} mph`],
    ["Clean cuts", board.best.cleanCuts.toString()],
  ];
  return (
    <section className="text-sm">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-60">Leaderboard</h2>
      {runs.length === 0 ? (
        <p className="opacity-60">No runs yet.</p>
      ) : (
        <ol className="space-y-0.5 font-mono">
          {runs.map((r, i) => (
            <li key={`${r.date}-${i}`} className={`flex gap-3 rounded-md px-2 py-0.5 tabular-nums ${r.date === highlight ? "bg-amber-300/30 font-bold" : ""}`}>
              <span className="w-5 opacity-50">{i + 1}</span>
              <span className="flex-1">{r.score.toLocaleString()}</span>
              <span className="opacity-70">{Math.round(r.wpm)} wpm</span>
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
                <dd className="text-right font-mono font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { attachAudio } from "@/game/audio";
import { GameEngine } from "@/game/engine";
import { loadBoard, saveRun } from "@/game/leaderboard";
import { snapshot } from "@/game/sim";
import { Dashboard, GameOver, Leaderboard, Popups, ReadyOverlay } from "./Hud";
import { Scene } from "./scene/Scene";
import { TypingDock } from "./TypingDock";

const THEME_KEY = "typencut.theme";
const readTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
};

/** Vignette plus a speed-scaled blur that only touches the screen edges. */
function EdgeFx({ speedMph, nitro }: { speedMph: number; nitro: boolean }) {
  const blur = Math.min(1, Math.max(0, (speedMph - 90) / 90)) * 4 + (nitro ? 2 : 0);
  const mask = "radial-gradient(ellipse 70% 62% at 50% 55%, transparent 60%, black 100%)";
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backdropFilter: `blur(${blur.toFixed(1)}px)`, WebkitBackdropFilter: `blur(${blur.toFixed(1)}px)`, maskImage: mask, WebkitMaskImage: mask }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(30,20,10,0.35)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.55)_100%)]" />
    </>
  );
}

export function Game() {
  const [engine] = useState(() => new GameEngine());
  const [snap, setSnap] = useState(() => snapshot(engine.state));
  const [night, setNight] = useState(() => readTheme() === "night");
  const [board, setBoard] = useState(loadBoard);
  const [runDate, setRunDate] = useState<number>();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", night);
    try {
      localStorage.setItem(THEME_KEY, night ? "night" : "day");
    } catch {}
  }, [night]);

  useEffect(() => attachAudio(engine), [engine]);

  useEffect(
    () =>
      engine.on((e) => {
        if (e.type !== "gameOver") return;
        const s = snapshot(engine.state);
        const date = Date.now();
        setBoard(saveRun({ score: s.score, wpm: s.wpm, accuracy: s.accuracy, maxSpeedMph: s.maxSpeedMph, cleanCuts: s.cleanCuts, date }));
        setRunDate(date);
      }),
    [engine],
  );

  useEffect(() => {
    engine.start();
    const refresh = () => setSnap(snapshot(engine.state));
    const id = setInterval(refresh, 100);
    const off = engine.on(refresh); // events (new word, crash…) show at once
    return () => {
      engine.stop();
      clearInterval(id);
      off();
    };
  }, [engine]);

  return (
    <main className="flex h-dvh justify-center xl:gap-6">
      <div className="hidden w-72 shrink-0 xl:block" aria-hidden />
      <div className="relative aspect-[9/16] h-full max-w-full overflow-hidden">
        <Scene engine={engine} night={night} />
        <EdgeFx speedMph={snap.speedMph} nitro={snap.nitro} />
        <Dashboard snap={snap} />
        <button
          className="absolute right-3 top-[5.25rem] rounded-full bg-black/30 px-3 py-1 text-xs text-white backdrop-blur"
          onClick={() => setNight((n) => !n)}
          aria-pressed={night}
        >
          {night ? "☾ Night" : "☀ Day"}
        </button>
        <Popups engine={engine} />
        {snap.status === "ready" && <ReadyOverlay best={board.best.score} />}
        <div className="absolute inset-x-0 bottom-6 flex justify-center px-3">
          <TypingDock engine={engine} word={snap.word} nextWord={snap.nextWord} disabled={snap.status === "over"} />
        </div>
        {snap.status === "over" && <GameOver snap={snap} board={board} runDate={runDate} onRestart={() => engine.restart()} />}
      </div>
      <aside className="hidden w-72 shrink-0 overflow-y-auto py-6 xl:block">
        <Leaderboard board={board} highlight={runDate} />
      </aside>
    </main>
  );
}

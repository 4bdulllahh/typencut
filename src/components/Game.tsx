"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { attachAudio } from "@/game/audio";
import { GameEngine } from "@/game/engine";
import { loadBoard, saveRun } from "@/game/leaderboard";
import { loadSettings, saveSettings } from "@/game/settings";
import { snapshot } from "@/game/sim";
import { Dashboard, GameOver, Leaderboard, Menu, Popups, ReadyOverlay } from "./Hud";
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

/** Vignette plus a speed-scaled blur that only touches the screen edges (no blur with reduce motion). */
function EdgeFx({ speedMph, nitro, still }: { speedMph: number; nitro: boolean; still: boolean }) {
  const blur = still ? 0 : Math.min(1, Math.max(0, (speedMph - 90) / 90)) * 4 + (nitro ? 2 : 0);
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
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const [settings, setSettings] = useState(loadSettings);
  const audio = useRef<ReturnType<typeof attachAudio>>(null);
  const vibrate = useRef(settings.touch);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", night);
    try {
      localStorage.setItem(THEME_KEY, night ? "night" : "day");
    } catch {}
  }, [night]);

  useEffect(() => {
    const a = attachAudio(engine, settings); // later changes arrive through `set` below
    audio.current = a;
    return a.detach;
  }, [engine]);

  useEffect(() => {
    saveSettings(settings);
    audio.current?.set(settings);
    vibrate.current = settings.touch;
    document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
  }, [settings]);

  useEffect(() => audio.current?.pause(menu), [menu]);

  useEffect(
    () =>
      engine.on((e) => {
        if (e.type === "collision" && vibrate.current) navigator.vibrate?.(e.lives > 0 ? 120 : [120, 60, 240]);
        if (e.type !== "gameOver") return;
        const s = snapshot(engine.state);
        const date = Date.now();
        setBoard(saveRun({ score: s.score, accuracy: s.accuracy, maxSpeedMph: s.maxSpeedMph, cleanCuts: s.cleanCuts, date }));
        setRunDate(date);
      }),
    [engine],
  );

  useEffect(() => {
    const refresh = () => setSnap(snapshot(engine.state));
    const id = setInterval(refresh, 100);
    const off = engine.on(refresh); // events (new word, crash…) show at once
    return () => {
      clearInterval(id);
      off();
    };
  }, [engine]);

  // The open menu pauses the game.
  useEffect(() => {
    if (menu) return;
    engine.start();
    return () => engine.stop();
  }, [engine, menu]);

  return (
    <main className="flex h-dvh justify-center xl:gap-6">
      <div className="hidden w-72 shrink-0 xl:block" aria-hidden />
      <div className="relative aspect-[9/16] h-full max-w-full overflow-hidden">
        <Scene engine={engine} night={night} quality={settings.quality} reduceMotion={settings.reduceMotion} />
        <EdgeFx speedMph={snap.speedMph} nitro={snap.nitro} still={settings.reduceMotion} />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-2">
          <Dashboard snap={snap} />
          <div className="flex justify-between [&>button]:pointer-events-auto [&>button]:rounded-full [&>button]:bg-black/30 [&>button]:px-3 [&>button]:py-1 [&>button]:text-xs [&>button]:font-semibold [&>button]:text-white [&>button]:backdrop-blur">
            <button onClick={() => setMenu(true)} aria-expanded={menu} aria-controls="game-menu">
              ☰ Menu
            </button>
            <button onClick={() => setNight((n) => !n)} aria-pressed={night}>
              {night ? "☾ Night" : "☀ Day"}
            </button>
          </div>
        </div>
        <Popups engine={engine} />
        {snap.status === "ready" && <ReadyOverlay best={board.best.score} />}
        <div className={`absolute inset-x-0 flex justify-center px-3 ${settings.touch ? "bottom-2" : "bottom-6"}`}>
          <TypingDock engine={engine} word={snap.word} nextWord={snap.nextWord} disabled={snap.status === "over" || menu} touch={settings.touch} />
        </div>
        {snap.status === "over" && <GameOver snap={snap} board={board} runDate={runDate} onRestart={() => engine.restart()} />}
      </div>
      <aside className="hidden w-72 shrink-0 overflow-y-auto py-6 xl:block">
        <Leaderboard board={board} highlight={runDate} />
      </aside>
      <Menu open={menu} onClose={closeMenu} settings={settings} onSettings={setSettings} />
    </main>
  );
}

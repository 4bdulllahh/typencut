"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attachAudio } from "@/game/audio";
import { GameEngine } from "@/game/engine";
import { boardKey, loadBoard, saveRun } from "@/game/leaderboard";
import { CARS, PAINTS, earn, fresh, loadProgress, saveProgress, unlockedBetween } from "@/game/progress";
import { loadSettings, saveSettings } from "@/game/settings";
import { rollWeather, seedFromDate, snapshot } from "@/game/sim";
import type { Weather } from "@/game/types";
import { packWords } from "@/game/words";
import { Dashboard, GameOver, Leaderboard, Menu, Popups, ReadyOverlay, type RunNews } from "./Hud";
import { Rail, type Section } from "./Rail";
import { Scene } from "./scene/Scene";
import { DriveDock, TypingDock } from "./TypingDock";

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

/** UTC date, so the daily challenge's road is the same everywhere on a given day. */
const today = () => new Date().toISOString().slice(0, 10);

export function Game() {
  const [engine] = useState(() => new GameEngine());
  const [snap, setSnap] = useState(() => snapshot(engine.state));
  const [night, setNight] = useState(() => readTheme() === "night");
  const [runDate, setRunDate] = useState<number>();
  const [section, setSection] = useState<Section | null>(null);
  const menu = section !== null;
  const closeMenu = useCallback(() => setSection(null), []);
  const [settings, setSettings] = useState(loadSettings);
  const [day, setDay] = useState(today); // fixed when a mode is applied, so a run that crosses midnight keeps its board
  const key = boardKey(settings.mode, day);
  const keyRef = useRef(key);
  const [board, setBoard] = useState(() => loadBoard(key));
  const words = useMemo(() => packWords(settings.pack, settings.customWords), [settings.pack, settings.customWords]);
  const progressRef = useRef(loadProgress());
  const [progress, setProgress] = useState(progressRef.current);
  const [news, setNews] = useState<RunNews>({ achievements: [], unlocks: [] });
  const [toast, setToast] = useState<{ id: number; text: string }>();
  // A locked choice (only possible by editing storage) falls back to the starting car and paint.
  const car = CARS.find((c) => c.id === settings.car && c.cost <= progress.total)?.id ?? "gt3rs";
  const paint = (PAINTS.find((p) => p.id === settings.paint && p.cost <= progress.total) ?? PAINTS[0]).color;
  // "random" weather is rolled from each new run's seed, so the daily challenge has the same weather for everyone.
  const [rolled, setRolled] = useState<Weather>("clear");
  const weather = settings.weather === "random" ? rolled : settings.weather;
  const reroll = useCallback(() => setRolled(rollWeather(engine.state.seed)), [engine]);
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
    vibrate.current = settings.touch;
    document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
  }, [settings]);

  useEffect(() => audio.current?.set({ ...settings, rain: weather === "rain" }), [settings, weather]);
  useEffect(() => audio.current?.pause(menu), [menu]);

  useEffect(() => {
    keyRef.current = key;
    setBoard(loadBoard(key));
  }, [key]);

  // A new mode or word pack starts a fresh run (the daily challenge on today's seed).
  useEffect(() => {
    const d = today();
    setDay(d);
    setRunDate(undefined);
    engine.restart({ mode: settings.mode, words, seed: settings.mode === "daily" ? seedFromDate(d) : undefined });
    reroll();
  }, [engine, settings.mode, words, reroll]);

  useEffect(
    () =>
      engine.on((e) => {
        if (e.type === "collision" && vibrate.current) navigator.vibrate?.(e.lives > 0 ? 120 : [120, 60, 240]);
        if (e.type === "restart") setNews({ achievements: [], unlocks: [] });
        let p = progressRef.current;
        const got = fresh(p, engine.state);
        if (got.length) {
          p = earn(p, got, Date.now());
          const names = got.map((a) => a.name);
          setToast({ id: Date.now(), text: names.join(" · ") });
          setNews((n) => ({ ...n, achievements: [...n.achievements, ...names] }));
        }
        if (e.type === "gameOver") {
          const s = snapshot(engine.state);
          const date = Date.now();
          setBoard(saveRun({ score: s.score, accuracy: s.accuracy, maxSpeedMph: s.maxSpeedMph, cleanCuts: s.cleanCuts, date }, keyRef.current));
          setRunDate(date);
          const unlocks = unlockedBetween(p.total, p.total + s.score);
          setNews((n) => ({ ...n, unlocks }));
          p = { ...p, total: p.total + s.score };
        }
        if (p === progressRef.current) return;
        progressRef.current = p;
        saveProgress(p);
        setProgress(p);
      }),
    [engine],
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(undefined), 2500);
    return () => clearTimeout(id);
  }, [toast]);

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
    <main className="flex h-dvh flex-col gap-3 p-3 sm:flex-row sm:justify-center">
      <aside className="hidden w-72 shrink-0 overflow-y-auto rounded-panel border border-line bg-surface p-5 shadow-elev-1 xl:block">
        <Leaderboard board={board} highlight={runDate} mode={settings.mode} day={day} />
      </aside>
      {/* Game + rail; the menu panel opens inside this box, right beside the rail. */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 sm:flex-initial sm:flex-row">
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-panel border border-line shadow-elev-1 sm:aspect-[3/4] sm:flex-initial">
        <Scene engine={engine} drive={snap.mode === "drive"} steer={settings.steer} night={night} quality={settings.quality} reduceMotion={settings.reduceMotion} car={car} paint={paint} weather={weather} />
        <EdgeFx speedMph={snap.speedMph} nitro={snap.nitro} still={settings.reduceMotion} />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-2">
          <Dashboard snap={snap} />
          {toast && (
            <div key={toast.id} role="status" className="self-center rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-stone-900 shadow-lg">
              ★ Achievement · {toast.text}
            </div>
          )}
        </div>
        <Popups engine={engine} />
        {snap.status === "ready" && <ReadyOverlay best={board.best.score} mode={settings.mode} pack={settings.pack} day={day} weather={weather} steer={settings.steer} />}
        <div className={`absolute inset-x-0 flex justify-center px-3 ${settings.touch ? "bottom-2" : "bottom-6"}`}>
          {snap.mode === "drive" ? (
            <DriveDock engine={engine} disabled={snap.status === "over" || menu} touch={settings.touch} />
          ) : (
            <TypingDock engine={engine} word={snap.word} nextWord={snap.nextWord} disabled={snap.status === "over" || menu} touch={settings.touch} steer={settings.steer} />
          )}
        </div>
        {snap.status === "over" && <GameOver snap={snap} board={board} runDate={runDate} day={day} news={news} onRestart={() => (engine.restart(), reroll())} />}
      </div>
      <Rail open={section} onOpen={setSection} night={night} onTheme={() => setNight((n) => !n)} />
      <Menu
        section={section}
        board={<Leaderboard board={board} highlight={runDate} mode={settings.mode} day={day} />}
        onClose={closeMenu}
        settings={settings}
        onSettings={setSettings}
        progress={progress}
        onEnd={snap.status === "running" ? () => (engine.send({ type: "end" }), closeMenu()) : undefined}
      />
      </div>
    </main>
  );
}

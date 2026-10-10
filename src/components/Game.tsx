"use client";

import { useEffect, useState } from "react";
import { attachAudio } from "@/game/audio";
import { GameEngine } from "@/game/engine";
import { snapshot } from "@/game/sim";
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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", night);
    try {
      localStorage.setItem(THEME_KEY, night ? "night" : "day");
    } catch {}
  }, [night]);

  useEffect(() => attachAudio(engine), [engine]);

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
    <main className="flex h-dvh justify-center">
      <div className="relative aspect-[9/16] h-full max-w-full">
        <Scene engine={engine} night={night} />
        <EdgeFx speedMph={snap.speedMph} nitro={snap.nitro} />
        <button
          className="absolute right-3 top-10 rounded-full bg-black/30 px-3 py-1 text-xs text-white backdrop-blur"
          onClick={() => setNight((n) => !n)}
          aria-pressed={night}
        >
          {night ? "☾ Night" : "☀ Day"}
        </button>
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-between px-4 font-mono text-sm text-white drop-shadow">
          <span>{Math.round(snap.speedMph)} mph</span>
          <span>{"♥".repeat(snap.lives)}</span>
          <span>{snap.score} pts ×{snap.multiplier.toFixed(1)}</span>
          <span>{Math.round(snap.wpm)} wpm</span>
        </div>
        <div className="absolute inset-x-0 bottom-6 flex justify-center px-3">
          <TypingDock engine={engine} word={snap.word} nextWord={snap.nextWord} disabled={snap.status === "over"} />
        </div>
        {snap.status === "ready" && (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-lg font-semibold text-white drop-shadow">Type the word to start</p>
        )}
        {snap.status === "over" && (
          <div className="absolute inset-0 grid place-items-center bg-black/40">
            <button className="rounded-full bg-white px-6 py-3 font-semibold text-black" onClick={() => engine.restart()}>
              Play again · {snap.score} pts
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

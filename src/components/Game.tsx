"use client";

import { useEffect, useState } from "react";
import { GameEngine } from "@/game/engine";
import { snapshot } from "@/game/sim";
import { Scene } from "./scene/Scene";
import { TypingDock } from "./TypingDock";

export function Game() {
  const [engine] = useState(() => new GameEngine());
  const [snap, setSnap] = useState(() => snapshot(engine.state));

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
        <Scene engine={engine} />
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

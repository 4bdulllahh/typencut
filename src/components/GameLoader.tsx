"use client";

import dynamic from "next/dynamic";

// WebGL, Web Audio and localStorage are browser-only: skip prerendering the game.
export const GameLoader = dynamic(() => import("./Game").then((m) => m.Game), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center text-sm opacity-60">Warming up the engine…</div>,
});

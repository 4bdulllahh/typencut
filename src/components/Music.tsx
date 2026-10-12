"use client";

import { useEffect, useRef, useState } from "react";
import type { GameEngine } from "@/game/engine";
import { DNB_TRACKS, createDnb } from "@/game/music";
import type { Settings } from "@/game/settings";

const ICON = {
  prev: "M19 20 9 12l10-8v16zM5 19V5",
  next: "M5 4l10 8-10 8V4zM19 5v14",
  play: "M6 3l14 9-14 9V3z",
  pause: "M6 4h4v16H6zM14 4h4v16h-4z",
};
const Btn = ({ label, icon, onClick }: { label: string; icon: keyof typeof ICON; onClick: () => void }) => (
  <button
    onClick={onClick}
    onMouseDown={(e) => e.preventDefault()} // keep the typing box focused
    aria-label={label}
    className="grid size-9 shrink-0 place-items-center rounded-full text-fg-subtle hover:bg-surface-muted hover:text-fg"
  >
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" className="size-4" aria-hidden>
      <path d={ICON[icon]} />
    </svg>
  </button>
);

const wrap = (i: number) => ((i % DNB_TRACKS.length) + DNB_TRACKS.length) % DNB_TRACKS.length;

/**
 * The soundtrack (drum & bass made in code, music.ts) and its now-playing pill (under the leaderboard island, right of
 * the road; below it on phones). Music starts with the first run unless the player paused it; the track is a setting,
 * so Settings and the pill's previous / next pick from the same list. Volume and Mute only ever change the level.
 */
export function Music({ engine, settings, onTrack }: { engine: GameEngine; settings: Settings; onTrack: (i: number) => void }) {
  const index = wrap(settings.track);
  const [playing, setPlaying] = useState(false);
  const want = useRef(true); // the player's own choice: pausing in the pill keeps music off until they press play
  const dnb = useRef<ReturnType<typeof createDnb>>(null);
  const level = settings.muted ? 0 : settings.volume * settings.mix.music;
  const on = settings.music !== "off";

  const start = (i: number) => {
    dnb.current ??= createDnb();
    dnb.current.setVolume(level);
    dnb.current.play(i);
    setPlaying(true);
  };
  const stop = () => {
    dnb.current?.pause();
    setPlaying(false);
  };

  // Start with the first run (a keystroke, so the browser allows sound), if the player hasn't paused it.
  const first = useRef<() => void>(null);
  first.current = () => want.current && on && !playing && start(index);
  useEffect(() => engine.on((e) => e.type === "start" && first.current?.()), [engine]);
  // A new track (picked in Settings, or previous / next) plays straight away unless the player paused.
  const shown = useRef(index);
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    if (want.current && on) start(index);
  }, [index]);
  useEffect(() => dnb.current?.setVolume(level), [level]);
  useEffect(() => {
    if (!on) stop();
  }, [on]);
  useEffect(() => () => dnb.current?.dispose(), []);

  if (!on) return null;
  const toggle = () => {
    want.current = !playing;
    if (playing) stop();
    else start(index);
  };
  const skip = (d: number) => ((want.current = true), onTrack(wrap(index + d)));
  const track = DNB_TRACKS[index];
  return (
    <div className="relative flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface py-1 pl-4 pr-1 shadow-elev-1 sm:w-72">
      <span className="relative min-w-0 flex-1 leading-tight" aria-live="polite">
        <span className="block truncate text-[0.625rem] font-semibold uppercase tracking-widest text-fg-subtle">
          {playing ? "Now playing" : "Paused"} · {index + 1}/{DNB_TRACKS.length}
        </span>
        <span className="block truncate text-sm font-semibold" title={`${track.name} · ${track.bpm} BPM`}>
          {track.name} <span className="font-normal text-fg-subtle">· {track.bpm} BPM</span>
        </span>
      </span>
      <Btn label="Previous track" icon="prev" onClick={() => skip(-1)} />
      <Btn label={playing ? "Pause music" : "Play music"} icon={playing ? "pause" : "play"} onClick={toggle} />
      <Btn label="Next track" icon="next" onClick={() => skip(1)} />
    </div>
  );
}

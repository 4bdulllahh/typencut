"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEngine } from "@/game/engine";
import { DNB_TRACKS, createDnb } from "@/game/music";
import { PLAYLIST, PLAYLIST_ID } from "@/game/playlist";
import type { Settings } from "@/game/settings";

/** The bits of Spotify's Embed iFrame API we use (https://developer.spotify.com/documentation/embeds). */
interface EmbedController {
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
  resume(): void;
  addListener(event: "playback_update", fn: (e: { data: { isPaused: boolean; position: number; duration: number } }) => void): void;
}
interface IFrameAPI {
  createController(el: HTMLElement, opts: { uri: string; width: string | number; height: number }, cb: (c: EmbedController) => void): void;
}
declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
  }
}

let spotifyApi: Promise<IFrameAPI> | null = null;
/** Loads Spotify's embed script once, on first use. */
const loadSpotify = () =>
  (spotifyApi ??= new Promise<IFrameAPI>((resolve) => {
    window.onSpotifyIframeApiReady = resolve;
    const s = document.createElement("script");
    s.src = "https://open.spotify.com/embed/iframe-api/v1";
    s.async = true;
    document.body.appendChild(s);
  }));

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

/**
 * The soundtrack and its now-playing pill (under the leaderboard island, right of the road; below it on phones). Spotify plays the owner's playlist
 * through Spotify's own embedded player, hidden behind the pill: full songs for listeners logged in to Spotify in this
 * browser, 30 s previews otherwise, at the device's volume (Spotify gives sites no volume control, so the Music slider
 * only sets the generated track; Mute or a slider at 0 pauses Spotify). Music starts with the first run.
 */
export function Music({ engine, settings }: { engine: GameEngine; settings: Settings }) {
  const source = settings.music;
  const list = source === "spotify" ? PLAYLIST.map((t) => ({ title: t.title, artist: t.artist })) : DNB_TRACKS.map((t) => ({ title: t.name, artist: "Typencut" }));
  const [index, setIndex] = useState(() => Math.floor(Math.random() * PLAYLIST.length));
  const [playing, setPlaying] = useState(false);
  const want = useRef(true); // the player's own choice: pausing in the pill keeps music off until they press play
  const silent = settings.muted || settings.mix.music === 0;
  const box = useRef<HTMLDivElement>(null);
  const spotify = useRef<EmbedController>(null);
  const dnb = useRef<ReturnType<typeof createDnb>>(null);
  const ended = useRef(""); // the Spotify track we already moved on from
  const now = useRef(""); // the Spotify track loaded now
  const track = list[((index % list.length) + list.length) % list.length];

  const start = useCallback(
    async (i: number) => {
      if (source === "dnb") {
        dnb.current ??= createDnb();
        dnb.current.setVolume(settings.volume * settings.mix.music);
        dnb.current.play(i);
        setPlaying(true);
      } else if (source === "spotify" && box.current) {
        const uri = PLAYLIST[((i % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length].uri;
        now.current = uri;
        if (!spotify.current) {
          const api = await loadSpotify();
          const el = document.createElement("div");
          box.current.replaceChildren(el);
          spotify.current = await new Promise<EmbedController>((resolve) => api.createController(el, { uri, width: "100%", height: 80 }, resolve));
          spotify.current.addListener("playback_update", ({ data }) => {
            setPlaying(!data.isPaused);
            // Spotify stops at the end of a track (or a 30 s preview): move on to the next one.
            if (data.duration > 0 && data.position >= data.duration - 500 && ended.current !== now.current) {
              ended.current = now.current;
              setIndex((n) => n + 1);
            }
          });
        } else {
          ended.current = "";
          spotify.current.loadUri(uri);
        }
        spotify.current.play();
      }
    },
    [source, settings.volume, settings.mix.music],
  );

  const stop = useCallback(() => {
    dnb.current?.pause();
    spotify.current?.pause();
    setPlaying(false);
  }, []);

  // Start with the first run (a keystroke, so the browser allows sound), if the player hasn't paused it.
  useEffect(() => engine.on((e) => e.type === "start" && want.current && !silent && source !== "off" && !playing && void start(index)), [engine, start, index, playing, silent, source]);
  // A new track (next, previous, or the last one ended) plays straight away if music is on.
  const shown = useRef(index);
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    if (want.current && !silent) void start(index);
  }, [index, start, silent]);
  // Switching source stops the old one; the new one waits for play or the next run.
  useEffect(() => stop, [source, stop]);
  useEffect(() => {
    dnb.current?.setVolume(settings.volume * settings.mix.music);
    if (silent) stop();
  }, [settings.volume, settings.mix.music, silent, stop]);
  useEffect(() => () => dnb.current?.dispose(), []);

  if (source === "off") return null;
  const toggle = () => {
    want.current = !playing;
    if (playing) stop();
    else void start(index);
  };
  return (
    <div className="relative flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface py-1 pl-4 pr-1 shadow-elev-1 sm:w-72">
      {/* Spotify's player lives here, invisible: the pill is its remote. */}
      <div ref={box} aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-20 w-72 overflow-hidden opacity-0" />
      <span className="relative min-w-0 flex-1 leading-tight" aria-live="polite">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
          {playing ? "Now playing" : "Paused"} ·{" "}
          {source === "spotify" ? (
            <a href={`https://open.spotify.com/playlist/${PLAYLIST_ID}`} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Spotify</a>
          ) : (
            "in-game"
          )}
        </span>
        <span className="block truncate text-sm font-semibold" title={`${track.title} · ${track.artist}`}>
          {track.title} <span className="font-normal text-fg-subtle">· {track.artist}</span>
        </span>
      </span>
      <Btn label="Previous track" icon="prev" onClick={() => ((want.current = true), setIndex((n) => n - 1))} />
      <Btn label={playing ? "Pause music" : "Play music"} icon={playing ? "pause" : "play"} onClick={toggle} />
      <Btn label="Next track" icon="next" onClick={() => ((want.current = true), setIndex((n) => n + 1))} />
    </div>
  );
}

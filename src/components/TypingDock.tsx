"use client";

import { useEffect, useRef, useState } from "react";
import type { GameEngine } from "@/game/engine";
import type { Dir } from "@/game/types";
import { DOUBLE_TAP_MS, DRIVE_KEYS, isPrefix, keyLabel, matchWord, steerDir, type SteerKeys } from "@/game/input";

/**
 * The only place keystrokes become game commands. Reads the target word from
 * `engine.state` at key time (not from a HUD snapshot) so fast typists never race a stale word.
 */
export function TypingDock({ engine, word, nextWord, disabled, touch, steer }: {
  engine: GameEngine;
  word: string;
  nextWord: string;
  disabled: boolean;
  touch: boolean;
  steer: SteerKeys;
}) {
  const [typed, setTyped] = useState("");
  const [shake, setShake] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const lastEnter = useRef(0);

  useEffect(() => {
    if (!disabled) input.current?.focus();
  }, [disabled]);

  /** The lane-switch keys (`,`/`.` unless rebound) submit and steer; Enter submits straight ahead (dir 0) for a small boost. */
  const submit = (dir: Dir | 0) => {
    const res = matchWord(typed, engine.state.word);
    engine.send({ type: "key", correct: res !== null });
    if (res) engine.send({ type: "word", dir, nitro: res.nitro });
    else {
      engine.send({ type: "miss" });
      setShake(true);
      setTimeout(() => setShake(false), 360);
    }
    setTyped("");
  };

  /** Enter (or the middle button): submit straight ahead, or on an empty box count toward a double-tap brake. */
  const enter = (time: number) => {
    if (typed) return submit(0);
    if (time - lastEnter.current < DOUBLE_TAP_MS) {
      engine.send({ type: "brake" });
      lastEnter.current = 0;
    } else lastEnter.current = time;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const dir = steerDir(e.code, e.key, steer);
    if (dir) {
      e.preventDefault();
      submit(dir);
    } else if (e.key === "Enter") {
      e.preventDefault();
      enter(e.timeStamp);
    } else if (e.key === " ") e.preventDefault();
  };

  // Acting on press and cancelling the default keeps focus (and a phone's keyboard) on the input.
  const pad = (label: string, text: string, act: (time: number) => void) => <Pad label={label} text={text} act={act} disabled={disabled} />;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^A-Za-z]/g, "");
    if (value.length > typed.length) engine.send({ type: "key", correct: isPrefix(value, engine.state.word) });
    setTyped(value);
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      {touch && (
        <div className="flex gap-2">
          {pad("Steer left", "‹", () => submit(-1))}
          {pad("Straight with a boost, or tap twice on an empty box to brake", "↑", enter)}
          {pad("Steer right", "›", () => submit(1))}
        </div>
      )}
      <div
        className={`relative flex items-center gap-3 rounded-full bg-white/85 px-5 py-3 shadow-xl ring-1 ring-black/5 backdrop-blur dark:bg-slate-900/80 dark:ring-white/10 ${shake ? "shake" : ""}`}
        onClick={() => input.current?.focus()}
      >
        <kbd className="rounded-md bg-black/5 px-2 py-1 text-xs font-semibold dark:bg-white/10">‹ {keyLabel(steer.left.key)}</kbd>
        <div className="min-w-32 text-center text-2xl font-semibold tracking-wide" aria-hidden>
          {[...word].map((c, i) => {
            const t = typed[i];
            const color = t === undefined ? "opacity-40" : t.toLowerCase() === c.toLowerCase() ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600";
            return (
              <span key={i} className={color}>
                {t ?? c}
              </span>
            );
          })}
          {typed.length > word.length && <span className="text-rose-600">{typed.slice(word.length)}</span>}
        </div>
        <kbd className="rounded-md bg-black/5 px-2 py-1 text-xs font-semibold dark:bg-white/10">{keyLabel(steer.right.key)} ›</kbd>
        <span className="text-sm font-semibold opacity-35">{nextWord}</span>
        <input
          ref={input}
          value={typed}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onBlur={() => !disabled && setTimeout(() => input.current?.focus(), 0)}
          disabled={disabled}
          aria-label={`Type “${word}”, then ${keyLabel(steer.left.key)} to steer left or ${keyLabel(steer.right.key)} to steer right. Enter to go straight with a small boost. All caps for nitro, Enter twice on an empty box to brake.`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="absolute inset-0 cursor-default rounded-full opacity-0"
        />
      </div>
    </div>
  );
}

// Acting on press and cancelling the default keeps focus (and a phone's keyboard) where it is.
function Pad({ label, text, act, disabled }: { label: string; text: string; act: (time: number) => void; disabled: boolean }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        act(e.timeStamp);
      }}
      onMouseDown={(e) => e.preventDefault()}
      className="h-10 min-w-16 touch-manipulation select-none rounded-2xl bg-white/85 px-4 text-lg font-bold shadow-lg ring-1 ring-black/5 backdrop-blur active:scale-95 dark:bg-slate-900/80 dark:ring-white/10"
    >
      {text}
    </button>
  );
}

/**
 * Drive mode: no words. WASD or the arrows, read from the whole window. W/↑ = a short boost (held = kept topped up),
 * a second tap within DOUBLE_TAP_MS = nitro, S/↓ = brake.
 */
export function DriveDock({ engine, disabled, touch }: { engine: GameEngine; disabled: boolean; touch: boolean }) {
  const lastUp = useRef(0);
  const up = (time: number, repeat = false) => {
    const nitro = !repeat && time - lastUp.current < DOUBLE_TAP_MS;
    if (!repeat) lastUp.current = nitro ? 0 : time;
    engine.send({ type: "drive", dir: 0, nitro });
  };
  const act = { left: () => engine.send({ type: "drive", dir: -1, nitro: false }), right: () => engine.send({ type: "drive", dir: 1, nitro: false }), down: () => engine.send({ type: "brake" }) };

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const k = DRIVE_KEYS[e.code];
      if (!k || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest?.("input, textarea, select")) return;
      e.preventDefault();
      if (k === "up") up(e.timeStamp, e.repeat);
      else if (!e.repeat || k === "down") act[k]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex flex-col items-center gap-1.5">
      {touch && (
        <div className="flex gap-2">
          <Pad label="Steer left" text="‹" act={act.left} disabled={disabled} />
          <Pad label="Speed up, or tap twice for nitro" text="↑" act={(t) => up(t)} disabled={disabled} />
          <Pad label="Brake" text="↓" act={act.down} disabled={disabled} />
          <Pad label="Steer right" text="›" act={act.right} disabled={disabled} />
        </div>
      )}
      <div className="flex items-center gap-2 rounded-full bg-white/85 px-4 py-2.5 text-xs font-semibold shadow-xl ring-1 ring-black/5 backdrop-blur dark:bg-slate-900/80 dark:ring-white/10 [&_kbd]:rounded-md [&_kbd]:bg-black/5 [&_kbd]:px-1.5 [&_kbd]:py-0.5 dark:[&_kbd]:bg-white/10">
        <span><kbd>A</kbd> <kbd>D</kbd> lanes</span>
        <span className="opacity-30">·</span>
        <span><kbd>W</kbd> boost · <kbd>W</kbd><kbd>W</kbd> nitro</span>
        <span className="opacity-30">·</span>
        <span><kbd>S</kbd> brake</span>
      </div>
    </div>
  );
}

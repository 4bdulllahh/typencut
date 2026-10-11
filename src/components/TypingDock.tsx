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

// Acting on press and cancelling the default keeps focus (and a phone's keyboard) where it is. `release` makes it a held pedal.
function Pad({ label, text, act, release, disabled }: { label: string; text: string; act: (time: number) => void; release?: () => void; disabled: boolean }) {
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
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onMouseDown={(e) => e.preventDefault()}
      className="h-10 min-w-16 touch-manipulation select-none rounded-2xl bg-white/85 px-4 text-lg font-bold shadow-lg ring-1 ring-black/5 backdrop-blur active:scale-95 dark:bg-slate-900/80 dark:ring-white/10"
    >
      {text}
    </button>
  );
}

/**
 * Driving controls, read from the whole window: W/↑ and S/↓ are pedals (held), A/D or ←/→ change lanes, and a second
 * W/↑ press within DOUBLE_TAP_MS fires nitro. Pedals let go when the dock is disabled (menu, pause) or the window blurs.
 */
export function DriveDock({ engine, disabled, touch }: { engine: GameEngine; disabled: boolean; touch: boolean }) {
  const lastUp = useRef(0);
  const held = useRef(new Map<string, "up" | "down">()); // what holds each pedal down, so W and ↑ together release cleanly
  const press = (id: string, k: "up" | "down", time: number) => {
    held.current.set(id, k);
    if (k === "down") return engine.send({ type: "pedal", brake: true });
    const nitro = time - lastUp.current < DOUBLE_TAP_MS;
    lastUp.current = nitro ? 0 : time;
    engine.send({ type: "pedal", throttle: true });
    if (nitro) engine.send({ type: "drive", dir: 0, nitro: true });
  };
  const release = (id: string) => {
    const k = held.current.get(id);
    held.current.delete(id);
    if (k && ![...held.current.values()].includes(k)) engine.send({ type: "pedal", ...(k === "up" ? { throttle: false } : { brake: false }) });
  };
  const steer = (dir: -1 | 1) => engine.send({ type: "drive", dir, nitro: false });

  useEffect(() => {
    if (disabled) return;
    const releaseAll = () => {
      held.current.clear();
      engine.send({ type: "pedal", throttle: false, brake: false });
    };
    const onDown = (e: KeyboardEvent) => {
      const k = DRIVE_KEYS[e.code];
      if (!k || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest?.("input, textarea, select")) return;
      e.preventDefault();
      if (e.repeat) return;
      if (k === "left" || k === "right") steer(k === "left" ? -1 : 1);
      else press(e.code, k, e.timeStamp);
    };
    const onUp = (e: KeyboardEvent) => release(e.code);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [engine, disabled]); // the helpers only touch refs and the engine

  return (
    <div className="flex flex-col items-center gap-1.5">
      {touch && (
        <div className="flex gap-2">
          <Pad label="Steer left" text="‹" act={() => steer(-1)} disabled={disabled} />
          <Pad label="Accelerate (hold), or tap twice for nitro" text="↑" act={(t) => press("pad", "up", t)} release={() => release("pad")} disabled={disabled} />
          <Pad label="Brake (hold)" text="↓" act={(t) => press("pad-down", "down", t)} release={() => release("pad-down")} disabled={disabled} />
          <Pad label="Steer right" text="›" act={() => steer(1)} disabled={disabled} />
        </div>
      )}
      <div className="flex items-center gap-2 rounded-full bg-white/85 px-4 py-2.5 text-xs font-semibold shadow-xl ring-1 ring-black/5 backdrop-blur dark:bg-slate-900/80 dark:ring-white/10">
        <span>hold <kbd>W</kbd> gas · <kbd>W</kbd><kbd>W</kbd> nitro</span>
        <span className="opacity-30">·</span>
        <span><kbd>A</kbd> <kbd>D</kbd> lanes</span>
        <span className="opacity-30">·</span>
        <span>hold <kbd>S</kbd> brake</span>
      </div>
    </div>
  );
}

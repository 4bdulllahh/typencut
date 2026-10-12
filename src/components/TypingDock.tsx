"use client";

import { useEffect, useRef, useState } from "react";
import type { GameEngine } from "@/game/engine";
import type { Dir } from "@/game/types";
import { DRIVING } from "@/game/config";
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
 * Driving controls, read from the whole window: W/↑ and S/↓ are pedals (held), A/D or ←/→ change lanes (held: one more
 * lane every DRIVING.repeat s), and a second W/↑ press within DOUBLE_TAP_MS fires nitro. Pedals let go when the dock is disabled (menu, pause) or the window blurs.
 * On touch screens the road itself takes swipes instead of buttons (see the swipe effect below).
 */
export function DriveDock({ engine, disabled, touch, area }: { engine: GameEngine; disabled: boolean; touch: boolean; area: React.RefObject<HTMLElement | null> }) {
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
  const steering = useRef(new Map<string, number>()); // held steering key or pad → its repeat timer
  const steerDown = (id: string, dir: -1 | 1) => {
    if (steering.current.has(id)) return;
    steer(dir);
    steering.current.set(id, window.setInterval(() => steer(dir), DRIVING.repeat * 1000));
  };
  const steerUp = (id: string) => {
    clearInterval(steering.current.get(id));
    steering.current.delete(id);
  };

  useEffect(() => {
    if (disabled) return;
    const releaseAll = () => {
      held.current.clear();
      for (const id of [...steering.current.keys()]) steerUp(id);
      engine.send({ type: "pedal", throttle: false, brake: false });
    };
    const onDown = (e: KeyboardEvent) => {
      const k = DRIVE_KEYS[e.code];
      if (!k || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest?.("input, textarea, select")) return;
      e.preventDefault();
      if (e.repeat) return;
      if (k === "left" || k === "right") steerDown(e.code, k === "left" ? -1 : 1);
      else press(e.code, k, e.timeStamp);
    };
    const onUp = (e: KeyboardEvent) => (release(e.code), steerUp(e.code));
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

  // Swipes on the road (phones and tablets): left/right change lanes (keep the finger down to keep going), up holds the
  // throttle on until a swipe down, down brakes until the finger lifts, and a double tap fires nitro.
  useEffect(() => {
    const el = area.current;
    if (disabled || !touch || !el) return;
    const SWIPE = 28; // px of travel before a touch counts as a swipe
    let start: { x: number; y: number; t: number; id: number } | null = null;
    let swiped = false;
    let lastTap = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || start || (e.target as HTMLElement).closest("button, a, input")) return;
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
      swiped = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id || swiped) return;
      const [dx, dy] = [e.clientX - start.x, e.clientY - start.y];
      if (Math.hypot(dx, dy) < SWIPE) return;
      swiped = true;
      if (Math.abs(dx) > Math.abs(dy)) steerDown("swipe", dx < 0 ? -1 : 1);
      else if (dy < 0) press("swipe-up", "up", e.timeStamp);
      else {
        release("swipe-up");
        press("swipe-down", "down", e.timeStamp);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      if (!swiped && e.timeStamp - start.t < 300) {
        const nitro = e.timeStamp - lastTap < DOUBLE_TAP_MS;
        lastTap = nitro ? 0 : e.timeStamp;
        if (nitro) engine.send({ type: "drive", dir: 0, nitro: true });
      }
      steerUp("swipe");
      release("swipe-down");
      start = null;
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      steerUp("swipe");
    };
  }, [engine, disabled, touch, area]); // the helpers only touch refs and the engine

  if (touch)
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-2 rounded-full bg-white/85 px-4 py-2 text-xs font-semibold shadow-xl ring-1 ring-black/5 backdrop-blur dark:bg-slate-900/80 dark:ring-white/10">
        <span>swipe ← → lanes</span>
        <span className="opacity-30">·</span>
        <span>↑ gas</span>
        <span className="opacity-30">·</span>
        <span>↓ brake</span>
        <span className="opacity-30">·</span>
        <span>double tap nitro</span>
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-1.5">
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

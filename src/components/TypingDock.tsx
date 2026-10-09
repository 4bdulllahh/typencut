"use client";

import { useEffect, useRef, useState } from "react";
import type { GameEngine } from "@/game/engine";
import { DOUBLE_TAP_MS, STEER_KEYS, isPrefix, matchWord } from "@/game/input";

/**
 * The only place keystrokes become game commands. Reads the target word from
 * `engine.state` at key time (not from a HUD snapshot) so fast typists never race a stale word.
 */
export function TypingDock({ engine, word, nextWord, disabled }: { engine: GameEngine; word: string; nextWord: string; disabled: boolean }) {
  const [typed, setTyped] = useState("");
  const [shake, setShake] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const lastEnter = useRef(0);

  useEffect(() => {
    if (!disabled) input.current?.focus();
  }, [disabled]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const dir = STEER_KEYS[e.key];
    if (dir) {
      e.preventDefault();
      const res = matchWord(typed, engine.state.word);
      engine.send({ type: "key", correct: res !== null });
      if (res) engine.send({ type: "word", dir, nitro: res.nitro, chars: typed.length + 1 });
      else {
        engine.send({ type: "miss" });
        setShake(true);
        setTimeout(() => setShake(false), 360);
      }
      setTyped("");
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (typed) return;
      if (e.timeStamp - lastEnter.current < DOUBLE_TAP_MS) {
        engine.send({ type: "brake" });
        lastEnter.current = 0;
      } else lastEnter.current = e.timeStamp;
    } else if (e.key === " ") e.preventDefault();
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^A-Za-z]/g, "");
    if (value.length > typed.length) engine.send({ type: "key", correct: isPrefix(value, engine.state.word) });
    setTyped(value);
  };

  return (
    <div
      className={`relative flex items-center gap-3 rounded-full bg-white/85 px-5 py-3 shadow-xl ring-1 ring-black/5 backdrop-blur dark:bg-slate-900/80 dark:ring-white/10 ${shake ? "shake" : ""}`}
      onClick={() => input.current?.focus()}
    >
      <kbd className="rounded-md bg-black/5 px-2 py-1 font-mono text-xs dark:bg-white/10">‹ ,</kbd>
      <div className="min-w-32 text-center font-mono text-2xl tracking-wide" aria-hidden>
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
      <kbd className="rounded-md bg-black/5 px-2 py-1 font-mono text-xs dark:bg-white/10">. ›</kbd>
      <span className="font-mono text-sm opacity-35">{nextWord}</span>
      <input
        ref={input}
        value={typed}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={() => !disabled && setTimeout(() => input.current?.focus(), 0)}
        disabled={disabled}
        aria-label={`Type “${word}”, then comma to steer left or period to steer right. All caps for nitro, Enter twice to brake.`}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="absolute inset-0 cursor-default rounded-full opacity-0"
      />
    </div>
  );
}

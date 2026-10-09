import { applyCommand, createState, step } from "./sim.ts";
import type { Command, GameEvent, GameState } from "./types.ts";

type Listener = (e: GameEvent) => void;

/**
 * Owns the state and the fixed loop. Input calls `send()`; renderers read `state`;
 * audio/HUD/FX listen with `on()`. A network layer can sit on the same two seams.
 */
export class GameEngine {
  state: GameState = createState();
  private listeners = new Set<Listener>();
  private raf = 0;
  private last = 0;

  /** Applied immediately so the next keystroke is checked against the new word. */
  send(cmd: Command) {
    this.emit(applyCommand(this.state, cmd));
  }

  on(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  restart(seed?: number) {
    this.state = createState(seed);
    this.emit([{ type: "restart" }]);
  }

  tick(dt: number) {
    this.emit(step(this.state, Math.min(dt, 0.05)));
  }

  start() {
    this.stop();
    const loop = (t: number) => {
      this.tick(this.last ? (t - this.last) / 1000 : 0);
      this.last = t;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.last = 0;
  }

  private emit(events: GameEvent[]) {
    for (const e of events) for (const fn of this.listeners) fn(e);
  }
}

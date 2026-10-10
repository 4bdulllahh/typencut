import type { GameEngine } from "./engine.ts";
import type { GameEvent } from "./types.ts";

/** Synthesised sound effects driven by engine events. Browser only; returns a detach function. */
export function attachAudio(engine: GameEngine) {
  let ctx: AudioContext | null = null;
  let out: GainNode;
  let noise: AudioBuffer;

  // Created on the first event, which is a keystroke, so the browser allows it.
  const init = () => {
    if (!ctx) {
      ctx = new AudioContext();
      out = ctx.createGain();
      out.gain.value = 0.5;
      out.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };

  const envelope = (c: AudioContext, peak: number, attack: number, decay: number) => {
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out);
    return g;
  };

  /** Filtered noise; the filter frequency glides from f0 to f1. */
  const hiss = (type: BiquadFilterType, f0: number, f1: number, q: number, peak: number, attack: number, decay: number) => {
    const c = init();
    const src = c.createBufferSource();
    src.buffer = noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(f1, c.currentTime + attack + decay);
    src.connect(f).connect(envelope(c, peak, attack, decay));
    src.start(c.currentTime, Math.random() * 0.5);
    src.stop(c.currentTime + attack + decay + 0.05);
  };

  const tone = (type: OscillatorType, f0: number, f1: number, peak: number, attack: number, decay: number, lowpass = 20000) => {
    const c = init();
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(f1, c.currentTime + attack + decay);
    const f = c.createBiquadFilter();
    f.frequency.value = lowpass;
    o.connect(f).connect(envelope(c, peak, attack, decay));
    o.start();
    o.stop(c.currentTime + attack + decay + 0.05);
  };

  const play = (e: GameEvent) => {
    switch (e.type) {
      case "key": {
        // Soft linear switch: a muted "thock" plus a short top click; wrong keys sound duller.
        const v = 0.9 + Math.random() * 0.2;
        tone("sine", 210 * v, 120, 0.22, 0.002, 0.04);
        hiss("bandpass", (e.correct ? 2600 : 1300) * v, 1500, 2, e.correct ? 0.18 : 0.12, 0.002, 0.03);
        break;
      }
      case "nitro":
        hiss("bandpass", 3200, 500, 1.4, 0.45, 0.01, 0.5); // turbo blow-off
        hiss("lowpass", 500, 120, 0.7, 0.7, 0.02, 0.35); // flame whoomp
        break;
      case "laneChange":
        hiss("bandpass", 2300, 1700, 9, 0.35, 0.02, 0.3);
        break;
      case "brake":
        hiss("bandpass", 2100, 1500, 8, 0.4, 0.03, 0.7);
        break;
      case "overtake":
        if (e.grade === "standard") break;
        // A passed driver leans on the horn, dropping in pitch as you pull away.
        tone("square", 392, 370, 0.07, 0.01, 0.4, 1800);
        tone("square", 494, 466, 0.07, 0.01, 0.4, 1800);
        break;
      case "collision":
        tone("sine", 95, 32, 0.9, 0.005, 0.45);
        hiss("lowpass", 900, 150, 0.8, 0.8, 0.005, 0.3);
        break;
    }
  };

  const off = engine.on(play);
  return () => {
    off();
    void ctx?.close();
  };
}

import { MPH } from "./config.ts";
import type { GameEngine } from "./engine.ts";
import type { Settings } from "./settings.ts";
import type { GameEvent } from "./types.ts";

/** Upshift points (mph) of a simulated 7-speed gearbox; cruising sits mid-band, nitro climbs a gear or two. */
const GEARS = [0, 40, 62, 85, 108, 132, 158, 200];

/** Gear (1–7) and revs (0.35 → 1 across each gear) for a speed, so the engine note climbs and drops on upshifts. */
export function revs(mph: number) {
  let g = 0;
  while (g < GEARS.length - 2 && mph >= GEARS[g + 1]) g++;
  const frac = Math.min(1, Math.max(0, (mph - GEARS[g]) / (GEARS[g + 1] - GEARS[g])));
  return { gear: g + 1, rpm: 0.35 + 0.65 * frac };
}

type AudioSettings = Pick<Settings, "volume" | "muted" | "engine"> & { rain?: boolean };

/**
 * Synthesised sound driven by engine events, plus a continuous engine note that follows the player's speed.
 * Browser only. `set` applies volume/mute/engine settings, `pause` silences the engine while the menu is open.
 */
export function attachAudio(engine: GameEngine, initial: AudioSettings) {
  let ctx: AudioContext | null = null;
  let out: GainNode;
  let noise: AudioBuffer;
  let settings = initial;
  let paused = false;
  let motor: { saw: OscillatorNode; sub: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  let rain: GainNode | null = null;
  const level = () => (settings.muted ? 0 : settings.volume * 0.62);

  // Created on the first event, which is a keystroke, so the browser allows it.
  const init = () => {
    if (!ctx) {
      ctx = new AudioContext();
      out = ctx.createGain();
      out.gain.value = level();
      out.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // Engine: a sawtooth plus a square an octave down, through a resonant low-pass that opens with the revs.
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(out);
      const filter = ctx.createBiquadFilter();
      filter.Q.value = 3;
      filter.connect(gain);
      const saw = ctx.createOscillator();
      saw.type = "sawtooth";
      const sub = ctx.createOscillator();
      sub.type = "square";
      saw.connect(filter);
      sub.connect(filter);
      saw.start();
      sub.start();
      motor = { saw, sub, filter, gain };
      // Rain: looped noise, band-limited to a soft hiss, faded in while it rains.
      rain = ctx.createGain();
      rain.gain.value = 0;
      rain.connect(out);
      const patter = ctx.createBufferSource();
      patter.buffer = noise;
      patter.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 1800;
      band.Q.value = 0.5;
      patter.connect(band).connect(rain);
      patter.start();
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
      case "boost":
        hiss("bandpass", 700, 2200, 1.2, 0.22, 0.04, 0.3); // short rising whoosh
        break;
      case "draftReady":
        tone("triangle", 660, 990, 0.12, 0.01, 0.12); // rising chirp: the slipstream nitro is armed
        break;
      case "speedTrap":
        hiss("highpass", 4000, 6000, 0.7, 0.35, 0.001, 0.05); // shutter click
        tone("sine", 1320, 1320, 0.12, 0.005, 0.25);
        tone("sine", 1760, 1760, 0.08, 0.005, 0.35);
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

  // 20 Hz is plenty: every change glides with setTargetAtTime, which also makes upshifts drop smoothly.
  const drive = setInterval(() => {
    if (!ctx || !motor) return;
    const { status, player: p } = engine.state;
    const { rpm } = revs(p.speed / MPH);
    const nitro = p.nitroT > 0;
    const on = settings.engine && !paused && status === "running";
    const t = ctx.currentTime;
    motor.saw.frequency.setTargetAtTime(70 + 230 * rpm, t, 0.05);
    motor.sub.frequency.setTargetAtTime((70 + 230 * rpm) / 2, t, 0.05);
    motor.filter.frequency.setTargetAtTime(500 + 2200 * rpm + (nitro ? 1600 : 0), t, 0.08);
    motor.gain.gain.setTargetAtTime(on ? (nitro ? 0.15 : 0.08) * (0.6 + 0.4 * rpm) : 0, t, 0.08);
    rain?.gain.setTargetAtTime(settings.rain && !paused ? 0.07 : 0, t, 0.5);
  }, 50);

  const off = engine.on(play);
  return {
    set(next: AudioSettings) {
      settings = next;
      if (ctx) out.gain.setTargetAtTime(level(), ctx.currentTime, 0.03);
    },
    pause(p: boolean) {
      paused = p;
    },
    detach() {
      off();
      clearInterval(drive);
      void ctx?.close();
    },
  };
}

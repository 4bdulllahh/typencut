/**
 * The generated soundtrack: drum & bass synthesised live (two-step breaks, a sub bass line, a soft pad, sometimes a
 * plucked lead), one 4-bar loop per track. Browser only, with its own AudioContext so it can run with or without the game's sound effects.
 */

/** Steps are 16ths in a bar of 16. `prog` moves the root per bar; `minor` marks each bar's chord quality. */
export interface DnbTrack {
  name: string;
  bpm: number;
  root: number; // MIDI note of the bass root
  prog: number[];
  minor: boolean[];
  kick: number[];
  snare: number[];
  ghost: number[]; // quiet snare hits
  bass: [step: number, len: number, octave: number][];
  reese: boolean; // detuned, filtered saws under the sub
  lead?: [step: number, semis: number][]; // a plucked melody over the bar's root, two octaves up
}

export const DNB_TRACKS: DnbTrack[] = [
  { name: "Night Shift", bpm: 174, root: 41, prog: [0, -4, 3, -2], minor: [true, false, false, false], kick: [0, 10], snare: [4, 12], ghost: [7, 15], bass: [[0, 6, 0], [10, 4, 0], [14, 2, 1]], reese: false },
  { name: "Overpass", bpm: 172, root: 38, prog: [0, 0, -2, -4], minor: [true, true, false, false], kick: [0, 6, 10], snare: [4, 12], ghost: [9], bass: [[0, 4, 0], [6, 2, 0], [10, 6, 0]], reese: true },
  { name: "Slipstream", bpm: 176, root: 43, prog: [0, 5, 3, -2], minor: [true, true, false, false], kick: [0, 10, 11], snare: [4, 12], ghost: [2, 7, 14], bass: [[0, 3, 0], [3, 3, 1], [10, 4, 0]], reese: false },
  { name: "Redline", bpm: 174, root: 36, prog: [0, -4, -2, -5], minor: [true, false, false, false], kick: [0, 3, 10], snare: [4, 12], ghost: [6, 15], bass: [[0, 2, 0], [3, 5, 0], [10, 2, 0], [12, 4, 1]], reese: true },
  { name: "Apex", bpm: 174, root: 40, prog: [0, 3, 5, 3], minor: [true, false, true, false], kick: [0, 10], snare: [4, 12], ghost: [7, 14], bass: [[0, 8, 0], [10, 6, 0]], reese: false, lead: [[0, 7], [3, 10], [6, 12], [10, 15], [12, 12]] },
  { name: "Hard Shoulder", bpm: 175, root: 37, prog: [0, 0, 1, -2], minor: [true, true, true, true], kick: [0, 7, 10], snare: [4, 12], ghost: [15], bass: [[0, 2, 0], [2, 2, 1], [7, 3, 0], [10, 6, 0]], reese: true },
  { name: "Tailwind", bpm: 170, root: 42, prog: [0, -5, -3, -1], minor: [false, true, false, false], kick: [0, 10], snare: [4, 12], ghost: [2, 9], bass: [[0, 6, 0], [8, 2, 1], [10, 6, 0]], reese: false, lead: [[0, 4], [2, 7], [4, 11], [8, 7], [11, 4], [14, 2]] },
  { name: "Cat's Eyes", bpm: 172, root: 39, prog: [0, -2, -4, -2], minor: [true, false, false, false], kick: [0, 6, 10], snare: [4, 12], ghost: [3, 11], bass: [[0, 4, 0], [6, 4, 0], [11, 5, 0]], reese: false, lead: [[0, 12], [6, 10], [10, 7], [14, 3]] },
  { name: "Tunnel Vision", bpm: 176, root: 35, prog: [0, 0, 0, 3], minor: [true, true, true, false], kick: [0, 10, 13], snare: [4, 12], ghost: [6, 9, 15], bass: [[0, 3, 0], [4, 2, 1], [10, 3, 0], [13, 3, 0]], reese: true },
  { name: "Afterburn", bpm: 178, root: 38, prog: [0, -3, -5, -7], minor: [true, false, false, false], kick: [0, 2, 10], snare: [4, 12], ghost: [7], bass: [[0, 2, 0], [2, 4, 0], [10, 2, 1], [12, 4, 0]], reese: true, lead: [[0, 0], [1, 12], [8, 0], [9, 12]] },
  { name: "Rev Limiter", bpm: 174, root: 36, prog: [0, 1, 0, -2], minor: [true, true, true, false], kick: [0, 3, 6, 10], snare: [4, 12], ghost: [14], bass: [[0, 3, 0], [3, 3, 0], [6, 4, 0], [10, 6, 0]], reese: true },
  { name: "Gantry Lights", bpm: 172, root: 44, prog: [0, -4, -7, -5], minor: [false, false, true, false], kick: [0, 10], snare: [4, 12], ghost: [7, 15], bass: [[0, 6, 0], [10, 6, 0]], reese: false, lead: [[0, 7], [2, 4], [4, 7], [6, 12], [8, 11], [10, 7], [12, 4], [14, 2]] },
  { name: "Cruise Control", bpm: 168, root: 41, prog: [0, 5, -2, 3], minor: [true, false, false, false], kick: [0, 10], snare: [4, 12], ghost: [9], bass: [[0, 10, 0], [10, 6, 0]], reese: false, lead: [[0, 3], [8, 7], [12, 10]] },
  { name: "Midnight Merge", bpm: 174, root: 37, prog: [0, 3, -2, -4], minor: [true, false, true, false], kick: [0, 6, 10], snare: [4, 12], ghost: [2, 14], bass: [[0, 4, 0], [6, 2, 1], [10, 4, 0], [14, 2, 0]], reese: true, lead: [[0, 15], [4, 12], [8, 10], [12, 7]] },
  { name: "Green Wave", bpm: 176, root: 43, prog: [0, -2, -4, -5], minor: [false, false, false, false], kick: [0, 10, 11], snare: [4, 12], ghost: [7, 15], bass: [[0, 6, 0], [7, 3, 1], [10, 6, 0]], reese: false, lead: [[0, 4], [3, 7], [6, 9], [8, 12], [11, 9], [14, 7]] },
];

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export function createDnb() {
  let ctx: AudioContext | null = null;
  let out: GainNode;
  let noise: AudioBuffer;
  let timer = 0;
  let track = DNB_TRACKS[0];
  let step = 0;
  let next = 0;
  let volume = 0.5;

  const init = () => {
    if (!ctx) {
      ctx = new AudioContext();
      out = ctx.createGain();
      out.gain.value = volume;
      out.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };

  /** A gain envelope into the output: up to `peak` in `attack` s, down to silence over `decay` s. */
  const env = (c: AudioContext, t: number, peak: number, attack: number, decay: number) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out);
    return g;
  };
  const osc = (c: AudioContext, t: number, type: OscillatorType, f: number, dur: number, to: AudioNode) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(to);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  };
  const hiss = (c: AudioContext, t: number, type: BiquadFilterType, f: number, dur: number, to: AudioNode) => {
    const src = c.createBufferSource();
    src.buffer = noise;
    const flt = c.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    src.connect(flt).connect(to);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  };

  const kick = (c: AudioContext, t: number) => {
    const o = osc(c, t, "sine", 150, 0.32, env(c, t, 0.9, 0.002, 0.3));
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  };
  const snare = (c: AudioContext, t: number, v: number) => {
    hiss(c, t, "bandpass", 1900, 0.2, env(c, t, 0.5 * v, 0.002, 0.17));
    osc(c, t, "triangle", 190, 0.1, env(c, t, 0.3 * v, 0.002, 0.08));
  };
  const hat = (c: AudioContext, t: number, v: number) => hiss(c, t, "highpass", 7500, 0.06, env(c, t, 0.13 * v, 0.001, 0.04));

  const schedule = (c: AudioContext, s: number, t: number) => {
    const bar = Math.floor(s / 16) % 4;
    const i = s % 16;
    const dt = 60 / track.bpm / 4;
    const root = track.root + track.prog[bar];
    if (track.kick.includes(i)) kick(c, t);
    if (track.snare.includes(i)) snare(c, t, 1);
    if (track.ghost.includes(i)) snare(c, t, 0.25);
    hat(c, t, i % 4 === 2 ? 1 : i % 2 ? 0.35 : 0.6);
    for (const [at, len, oct] of track.bass) {
      if (at !== i) continue;
      const f = hz(root + 12 * oct);
      osc(c, t, "sine", f, len * dt, env(c, t, 0.55, 0.01, len * dt));
      if (track.reese) {
        const flt = c.createBiquadFilter();
        flt.type = "lowpass";
        flt.frequency.value = 420;
        flt.connect(env(c, t, 0.12, 0.02, len * dt));
        osc(c, t, "sawtooth", f * 2 * 1.006, len * dt, flt);
        osc(c, t, "sawtooth", f * 2 * 0.994, len * dt, flt);
      }
    }
    for (const [at, semis] of track.lead ?? []) {
      if (at !== i) continue;
      const flt = c.createBiquadFilter();
      flt.type = "lowpass";
      flt.frequency.value = 2200;
      flt.connect(env(c, t, 0.07, 0.004, 3 * dt));
      osc(c, t, "square", hz(root + 24 + semis), 3 * dt, flt);
    }
    if (i === 0) {
      // A soft pad chord for the whole bar.
      const flt = c.createBiquadFilter();
      flt.type = "lowpass";
      flt.frequency.value = 1100;
      flt.connect(env(c, t, 0.05, 0.4, 16 * dt));
      for (const n of [0, track.minor[bar] ? 3 : 4, 7]) osc(c, t, "triangle", hz(root + 24 + n), 16 * dt + 0.4, flt);
    }
  };

  return {
    tracks: DNB_TRACKS,
    /** Start (or restart) a track. Call from a user gesture the first time, so the browser allows sound. */
    play(index: number) {
      const c = init();
      track = DNB_TRACKS[((index % DNB_TRACKS.length) + DNB_TRACKS.length) % DNB_TRACKS.length];
      clearInterval(timer);
      step = 0;
      next = c.currentTime + 0.06;
      // Look-ahead scheduling: a timer queues every note due in the next 120 ms at its exact audio time.
      timer = window.setInterval(() => {
        while (ctx && next < ctx.currentTime + 0.12) {
          schedule(ctx, step++, next);
          next += 60 / track.bpm / 4;
        }
      }, 25);
    },
    pause() {
      clearInterval(timer);
      timer = 0;
    },
    setVolume(v: number) {
      volume = v;
      if (ctx) out.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    },
    dispose() {
      clearInterval(timer);
      void ctx?.close();
    },
  };
}

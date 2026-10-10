"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending, BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, PlaneGeometry, Vector3, type Group, type Material, type Mesh,
} from "three";
import { MODELS, laneX } from "@/game/config";
import type { CarModel, Npc, PlayerModel } from "@/game/types";
import { useEngine, useNight, useWeather } from "./context";
import { glowTexture, softGlowTexture } from "./textures";

const flat = (color: string, roughness = 0.5) => new MeshStandardMaterial({ color, flatShading: true, roughness });
const glow = (color: string, opacity: number, soft = false) =>
  new MeshBasicMaterial({ map: soft ? softGlowTexture() : glowTexture(), color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });
const M = {
  black: flat("#1b1d22", 0.35),
  red: flat("#c8323a", 0.35),
  carbon: flat("#2a2c31", 0.85),
  glass: flat("#56677d", 0.15),
  tyre: flat("#141517", 0.9),
  hub: flat("#8c9096", 0.4),
  trim: flat("#0d0e10", 0.7),
  steel: flat("#9097a0", 0.3),
  scuff: flat("#7d7a74", 1),
  dent: flat("#bdb9b0", 0.8),
  lamp: new MeshBasicMaterial({ color: "#fff6dc" }),
  amber: new MeshBasicMaterial({ color: "#ffb020" }),
  tailDay: flat("#8a1820", 0.4),
  tailNight: new MeshBasicMaterial({ color: "#ff3344" }),
  beam: glow("#fff0c8", 0.38),
  tailGlow: glow("#ff2a3a", 0.45, true),
  flame: new MeshBasicMaterial({ color: "#ff6a1a", transparent: true, opacity: 0.85, depthWrite: false }),
  flameCore: new MeshBasicMaterial({ color: "#fff1b0" }),
  flameGlow: glow("#ff8a2a", 0.7),
};
const BOX = new BoxGeometry(1, 1, 1);
const WHEEL = new CylinderGeometry(1, 1, 1, 14).rotateZ(Math.PI / 2); // axis along x
const FLAT = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2); // lies on the ground, spans x/z
const CONE = new ConeGeometry(1, 1, 6).translate(0, 0.5, 0).rotateX(Math.PI / 2); // base at origin, tip towards +z

type V3 = [number, number, number];
const Box = ({ m, s, p, r, shadow = true }: { m: Material; s: V3; p: V3; r?: V3; shadow?: boolean }) => (
  <mesh geometry={BOX} material={m} scale={s} position={p} rotation={r} castShadow={shadow} />
);

/**
 * One cross-section of the body: [t along the car (0 nose → 1 tail), half-width (fraction of W/2),
 * waist/deck height (m), roof height (m, only where there is a cabin), front-wing rise above the hood (m)].
 */
type Station = [number, number, number, number?, number?];
interface Style {
  stations: Station[];
  ride: number; // ground clearance (m)
  gb: number; // greenhouse half-width at the waist, as a fraction of the body's
  gt: number; // …and at the roof (tumblehome)
  wheel: number; // tyre radius (m)
  axles: [number, number]; // front and rear axle, as t
  head: [number, number]; // headlight centre (fraction of half-width), lamp width (m)
  tail: [number, number, number]; // taillight centre (fraction; 0 = one full-width strip), width (m), height (m)
  hood?: [number, number]; // t range in the accent colour (GT3 carbon hood)
  roofAccent?: boolean; // roof in the accent colour
  bed?: [number, number]; // open pickup bed, t range
  rails?: boolean; // roof rails
}

// Profiles traced from each car's real proportions (side silhouette + plan taper).
const STYLE: Record<CarModel, Style> = {
  gt3rs: {
    stations: [[0, 0.8, 0.48], [0.04, 0.92, 0.62, undefined, 0.06], [0.14, 0.97, 0.7, undefined, 0.11], [0.3, 0.95, 0.76, undefined, 0.08], [0.36, 0.94, 0.79, 0.81], [0.52, 0.93, 0.83, 1.27], [0.63, 0.97, 0.86, 1.28], [0.74, 1, 0.88, 1.12], [0.86, 1, 0.88, 0.92], [0.95, 0.99, 0.86], [1, 0.92, 0.7]],
    ride: 0.12, gb: 0.72, gt: 0.56, wheel: 0.35, axles: [0.19, 0.8], head: [0.7, 0.3], tail: [0, 1.74, 0.07],
    hood: [0.04, 0.36], roofAccent: true,
  },
  // 992 Turbo S: the same 911 shape with smoother wings, wider hips and no fixed wing
  turbos: {
    stations: [[0, 0.8, 0.48], [0.04, 0.92, 0.62, undefined, 0.04], [0.14, 0.97, 0.7, undefined, 0.08], [0.3, 0.95, 0.76, undefined, 0.05], [0.36, 0.94, 0.79, 0.81], [0.52, 0.93, 0.83, 1.27], [0.63, 0.98, 0.86, 1.28], [0.74, 1, 0.89, 1.12], [0.86, 1, 0.9, 0.94], [0.95, 0.99, 0.88], [1, 0.92, 0.72]],
    ride: 0.12, gb: 0.72, gt: 0.56, wheel: 0.35, axles: [0.19, 0.8], head: [0.7, 0.3], tail: [0, 1.74, 0.07],
  },
  // G82 M4 coupe: long hood, carbon roof, short fastback deck
  m4: {
    stations: [[0, 0.82, 0.52], [0.04, 0.94, 0.68], [0.15, 0.99, 0.78], [0.33, 1, 0.86, undefined, 0.03], [0.36, 1, 0.88, 0.9], [0.5, 0.99, 0.9, 1.38], [0.67, 0.99, 0.92, 1.36], [0.83, 0.99, 0.95, 0.99], [0.94, 0.98, 0.95], [1, 0.9, 0.78]],
    ride: 0.12, gb: 0.84, gt: 0.68, wheel: 0.35, axles: [0.17, 0.8], head: [0.7, 0.42], tail: [0.76, 0.4, 0.12], roofAccent: true,
  },
  yaris: {
    stations: [[0, 0.84, 0.55], [0.04, 0.94, 0.72], [0.15, 0.98, 0.84], [0.27, 0.99, 0.9], [0.3, 1, 0.92, 0.94], [0.47, 1, 0.94, 1.48], [0.85, 0.99, 0.96, 1.46], [0.96, 0.97, 0.96, 1.26], [1, 0.92, 0.82, 0.86]],
    ride: 0.15, gb: 0.88, gt: 0.74, wheel: 0.3, axles: [0.17, 0.82], head: [0.68, 0.42], tail: [0.86, 0.2, 0.3],
  },
  civic: {
    stations: [[0, 0.82, 0.52], [0.04, 0.93, 0.68], [0.15, 0.98, 0.78], [0.3, 1, 0.86], [0.33, 1, 0.88, 0.9], [0.5, 1, 0.9, 1.4], [0.66, 1, 0.92, 1.4], [0.87, 0.99, 0.96, 1.0], [0.95, 0.97, 0.96], [1, 0.9, 0.78]],
    ride: 0.14, gb: 0.86, gt: 0.7, wheel: 0.32, axles: [0.18, 0.79], head: [0.66, 0.5], tail: [0.72, 0.5, 0.12],
  },
  malibu: {
    stations: [[0, 0.82, 0.55], [0.04, 0.93, 0.72], [0.15, 0.98, 0.82], [0.29, 1, 0.88], [0.31, 1, 0.9, 0.92], [0.46, 1, 0.92, 1.45], [0.68, 1, 0.94, 1.45], [0.8, 0.99, 0.98, 1.02], [0.93, 0.98, 0.98], [1, 0.9, 0.8]],
    ride: 0.15, gb: 0.86, gt: 0.7, wheel: 0.33, axles: [0.18, 0.79], head: [0.68, 0.46], tail: [0.72, 0.46, 0.14],
  },
  rogue: {
    stations: [[0, 0.85, 0.7], [0.04, 0.95, 0.88], [0.13, 0.99, 0.98], [0.26, 1, 1.04], [0.28, 1, 1.06, 1.08], [0.42, 1, 1.08, 1.68], [0.88, 0.99, 1.1, 1.66], [0.97, 0.97, 1.08, 1.42], [1, 0.93, 0.98, 1.0]],
    ride: 0.2, gb: 0.88, gt: 0.76, wheel: 0.37, axles: [0.18, 0.81], head: [0.7, 0.44], tail: [0.84, 0.3, 0.16], rails: true,
  },
  f150: {
    stations: [[0, 0.88, 0.95], [0.03, 0.97, 1.12], [0.1, 1, 1.2], [0.25, 1, 1.24], [0.27, 1, 1.25, 1.27], [0.36, 1, 1.26, 1.92], [0.58, 1, 1.26, 1.92], [0.6, 1, 1.26, 1.27], [0.62, 1, 1.2], [0.98, 1, 1.2], [1, 0.97, 1.05]],
    ride: 0.28, gb: 0.9, gt: 0.84, wheel: 0.43, axles: [0.16, 0.8], head: [0.72, 0.44], tail: [0.95, 0.1, 0.42], bed: [0.62, 0.98],
  },
  m3: {
    stations: [[0, 0.82, 0.5], [0.04, 0.94, 0.66], [0.15, 0.99, 0.76], [0.31, 1, 0.84, undefined, 0.03], [0.34, 1, 0.86, 0.88], [0.5, 0.99, 0.88, 1.4], [0.7, 0.99, 0.9, 1.4], [0.83, 0.99, 0.94, 1.0], [0.94, 0.98, 0.94], [1, 0.9, 0.76]],
    ride: 0.12, gb: 0.84, gt: 0.68, wheel: 0.35, axles: [0.18, 0.79], head: [0.68, 0.44], tail: [0.76, 0.4, 0.12],
  },
  c63: {
    stations: [[0, 0.82, 0.52], [0.04, 0.94, 0.68], [0.15, 0.99, 0.78], [0.31, 1, 0.85, undefined, 0.02], [0.33, 1, 0.87, 0.89], [0.48, 0.99, 0.89, 1.43], [0.7, 0.99, 0.91, 1.43], [0.82, 0.99, 0.96, 1.02], [0.94, 0.98, 0.96], [1, 0.9, 0.78]],
    ride: 0.12, gb: 0.85, gt: 0.7, wheel: 0.34, axles: [0.17, 0.8], head: [0.7, 0.4], tail: [0.78, 0.36, 0.12],
  },
  a5: {
    stations: [[0, 0.82, 0.5], [0.04, 0.94, 0.66], [0.15, 0.99, 0.76], [0.33, 1, 0.84], [0.36, 1, 0.86, 0.88], [0.53, 0.99, 0.88, 1.36], [0.66, 0.99, 0.9, 1.36], [0.84, 0.99, 0.93, 0.97], [0.94, 0.98, 0.93], [1, 0.9, 0.76]],
    ride: 0.12, gb: 0.84, gt: 0.66, wheel: 0.34, axles: [0.17, 0.81], head: [0.7, 0.42], tail: [0.76, 0.4, 0.11],
  },
};

/** Body half-width (x), waist height (y) and z at a point t along the car, interpolated between stations. */
function at(model: CarModel, t: number) {
  const s = STYLE[model].stations;
  let i = 0;
  while (i < s.length - 2 && s[i + 1][0] < t) i++;
  const [t0, w0, b0] = s[i];
  const [t1, w1, b1] = s[i + 1];
  const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  const { length: L, width: W } = MODELS[model];
  return { x: ((w0 + (w1 - w0) * k) * W) / 2, y: b0 + (b1 - b0) * k, z: -L / 2 + t * L };
}

/** Rear axle of the player car, for the skid marks in Fx.tsx. */
export const GT3_REAR_AXLE = at("gt3rs", STYLE.gt3rs.axles[1]).z;

const geoCache = new Map<CarModel, BufferGeometry>();

/**
 * Lofts the body through its stations: a 12-point ring per station (sill, side, shoulder, front wing,
 * greenhouse base, roof edge, mirrored), joined into quads. Groups: 0 paint, 1 glass, 2 accent.
 * Steep roof segments become windscreen/rear window, cabin sides become side windows.
 */
function bodyGeometry(model: CarModel): BufferGeometry {
  const cached = geoCache.get(model);
  if (cached) return cached;
  const { length: L, width: W } = MODELS[model];
  const { stations, ride, gb, gt, hood, roofAccent } = STYLE[model];
  const rings = stations.map(([t, hw, belt, roof, rise = 0]) => {
    const x = (hw * W) / 2;
    const top = roof ?? belt;
    const right: [number, number][] = [[0.88 * x, ride], [x, ride + 0.3 * (belt - ride)], [x, belt - 0.12], [0.94 * x, belt + rise], [gb * x, belt], [gt * x, top]];
    const pts = [...right, ...[...right].reverse().map(([a, b]): [number, number] => [-a, b])];
    return {
      z: -L / 2 + t * L, pts, roof: top, mid: (ride + belt) / 2,
      hasRoof: roof !== undefined, cabin: roof !== undefined && roof - belt > 0.12, accent: !!hood && t >= hood[0] && t < hood[1],
    };
  });
  const buckets: number[][] = [[], [], []];
  const [a, b, c, n, out] = [new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  // Winding is fixed by facing each triangle away from the body's axis, so no face is culled by mistake.
  const tri = (m: number, p: number[], q: number[], r: number[]) => {
    a.fromArray(p);
    b.fromArray(q).sub(a);
    c.fromArray(r).sub(a);
    n.crossVectors(b, c);
    buckets[m].push(...(n.dot(out) >= 0 ? [...p, ...q, ...r] : [...p, ...r, ...q]));
  };
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i];
    const B = rings[i + 1];
    const slope = Math.abs(B.roof - A.roof) / (B.z - A.z);
    for (let k = 0; k < 12; k++) {
      const k2 = (k + 1) % 12;
      let m = 0;
      if (k === 5) m = (A.hasRoof || B.hasRoof) && slope > 0.3 ? 1 : A.cabin && B.cabin ? (roofAccent ? 2 : 0) : A.accent ? 2 : 0;
      else if (k === 4 || k === 6) m = A.cabin && B.cabin ? 1 : A.accent ? 2 : 0;
      const P = [...A.pts[k], A.z];
      const Q = [...A.pts[k2], A.z];
      const R = [...B.pts[k2], B.z];
      const S = [...B.pts[k], B.z];
      out.set((P[0] + R[0]) / 2, (P[1] + R[1]) / 2 - (A.mid + B.mid) / 2, 0);
      tri(m, P, Q, R);
      tri(m, P, R, S);
    }
  }
  for (const [R, dir] of [[rings[0], -1], [rings[rings.length - 1], 1]] as const) {
    out.set(0, 0, dir);
    for (let k = 0; k < 12; k++) tri(0, [0, R.mid, R.z], [...R.pts[k], R.z], [...R.pts[(k + 1) % 12], R.z]);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(buckets.flat(), 3));
  let start = 0;
  buckets.forEach((list, m) => {
    g.addGroup(start, list.length / 3, m);
    start += list.length / 3;
  });
  g.computeVertexNormals();
  geoCache.set(model, g);
  return g;
}

/** Lofted shell plus wheels, mirrors, lamps and model details. Origin at ground centre, nose towards −z. */
function Body({ model, paint, accent = paint, tailMat }: { model: CarModel; paint: Material; accent?: Material; tailMat?: Material }) {
  const night = useNight();
  const st = STYLE[model];
  const { length: L, width: W } = MODELS[model];
  const mats = useMemo(() => [paint, M.glass, accent], [paint, accent]);
  const nose = at(model, 0.04);
  const tail = at(model, 0.97);
  const mirror = at(model, st.stations.find((s) => s[3] !== undefined)![0] + 0.03);
  const [hx, hw] = st.head;
  const [tx, tw, th] = st.tail;
  const tails = tailMat ?? (night ? M.tailNight : M.tailDay);
  const roofTop = st.stations.filter((s) => s[3] !== undefined && s[3] - s[2] > 0.4);
  return (
    <>
      <mesh geometry={bodyGeometry(model)} material={mats} castShadow />
      {st.axles.flatMap((t, i) =>
        [-1, 1].map((sx) => (
          <group key={`${i}${sx}`} position={[sx * (W / 2 - 0.14), st.wheel, -L / 2 + t * L]}>
            <mesh geometry={WHEEL} material={M.tyre} scale={[0.26, st.wheel, st.wheel]} />
            <mesh geometry={WHEEL} material={M.hub} scale={[0.27, st.wheel * 0.62, st.wheel * 0.62]} />
          </group>
        )),
      )}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Box m={paint} s={[0.17, 0.1, 0.13]} p={[sx * (mirror.x + 0.06), mirror.y + 0.12, mirror.z]} />
          <Box m={M.lamp} s={[hw, 0.1, 0.24]} p={[sx * hx * nose.x, nose.y - 0.04, -L / 2 + 0.1]} shadow={false} />
          {tx !== 0 && <Box m={tails} s={[tw, th, 0.16]} p={[sx * tx * tail.x, tail.y - th / 2 + 0.03, L / 2 - 0.06]} shadow={false} />}
        </group>
      ))}
      {tx === 0 && <Box m={tails} s={[tw, th, 0.16]} p={[0, tail.y - th / 2 + 0.03, L / 2 - 0.06]} shadow={false} />}
      {st.bed && (
        <Box m={M.trim} s={[W - 0.26, 0.04, (st.bed[1] - st.bed[0]) * L]} p={[0, at(model, st.bed[0]).y + 0.005, -L / 2 + ((st.bed[0] + st.bed[1]) / 2) * L]} shadow={false} />
      )}
      {st.rails &&
        [-1, 1].map((sx) => {
          const [t0, t1] = [roofTop[0][0], roofTop[roofTop.length - 1][0]];
          const x = st.gt * at(model, (t0 + t1) / 2).x * 0.92;
          return <Box key={sx} m={M.trim} s={[0.05, 0.05, (t1 - t0) * L]} p={[sx * x, roofTop[0][3]! + 0.03, -L / 2 + ((t0 + t1) / 2) * L]} shadow={false} />;
        })}
    </>
  );
}

const BEAM = 14;

/** Ground beam ahead and a soft red pool behind each taillight; `setTrails` stretches the pools with speed. */
function NightLights({ model, trails }: { model: CarModel; trails: React.RefObject<(Mesh | null)[]> }) {
  const { length: L, width: W } = MODELS[model];
  const [tx] = STYLE[model].tail;
  const xs = tx === 0 ? [0] : [-1, 1].map((s) => s * tx * at(model, 0.97).x);
  return (
    <>
      <mesh geometry={FLAT} material={M.beam} scale={[W * 1.7, 1, BEAM]} position={[0, 0.06, -L / 2 - BEAM * 0.4]} />
      {xs.map((x, i) => (
        <mesh key={i} ref={(m) => void (trails.current[i] = m)} geometry={FLAT} material={M.tailGlow} position={[x, 0.05, 0]} />
      ))}
    </>
  );
}

/** `wet`: on a rainy road the pools become long, narrow reflections. */
function setTrails(meshes: (Mesh | null)[], model: CarModel, speed: number, wet: boolean) {
  const L = MODELS[model].length;
  const tw = STYLE[model].tail[1];
  const len = (1.6 + speed * 0.05) * (wet ? 2.2 : 1);
  for (const m of meshes) {
    if (!m) continue;
    m.scale.set((tw * 1.5 + 0.5) * (wet ? 0.7 : 1), 1, len);
    m.position.z = L / 2 + len * 0.38;
  }
}

/** Tailpipe x offsets and height: GT3 RS twin centre pipes, Turbo S twin outer pipes, M4 quad pipes. */
const EXHAUSTS: Record<PlayerModel, number[]> = { gt3rs: [-0.1, 0.1], turbos: [-0.62, 0.62], m4: [-0.68, -0.52, 0.52, 0.68] };
const EXHAUST_Y: Record<PlayerModel, number> = { gt3rs: 0.4, turbos: 0.3, m4: 0.3 };

export function PlayerCar({ model, color }: { model: PlayerModel; color: string }) {
  const engine = useEngine();
  const night = useNight();
  const root = useRef<Group>(null);
  const scuffs = useRef<Group>(null);
  const dents = useRef<Group>(null);
  const flames = useRef<Group>(null);
  const trails = useRef<(Mesh | null)[]>([]);
  const led = useMemo(() => new MeshBasicMaterial(), []);
  const target = useMemo(() => new Object3D(), []);
  const paint = useMemo(() => flat(color, 0.35), [color]);
  const wet = useWeather() === "rain";
  useFrame(() => {
    const p = engine.state.player;
    if (!root.current || !scuffs.current || !dents.current || !flames.current) return;
    root.current.position.x = p.x;
    root.current.rotation.y = -p.vx * 0.018; // ~13° at peak lane-change speed
    root.current.visible = p.invulnT === 0 || Math.floor(p.invulnT * 10) % 2 === 0;
    scuffs.current.visible = p.lives <= 2;
    dents.current.visible = p.lives <= 1;
    flames.current.visible = p.nitroT > 0;
    flames.current.scale.z = 0.7 + Math.random() * 0.6;
    led.color.set(p.brakeT > 0 ? "#ff1428" : night ? "#e0283a" : "#7a1018");
    setTrails(trails.current, model, p.speed, wet);
  });
  const { length: L, width: W } = MODELS[model];
  const deck = at(model, 0.93).y;
  const fender = at(model, STYLE[model].axles[0]);
  const pipes = EXHAUSTS[model];
  const pipeY = EXHAUST_Y[model];
  return (
    <group ref={root}>
      <Body model={model} paint={paint} accent={model === "turbos" ? paint : M.carbon} tailMat={led} />
      {model === "gt3rs" && (
        <>
          {/* louvers on top of the front wings */}
          {[-1, 1].flatMap((sx) =>
            [0, 1, 2, 3].map((i) => (
              <Box key={`${sx}${i}`} m={M.trim} s={[0.28, 0.02, 0.06]} p={[sx * fender.x * 0.86, fender.y + 0.11, fender.z + (i - 1.5) * 0.13]} shadow={false} />
            )),
          )}
          {/* swan-neck wing: posts, plank, end plates */}
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <Box m={M.carbon} s={[0.05, 0.5, 0.14]} p={[sx * 0.34, deck + 0.25, L / 2 - 0.32]} />
              <Box m={M.carbon} s={[0.04, 0.22, 0.52]} p={[sx * (W / 2 - 0.04), deck + 0.46, L / 2 - 0.24]} />
            </group>
          ))}
          <Box m={M.carbon} s={[W - 0.06, 0.05, 0.46]} p={[0, deck + 0.52, L / 2 - 0.24]} />
        </>
      )}
      {/* Turbo S: raised active spoiler and the intake grille behind the rear window */}
      {model === "turbos" && (
        <>
          <Box m={paint} s={[W * 0.78, 0.05, 0.34]} p={[0, deck + 0.12, L / 2 - 0.3]} r={[-0.12, 0, 0]} />
          <Box m={M.trim} s={[W * 0.42, 0.02, 0.2]} p={[0, at(model, 0.86).y + 0.01, -L / 2 + 0.86 * L]} shadow={false} />
        </>
      )}
      {/* M4: tall kidney grille and a carbon boot lip */}
      {model === "m4" && (
        <>
          {[-1, 1].map((sx) => (
            <Box key={sx} m={M.trim} s={[0.3, 0.32, 0.06]} p={[sx * 0.18, at(model, 0.02).y - 0.2, -L / 2 + 0.02]} shadow={false} />
          ))}
          <Box m={M.carbon} s={[W * 0.7, 0.04, 0.12]} p={[0, deck + 0.04, L / 2 - 0.18]} r={[-0.3, 0, 0]} />
        </>
      )}
      {pipes.map((x) => (
        <mesh key={x} geometry={WHEEL} material={M.steel} scale={[0.22, 0.065, 0.065]} rotation-y={Math.PI / 2} position={[x, pipeY, L / 2 + 0.02]} />
      ))}
      <group ref={flames} position={[0, pipeY, L / 2 + 0.05]} visible={false}>
        {pipes.map((x) => (
          <group key={x} position-x={x}>
            <mesh geometry={CONE} material={M.flame} scale={[0.16, 0.16, 1.3]} />
            <mesh geometry={CONE} material={M.flameCore} scale={[0.07, 0.07, 0.6]} />
          </group>
        ))}
        <mesh geometry={FLAT} material={M.flameGlow} scale={[2.4, 1, 3.2]} position={[0, -0.35, 1.1]} />
      </group>
      <group ref={scuffs}>
        <Box m={M.scuff} s={[0.5, 0.02, 0.36]} p={[-(W / 2 - 0.32), at(model, 0.9).y + 0.015, L / 2 - 0.5]} shadow={false} />
        <Box m={M.scuff} s={[0.4, 0.02, 0.3]} p={[W / 2 - 0.3, at(model, 0.1).y + 0.1, -L / 2 + 0.45]} shadow={false} />
        <Box m={M.scuff} s={[0.02, 0.2, 0.9]} p={[-W / 2 - 0.006, 0.5, 0.3]} shadow={false} />
      </group>
      <group ref={dents}>
        <Box m={M.dent} s={[0.6, 0.22, 0.5]} p={[-(W / 2 - 0.3), 0.5, -L / 2 + 0.22]} r={[0.35, 0.3, 0.1]} />
        <Box m={M.carbon} s={[0.9, 0.03, 0.6]} p={[-0.15, at(model, 0.2).y + 0.1, -L / 2 + 0.9]} r={[0.25, 0.2, 0.06]} />
        <Box m={M.trim} s={[0.9, 0.08, 0.1]} p={[0.35, 0.2, -L / 2 - 0.06]} r={[0, 0.15, 0.25]} />
        <Box m={M.dent} s={[0.03, 0.24, 1.1]} p={[W / 2 + 0.01, 0.45, 0.6]} r={[0, 0.06, 0.12]} />
      </group>
      {night && (
        <>
          <NightLights model={model} trails={trails} />
          <primitive object={target} position={[0, 0, -30]} />
          <spotLight target={target} position={[0, 1, -L / 2]} color="#fff1d0" intensity={600} angle={0.42} penumbra={0.7} decay={2} />
        </>
      )}
    </group>
  );
}

export function NpcCar({ id }: { id: number }) {
  const engine = useEngine();
  const night = useNight();
  const root = useRef<Group>(null);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const trails = useRef<(Mesh | null)[]>([]);
  const npc = useRef<Npc | undefined>(undefined);
  const wet = useWeather() === "rain";
  npc.current ??= engine.state.npcs.find((n) => n.id === id);
  useFrame(({ clock }) => {
    const n = engine.state.npcs.find((o) => o.id === id);
    if (!n || !root.current || !left.current || !right.current) return;
    const dx = laneX(n.targetLane) - n.x;
    root.current.position.set(n.x, 0, -(n.s - engine.state.player.s));
    root.current.rotation.y = Math.abs(dx) > 0.05 ? -Math.sign(dx) * n.latSpeed * 0.03 : 0;
    const on = clock.elapsedTime % 0.5 < 0.25;
    left.current.visible = n.signal === -1 && on;
    right.current.visible = n.signal === 1 && on;
    setTrails(trails.current, n.model, n.speed, wet);
  });
  if (!npc.current) return null;
  const { model, kind } = npc.current;
  const corners = [at(model, 0.05), at(model, 0.95)];
  const blinker = (side: -1 | 1, ref: React.Ref<Group>) => (
    <group ref={ref} visible={false}>
      {corners.map((c, i) => (
        <Box key={i} m={M.amber} s={[0.32, 0.14, 0.3]} p={[side * (c.x - 0.14), c.y + 0.03, c.z]} shadow={false} />
      ))}
    </group>
  );
  return (
    <group ref={root}>
      <Body model={model} paint={kind === "merger" ? M.red : M.black} />
      {blinker(-1, left)}
      {blinker(1, right)}
      {night && <NightLights model={model} trails={trails} />}
    </group>
  );
}

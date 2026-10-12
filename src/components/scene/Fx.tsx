"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending, BoxGeometry, ExtrudeGeometry, IcosahedronGeometry, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, Shape, Vector3,
  type Group, type InstancedMesh, type Mesh,
} from "three";
import { MODELS } from "@/game/config";
import { useEngine } from "./context";
import { softGlowTexture } from "./textures";
import { GT3_REAR_AXLE } from "./Vehicles";

const { length: L, width: W } = MODELS.gt3rs;
const REAR_AXLE = GT3_REAR_AXLE; // m behind the car's centre
const TRACK = W / 2 - 0.14; // matches the wheel placement in Vehicles.tsx

const FLAT = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const MARK = new MeshBasicMaterial({ color: "#1d1d20", transparent: true, opacity: 0.5, depthWrite: false });
const SKID_N = 240;

/** Rear-tyre streaks laid in road space while the player swerves hard or brakes. */
export function SkidMarks() {
  const engine = useEngine();
  const ref = useRef<InstancedMesh>(null);
  const segs = useMemo(() => Array.from({ length: SKID_N }, () => ({ s: 0, x: 0, yaw: 0, len: 0 })), []);
  const last = useRef<number[][] | null>(null); // previous [s, x] of each rear tyre
  const next = useRef(0);
  const tmp = useMemo(() => new Object3D(), []);
  useEffect(() => engine.on((e) => e.type === "restart" && segs.forEach((g) => (g.len = 0))), [engine, segs]);
  useFrame(() => {
    const { status, player: p } = engine.state;
    const mesh = ref.current;
    if (!mesh) return;
    const sliding = status === "running" && (Math.abs(p.vx) > 3 || p.brakeT > 0);
    const pts = sliding ? [-1, 1].map((side) => [p.s - REAR_AXLE, p.x + side * TRACK]) : null;
    if (pts && last.current) {
      pts.forEach(([s1, x1], i) => {
        const [s0, x0] = last.current![i];
        const g = segs[next.current++ % SKID_N];
        [g.s, g.x, g.yaw, g.len] = [(s0 + s1) / 2, (x0 + x1) / 2, Math.atan2(-(x1 - x0), s1 - s0), Math.hypot(s1 - s0, x1 - x0)];
      });
    }
    last.current = pts;
    segs.forEach((g, i) => {
      tmp.position.set(g.x, 0.035, -(g.s - p.s));
      tmp.rotation.y = g.yaw;
      tmp.scale.set(g.len ? 0.22 : 0, 1, g.len + 0.05);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[FLAT, MARK, SKID_N]} frustumCulled={false} />;
}

const PUFF = new IcosahedronGeometry(1, 0);
const SMOKE_N = 48;

/** Engine smoke from the rear deck once the car is damaged: light at 2 lives, thick and dark at 1. */
export function Smoke() {
  const engine = useEngine();
  const parts = useMemo(
    () => Array.from({ length: SMOKE_N }, () => ({ age: 1, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, dense: false })),
    [],
  );
  const mats = useMemo(() => parts.map(() => new MeshStandardMaterial({ transparent: true, depthWrite: false, flatShading: true })), [parts]);
  const meshes = useRef<(Mesh | null)[]>([]);
  const acc = useRef(0);
  const next = useRef(0);
  useFrame((_, dt) => {
    const p = engine.state.player;
    acc.current += (p.lives >= 3 ? 0 : p.lives === 2 ? 8 : 24) * dt;
    for (; acc.current >= 1; acc.current--) {
      const i = next.current++ % SMOKE_N;
      const q = parts[i];
      const r = Math.random;
      Object.assign(q, {
        age: 0, life: 1.1 + r() * 0.6, x: p.x + (r() - 0.5) * 0.6, y: 1, z: L / 2 - 0.6,
        vx: (r() - 0.5) * 1.2, vy: 1.5 + r(), vz: 7 + r() * 4, dense: p.lives <= 1,
      });
      mats[i].color.set(q.dense ? "#3b3b3e" : "#a3a29e");
    }
    parts.forEach((q, i) => {
      const m = meshes.current[i];
      if (!m) return;
      q.age += dt;
      m.visible = q.age < q.life;
      if (!m.visible) return;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      m.position.set(q.x, q.y, q.z);
      m.scale.setScalar(0.3 + q.age * (q.dense ? 1.6 : 1.1));
      mats[i].opacity = (1 - q.age / q.life) * (q.dense ? 0.8 : 0.5);
    });
  });
  return parts.map((_, i) => (
    <mesh key={i} ref={(m) => void (meshes.current[i] = m)} geometry={PUFF} material={mats[i]} visible={false} />
  ));
}

const PARTICLE = new BoxGeometry(1, 1, 1);
/**
 * Weather particles in a box around the player: `fall` and `wind` (m/s, across the road) plus the road rushing past
 * at the player's speed. Streaks are stretched along that motion (`blur` s of it); `tumble` spins flat bits (leaves) instead.
 */
const PARTICLES = {
  rain: { n: 700, color: "#c9d6e6", opacity: 0.45, size: 0.035, fall: 26, wind: 0, blur: 0.03, top: 45 },
  snow: { n: 900, color: "#ffffff", opacity: 0.9, size: 0.22, fall: 4, wind: 2, blur: 0.005, top: 40 },
  sandstorm: { n: 1100, color: "#d9b27c", opacity: 0.5, size: 0.09, fall: 0.5, wind: 22, blur: 0.03, top: 14 },
  wind: { n: 320, color: "#6f8f3e", opacity: 1, size: 0.5, fall: 1.5, wind: 14, blur: 0, top: 10, tumble: true },
} as const;
export type ParticleKind = keyof typeof PARTICLES;
const SPAN = 34; // m across

export function Particles({ kind }: { kind: ParticleKind }) {
  const engine = useEngine();
  const ref = useRef<InstancedMesh>(null);
  const cfg: { n: number; color: string; opacity: number; size: number; fall: number; wind: number; blur: number; top: number; tumble?: boolean } = PARTICLES[kind];
  const mat = useMemo(() => new MeshBasicMaterial({ color: cfg.color, transparent: cfg.opacity < 1, opacity: cfg.opacity, depthWrite: false }), [cfg]);
  const r = Math.random;
  const bits = useMemo(() => Array.from({ length: cfg.n }, () => ({ x: (r() - 0.5) * SPAN, y: r() * cfg.top, z: -150 + r() * 170, spin: r() * 6 })), [cfg, r]);
  const tmp = useMemo(() => new Object3D(), []);
  const ahead = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const v = engine.state.status === "running" ? engine.state.player.speed : 0;
    const len = Math.max(cfg.size, Math.hypot(cfg.fall, v, cfg.wind) * cfg.blur);
    bits.forEach((d, i) => {
      d.y -= cfg.fall * dt;
      d.z += v * dt;
      d.x += (cfg.wind + (kind === "snow" ? Math.sin(d.spin + d.y) : 0)) * dt;
      if (d.x > SPAN / 2) d.x -= SPAN; // blown across: wrap to the other side
      if (d.y < 0 || d.z > 20) [d.x, d.y, d.z] = [(r() - 0.5) * SPAN, cfg.top * (kind === "rain" ? 0.6 + r() * 0.4 : r()), -150 + r() * 150];
      tmp.position.set(d.x, d.y, d.z);
      if (cfg.tumble) {
        d.spin += dt * 6;
        tmp.rotation.set(d.spin, d.spin * 0.7, 0);
        tmp.scale.set(cfg.size, cfg.size * 0.1, cfg.size * 0.7);
      } else {
        tmp.lookAt(ahead.set(d.x + cfg.wind, d.y - cfg.fall, d.z + v)); // long axis along the bit's motion
        tmp.scale.set(cfg.size, cfg.size, len);
      }
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[PARTICLE, mat, cfg.n]} frustumCulled={false} />;
}

const SPRAY_N = 360;
const SPRAY_PLANE = new PlaneGeometry(1, 1);
const SPRAY_LIFE = 0.7;

/** Road spray: mist kicked up behind every car's rear wheels, left in road space so it streams away behind fast cars. */
export function Spray() {
  const engine = useEngine();
  const ref = useRef<InstancedMesh>(null);
  const mat = useMemo(
    () => new MeshStandardMaterial({ color: "#f2f5f8", alphaMap: softGlowTexture(), transparent: true, opacity: 0.22, depthWrite: false, roughness: 1 }),
    [],
  );
  const puffs = useMemo(() => Array.from({ length: SPRAY_N }, () => ({ s: 0, x: 0, side: 1, age: SPRAY_LIFE, drift: 0 })), []);
  const next = useRef(0);
  const acc = useRef(new Map<number, number>()); // car id (0 = player) → emission carry-over
  const tmp = useMemo(() => new Object3D(), []);
  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const { player: p, npcs, status } = engine.state;
    if (status === "running") {
      const cars = [{ id: 0, s: p.s, x: p.x, len: MODELS.gt3rs.length, w: W, speed: p.speed }, ...npcs.map((n) => ({ id: n.id, s: n.s, x: n.x, len: n.length, w: n.width, speed: n.speed }))];
      for (const c of cars) {
        if (c.s - p.s > 130 || c.s - p.s < -30) continue;
        let a = (acc.current.get(c.id) ?? 0) + c.speed * 0.5 * dt; // ~30 puffs a second at highway speed
        for (; a >= 1; a--) {
          const q = puffs[next.current++ % SPRAY_N];
          q.side = Math.random() < 0.5 ? -1 : 1;
          [q.s, q.x, q.age, q.drift] = [c.s - c.len / 2 + 0.6, c.x + q.side * (c.w / 2 - 0.25), 0, c.speed * 0.3];
        }
        acc.current.set(c.id, a);
      }
      if (acc.current.size > 64) acc.current.clear(); // forget cars that left
    }
    puffs.forEach((q, i) => {
      q.age += dt;
      q.s += q.drift * dt; // dragged along a little behind the car
      const k = q.age / SPRAY_LIFE;
      const size = k < 1 ? (1.1 + k * 2.6) * (1 - k * 0.5) : 0;
      tmp.position.set(q.x + q.side * k * 0.4, 0.3 + k * 0.6, -(q.s - p.s));
      tmp.rotation.set(-Math.PI / 2, 0, 0);
      tmp.scale.set(size, size * 3, 1); // long along the road, so the puffs merge into one plume
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[SPRAY_PLANE, mat, SPRAY_N]} frustumCulled={false} />;
}

/** A heart laid flat for the overhead camera: lobes up the road, point toward the player. ~3 m across. */
const HEART = (() => {
  const h = new Shape();
  h.moveTo(5, 5);
  h.bezierCurveTo(5, 5, 4, 0, 0, 0);
  h.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  h.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  h.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  h.bezierCurveTo(16, 7, 16, 0, 10, 0);
  h.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const g = new ExtrudeGeometry(h, { depth: 4, bevelEnabled: true, bevelSize: 1, bevelThickness: 1, bevelSegments: 2 });
  g.center();
  g.scale(0.14, 0.14, 0.14);
  return g.rotateX(Math.PI / 2);
})();
// Emissive so it still pops at night and in fog.
const HEART_MAT = new MeshStandardMaterial({ color: "#ff3b5c", emissive: "#e11d48", emissiveIntensity: 1, roughness: 0.35 });
const HEART_GLOW = new MeshBasicMaterial({ map: softGlowTexture(), color: "#ff5577", transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false });
const HEART_POOL = 8;

/** Floating, spinning heart pickups, from a fixed pool (only a few are ever on screen). */
export function Hearts() {
  const engine = useEngine();
  const groups = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    const { hearts, player } = engine.state;
    const t = clock.elapsedTime;
    groups.current.forEach((g, i) => {
      const h = hearts[i];
      if (!g) return;
      g.visible = !!h;
      if (!h) return;
      g.position.set(h.x, 2.6 + Math.sin(t * 3 + h.id) * 0.3, -(h.s - player.s));
      g.children[0].rotation.y = t * 2.5 + h.id;
    });
  });
  return Array.from({ length: HEART_POOL }, (_, i) => (
    <group key={i} ref={(g) => void (groups.current[i] = g)} visible={false}>
      <mesh geometry={HEART} material={HEART_MAT} castShadow />
      <mesh geometry={FLAT} material={HEART_GLOW} position-y={-2.5} scale={5} />
    </group>
  ));
}

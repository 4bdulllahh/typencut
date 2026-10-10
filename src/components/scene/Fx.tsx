"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, IcosahedronGeometry, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, type InstancedMesh, type Mesh } from "three";
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

const DROP = new BoxGeometry(0.035, 0.035, 1);
const RAIN_N = 700;
const RAIN_TOP = 45;
const FALL = 26; // m/s
const RAIN_MAT = new MeshBasicMaterial({ color: "#c9d6e6", transparent: true, opacity: 0.45, depthWrite: false });

/** Rain streaks in a box around the player, stretched along their motion relative to the car (falling, and rushing past). */
export function Rain() {
  const engine = useEngine();
  const ref = useRef<InstancedMesh>(null);
  const r = Math.random;
  const drops = useMemo(() => Array.from({ length: RAIN_N }, () => ({ x: (r() - 0.5) * 34, y: r() * RAIN_TOP, z: -150 + r() * 170 })), [r]);
  const tmp = useMemo(() => new Object3D(), []);
  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const v = engine.state.status === "running" ? engine.state.player.speed : 0;
    const len = Math.hypot(FALL, v) * 0.03; // ~30 ms of motion blur
    drops.forEach((d, i) => {
      d.y -= FALL * dt;
      d.z += v * dt;
      if (d.y < 0 || d.z > 20) [d.x, d.y, d.z] = [(r() - 0.5) * 34, RAIN_TOP * (0.6 + r() * 0.4), -150 + r() * 150];
      tmp.position.set(d.x, d.y, d.z);
      tmp.rotation.set(Math.atan2(FALL, v), 0, 0); // long axis along the drop's velocity (0, -FALL, v)
      tmp.scale.set(1, 1, len);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[DROP, RAIN_MAT, RAIN_N]} frustumCulled={false} />;
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

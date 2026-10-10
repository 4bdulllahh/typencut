"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { IcosahedronGeometry, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, type InstancedMesh, type Mesh } from "three";
import { MODELS } from "@/game/config";
import { useEngine } from "./context";

const { length: L, width: W } = MODELS.gt3rs;
const REAR_AXLE = L / 2 - Math.max(0.75, L * 0.17); // matches the wheel placement in Vehicles.tsx
const TRACK = W / 2 - 0.12;

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

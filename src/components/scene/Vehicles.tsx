"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending, BoxGeometry, ConeGeometry, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry,
  type Group, type Material, type Mesh,
} from "three";
import { MODELS, laneX } from "@/game/config";
import type { CarModel, Npc } from "@/game/types";
import { useEngine, useNight } from "./context";
import { glowTexture } from "./textures";

const flat = (color: string, roughness = 0.5) => new MeshStandardMaterial({ color, flatShading: true, roughness });
const glow = (color: string, opacity: number) =>
  new MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });
const M = {
  white: flat("#f4f3ee", 0.4),
  black: flat("#1b1d22", 0.35),
  red: flat("#c8323a", 0.35),
  carbon: flat("#2a2c31", 0.85),
  glass: flat("#56677d", 0.15),
  tyre: flat("#141517", 0.9),
  trim: flat("#0d0e10", 0.7),
  steel: flat("#9097a0", 0.3),
  scuff: flat("#7d7a74", 1),
  dent: flat("#bdb9b0", 0.8),
  lamp: new MeshBasicMaterial({ color: "#fff6dc" }),
  amber: new MeshBasicMaterial({ color: "#ffb020" }),
  tailDay: flat("#8a1820", 0.4),
  tailNight: new MeshBasicMaterial({ color: "#ff3344" }),
  beam: glow("#fff0c8", 0.38),
  trail: glow("#ff2236", 0.8),
  flame: new MeshBasicMaterial({ color: "#ff6a1a", transparent: true, opacity: 0.85, depthWrite: false }),
  flameCore: new MeshBasicMaterial({ color: "#fff1b0" }),
  flameGlow: glow("#ff8a2a", 0.7),
};
const BOX = new BoxGeometry(1, 1, 1);
const WHEEL = new CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2); // axis along x
const FLAT = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2); // lies on the ground, spans x/z
const CONE = new ConeGeometry(1, 1, 6).translate(0, 0.5, 0).rotateX(Math.PI / 2); // base at origin, tip towards +z

type V3 = [number, number, number];
const Box = ({ m, s, p, r, shadow = true }: { m: Material; s: V3; p: V3; r?: V3; shadow?: boolean }) => (
  <mesh geometry={BOX} material={m} scale={s} position={p} rotation={r} castShadow={shadow} />
);

/** Body heights (m), cabin span as a fraction of length from the nose, wheel radius. */
interface Style { h: number; ride: number; cabin: [number, number]; roof: number; inset: number; wheel: number; bed?: boolean }
const STYLE: Record<CarModel, Style> = {
  gt3rs: { h: 0.74, ride: 0.12, cabin: [0.37, 0.78], roof: 1.27, inset: 0.25, wheel: 0.34 },
  yaris: { h: 0.86, ride: 0.16, cabin: [0.3, 0.94], roof: 1.5, inset: 0.16, wheel: 0.3 },
  civic: { h: 0.8, ride: 0.15, cabin: [0.33, 0.82], roof: 1.42, inset: 0.18, wheel: 0.32 },
  malibu: { h: 0.82, ride: 0.15, cabin: [0.32, 0.79], roof: 1.46, inset: 0.18, wheel: 0.33 },
  rogue: { h: 0.98, ride: 0.2, cabin: [0.28, 0.93], roof: 1.7, inset: 0.15, wheel: 0.37 },
  f150: { h: 1.18, ride: 0.28, cabin: [0.27, 0.6], roof: 1.95, inset: 0.12, wheel: 0.43, bed: true },
  m3: { h: 0.78, ride: 0.13, cabin: [0.35, 0.8], roof: 1.42, inset: 0.2, wheel: 0.34 },
  c63: { h: 0.79, ride: 0.13, cabin: [0.35, 0.79], roof: 1.44, inset: 0.19, wheel: 0.34 },
  a5: { h: 0.76, ride: 0.13, cabin: [0.38, 0.8], roof: 1.37, inset: 0.21, wheel: 0.34 },
};

/** Low-poly shell shared by every model. Origin at ground centre, nose towards −z. */
function Body({ model, paint, top = paint, tails = true }: { model: CarModel; paint: Material; top?: Material; tails?: boolean }) {
  const night = useNight();
  const { length: L, width: W } = MODELS[model];
  const { h, ride, cabin: [c0, c1], roof, inset, wheel, bed } = STYLE[model];
  const nose = -L / 2;
  const cl = (c1 - c0) * L;
  const cz = nose + c0 * L + cl / 2;
  const cw = W - 2 * inset;
  const wz = L / 2 - Math.max(0.75, L * 0.17);
  return (
    <>
      <Box m={paint} s={[W, h - ride, L]} p={[0, (h + ride) / 2, 0]} />
      <Box m={M.glass} s={[cw, roof - h, cl]} p={[0, (h + roof) / 2, cz]} />
      <Box m={top} s={[cw + 0.02, 0.05, cl * 0.6]} p={[0, roof + 0.02, cz + cl * 0.06]} />
      {bed && <Box m={M.trim} s={[W - 0.26, 0.04, (1 - c1) * L - 0.3]} p={[0, h + 0.005, (nose + c1 * L + L / 2) / 2]} shadow={false} />}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={WHEEL} material={M.tyre} scale={[0.26, wheel, wheel]} position={[sx * (W / 2 - 0.12), wheel, sz * wz]} />
        )),
      )}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Box m={M.lamp} s={[0.38, 0.1, 0.16]} p={[sx * (W / 2 - 0.3), h - 0.03, nose + 0.07]} shadow={false} />
          {tails && <Box m={night ? M.tailNight : M.tailDay} s={[0.4, 0.1, 0.14]} p={[sx * (W / 2 - 0.28), h - 0.03, L / 2 - 0.06]} shadow={false} />}
        </group>
      ))}
    </>
  );
}

const BEAM = 14;

/** Ground beam ahead and a red streak behind; `setTrail` stretches the streak with speed. */
function NightLights({ model, trail }: { model: CarModel; trail: React.Ref<Mesh> }) {
  const { length: L, width: W } = MODELS[model];
  return (
    <>
      <mesh geometry={FLAT} material={M.beam} scale={[W * 1.7, 1, BEAM]} position={[0, 0.06, -L / 2 - BEAM * 0.4]} />
      <mesh ref={trail} geometry={FLAT} material={M.trail} position={[0, STYLE[model].h - 0.05, 0]} />
    </>
  );
}

function setTrail(m: Mesh | null, model: CarModel, speed: number) {
  if (!m) return;
  const { length: L, width: W } = MODELS[model];
  const len = 1.5 + speed * 0.12;
  m.scale.set(W - 0.2, 1, len);
  m.position.z = L / 2 + len * 0.4;
}

const GT3 = MODELS.gt3rs;
const GT3_H = STYLE.gt3rs.h;

export function PlayerCar() {
  const engine = useEngine();
  const night = useNight();
  const root = useRef<Group>(null);
  const scuffs = useRef<Group>(null);
  const dents = useRef<Group>(null);
  const flames = useRef<Group>(null);
  const trail = useRef<Mesh>(null);
  const led = useMemo(() => new MeshBasicMaterial(), []);
  const target = useMemo(() => new Object3D(), []);
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
    setTrail(trail.current, "gt3rs", p.speed);
  });
  const { length: L, width: W } = GT3;
  const h = GT3_H;
  const wz = L / 2 - Math.max(0.75, L * 0.17);
  return (
    <group ref={root}>
      <Body model="gt3rs" paint={M.white} top={M.carbon} tails={false} />
      {/* carbon hood, fender louvers over the front wheels */}
      <Box m={M.carbon} s={[W - 0.62, 0.02, STYLE.gt3rs.cabin[0] * L - 0.4]} p={[0, h + 0.01, -L / 2 + 0.25 + (STYLE.gt3rs.cabin[0] * L - 0.4) / 2]} shadow={false} />
      {[-1, 1].flatMap((sx) =>
        [0, 1, 2, 3].map((i) => (
          <Box key={`${sx}${i}`} m={M.trim} s={[0.32, 0.02, 0.06]} p={[sx * (W / 2 - 0.22), h + 0.012, -wz + (i - 1.5) * 0.13]} shadow={false} />
        )),
      )}
      {/* swan-neck wing: posts, plank, end plates */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Box m={M.carbon} s={[0.05, 0.5, 0.14]} p={[sx * 0.34, h + 0.25, L / 2 - 0.32]} />
          <Box m={M.carbon} s={[0.04, 0.22, 0.52]} p={[sx * (W / 2 - 0.04), h + 0.46, L / 2 - 0.24]} />
        </group>
      ))}
      <Box m={M.carbon} s={[W - 0.06, 0.05, 0.46]} p={[0, h + 0.52, L / 2 - 0.24]} />
      {/* full-width LED strip (brake light) and dual centre exhausts */}
      <Box m={led} s={[W - 0.14, 0.06, 0.12]} p={[0, h - 0.01, L / 2 - 0.05]} shadow={false} />
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={WHEEL} material={M.steel} scale={[0.22, 0.065, 0.065]} rotation-y={Math.PI / 2} position={[sx * 0.1, 0.4, L / 2 + 0.02]} />
      ))}
      <group ref={flames} position={[0, 0.4, L / 2 + 0.05]} visible={false}>
        {[-1, 1].map((sx) => (
          <group key={sx} position-x={sx * 0.1}>
            <mesh geometry={CONE} material={M.flame} scale={[0.16, 0.16, 1.3]} />
            <mesh geometry={CONE} material={M.flameCore} scale={[0.07, 0.07, 0.6]} />
          </group>
        ))}
        <mesh geometry={FLAT} material={M.flameGlow} scale={[2.4, 1, 3.2]} position={[0, -0.35, 1.1]} />
      </group>
      <group ref={scuffs}>
        <Box m={M.scuff} s={[0.5, 0.02, 0.36]} p={[-(W / 2 - 0.3), h + 0.012, L / 2 - 0.55]} shadow={false} />
        <Box m={M.scuff} s={[0.42, 0.02, 0.3]} p={[W / 2 - 0.28, h + 0.012, -L / 2 + 0.45]} shadow={false} />
        <Box m={M.scuff} s={[0.02, 0.2, 0.9]} p={[-W / 2 - 0.006, h - 0.25, 0.3]} shadow={false} />
      </group>
      <group ref={dents}>
        <Box m={M.dent} s={[0.62, 0.22, 0.5]} p={[-(W / 2 - 0.26), h - 0.04, -L / 2 + 0.2]} r={[0.35, 0.3, 0.1]} />
        <Box m={M.carbon} s={[1, 0.03, 0.62]} p={[-0.18, h + 0.09, -L / 2 + 0.85]} r={[0.25, 0.2, 0.06]} />
        <Box m={M.trim} s={[0.9, 0.08, 0.1]} p={[0.35, 0.2, -L / 2 - 0.06]} r={[0, 0.15, 0.25]} />
        <Box m={M.dent} s={[0.03, 0.24, 1.1]} p={[W / 2 + 0.01, h - 0.3, 0.6]} r={[0, 0.06, 0.12]} />
      </group>
      {night && (
        <>
          <NightLights model="gt3rs" trail={trail} />
          <primitive object={target} position={[0, 0, -30]} />
          <spotLight target={target} position={[0, 1.2, -L / 2]} color="#fff1d0" intensity={600} angle={0.42} penumbra={0.7} decay={2} />
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
  const trail = useRef<Mesh>(null);
  const npc = useRef<Npc | undefined>(undefined);
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
    setTrail(trail.current, n.model, n.speed);
  });
  if (!npc.current) return null;
  const { model, kind, length: L, width: W } = npc.current;
  const h = STYLE[model].h;
  const blinker = (side: -1 | 1, ref: React.Ref<Group>) => (
    <group ref={ref} visible={false}>
      {[-1, 1].map((e) => (
        <Box key={e} m={M.amber} s={[0.36, 0.14, 0.34]} p={[side * (W / 2 - 0.12), h + 0.02, e * (L / 2 - 0.14)]} shadow={false} />
      ))}
    </group>
  );
  return (
    <group ref={root}>
      <Body model={model} paint={kind === "merger" ? M.red : M.black} />
      {blinker(-1, left)}
      {blinker(1, right)}
      {night && <NightLights model={model} trail={trail} />}
    </group>
  );
}

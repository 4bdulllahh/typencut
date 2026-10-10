"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Vector3, type PerspectiveCamera } from "three";
import { LANE_W } from "@/game/config";
import type { GameEngine } from "@/game/engine";
import type { Settings } from "@/game/settings";
import { EngineCtx, NightCtx, useEngine } from "./context";
import { SkidMarks, Smoke } from "./Fx";
import { NpcCar, PlayerCar } from "./Vehicles";
import { World } from "./World";

/** Renders `engine.state` every frame. Never writes to it. */
export function Scene({ engine, night, quality, reduceMotion }: { engine: GameEngine; night: boolean; quality: Settings["quality"]; reduceMotion: boolean }) {
  const tag = useRef<HTMLDivElement>(null);
  const high = quality === "high";
  return (
    <div className="absolute inset-0">
      {/* Remounted on a quality change: shadow maps can't be switched on a live renderer. */}
      <Canvas key={quality} shadows={high} flat dpr={high ? [1, 2] : 1} camera={{ fov: FOV, near: 1, far: 400, position: [0, CAM_H, CAM_BACK] }}>
        <EngineCtx.Provider value={engine}>
          <NightCtx.Provider value={night}>
            <Atmosphere night={night} />
            <CameraRig still={reduceMotion} />
            <World />
            <SkidMarks />
            <PlayerCar />
            <Smoke />
            <Traffic />
            <WordTag el={tag} />
          </NightCtx.Provider>
        </EngineCtx.Provider>
      </Canvas>
      <div
        ref={tag}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full bg-white/85 px-2.5 py-0.5 text-sm font-semibold text-stone-800 shadow-md dark:bg-slate-900/85 dark:text-slate-100"
      />
    </div>
  );
}

const SKY = { day: "#f2d5bd", night: "#0a0f22" };

// Physical light units: diffuse ≈ albedo × intensity / π, so day lights sum to ~π.
function Atmosphere({ night }: { night: boolean }) {
  const sky = night ? SKY.night : SKY.day;
  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 105, 175]} />
      <hemisphereLight key={`h${night}`} args={night ? ["#3a4d86", "#07080f", 0.8] : ["#fff2e0", "#b4bc98", 1.7]} />
      <directionalLight
        position={night ? [25, 60, -10] : [-30, 60, 25]}
        color={night ? "#9db0ff" : "#ffe6c4"}
        intensity={night ? 0.7 : 2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={200}
      />
    </>
  );
}

// Camera: high above and a little behind the player, ~20° off straight down.
const CAM_H = 90;
const CAM_BACK = 10;
const LOOK_AHEAD = CAM_H * Math.tan((20 * Math.PI) / 180) - CAM_BACK;
const FOV = 42;
const NITRO_FOV = 8;

/** `still` (reduce motion) drops the shake and the nitro zoom. */
function CameraRig({ still }: { still: boolean }) {
  const engine = useEngine();
  const shake = useRef(0);
  const boost = useRef(0);
  useEffect(
    () =>
      engine.on((e) => {
        const kick = e.type === "collision" ? 1.4 : e.type === "nitro" ? 0.6 : e.type === "overtake" && e.grade === "cleanCut" ? 0.7 : 0;
        shake.current = Math.max(shake.current, kick);
      }),
    [engine],
  );
  useFrame(({ camera }, dt) => {
    const p = engine.state.player;
    const cam = camera as PerspectiveCamera;
    boost.current += ((p.nitroT > 0 && !still ? 1 : 0) - boost.current) * Math.min(1, dt * 5);
    shake.current = still ? 0 : Math.max(0, shake.current - dt * 2.2);
    const a = shake.current + boost.current * 0.12;
    const j = () => (Math.random() - 0.5) * a;
    const x = p.x * 0.35;
    cam.position.set(x + j(), CAM_H + j(), CAM_BACK + j());
    cam.lookAt(x, 0, -LOOK_AHEAD);
    const fov = FOV + boost.current * NITRO_FOV;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/** Re-renders only when the set of cars changes; positions update in useFrame. */
function Traffic() {
  const engine = useEngine();
  const [ids, setIds] = useState<number[]>([]);
  useFrame(() => {
    const now = engine.state.npcs.map((n) => n.id);
    if (now.length !== ids.length || now.some((id, i) => id !== ids[i])) setIds(now);
  });
  useEffect(() => engine.on((e) => e.type === "restart" && setIds([])), [engine]);
  return ids.map((id) => <NpcCar key={id} id={id} />);
}

/** The target word floats over the next car in the player's lane (or the open road ahead); `el` is a DOM tag beside the canvas. */
function WordTag({ el }: { el: React.RefObject<HTMLDivElement | null> }) {
  const engine = useEngine();
  const pos = useMemo(() => new Vector3(0, 3, -35), []);
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }, dt) => {
    const tag = el.current;
    if (!tag) return;
    const { player: p, npcs, word, status } = engine.state;
    let gap = 90;
    let x = p.x;
    for (const n of npcs) {
      const d = n.s - p.s;
      if (d > 4 && d < gap && Math.abs(n.x - p.x) < LANE_W / 2) [gap, x] = [d, n.x];
    }
    if (gap === 90) gap = 35;
    const k = Math.min(1, dt * 10);
    pos.x += (x - pos.x) * k;
    pos.z += (-gap - pos.z) * k;
    v.copy(pos).project(camera);
    tag.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -50%)`;
    tag.style.visibility = status === "over" ? "hidden" : "visible";
    if (tag.textContent !== word) tag.textContent = word;
  });
  return null;
}

"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { PerspectiveCamera } from "three";
import type { GameEngine } from "@/game/engine";
import { EngineCtx, NightCtx, useEngine } from "./context";
import { NpcCar, PlayerCar } from "./Vehicles";
import { World } from "./World";

/** Renders `engine.state` every frame. Never writes to it. */
export function Scene({ engine, night }: { engine: GameEngine; night: boolean }) {
  return (
    <Canvas shadows flat dpr={[1, 2]} camera={{ fov: FOV, near: 1, far: 400, position: [0, CAM_H, CAM_BACK] }}>
      <EngineCtx.Provider value={engine}>
        <NightCtx.Provider value={night}>
          <Atmosphere night={night} />
          <CameraRig />
          <World />
          <PlayerCar />
          <Traffic />
        </NightCtx.Provider>
      </EngineCtx.Provider>
    </Canvas>
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

function CameraRig() {
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
    boost.current += ((p.nitroT > 0 ? 1 : 0) - boost.current) * Math.min(1, dt * 5);
    shake.current = Math.max(0, shake.current - dt * 2.2);
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

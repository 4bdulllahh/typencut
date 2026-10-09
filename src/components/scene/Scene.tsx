"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import { LANES, LANE_W, PLAYER_DIMS, laneX } from "@/game/config";
import type { GameEngine } from "@/game/engine";
import type { Npc } from "@/game/types";

const EngineCtx = createContext<GameEngine>(null!);
const useEngine = () => useContext(EngineCtx);

/** Renders `engine.state` every frame. Never writes to it. */
export function Scene({ engine }: { engine: GameEngine }) {
  return (
    <Canvas flat dpr={[1, 2]} camera={{ fov: 42, near: 1, far: 400, position: [0, 90, 10] }}>
      <EngineCtx.Provider value={engine}>
        <color attach="background" args={["#f2dcc8"]} />
        <hemisphereLight args={["#fff3e3", "#a8b59a", 0.8]} />
        <directionalLight position={[-40, 70, 20]} intensity={1} />
        <CameraRig />
        <Road />
        <Player />
        <Traffic />
      </EngineCtx.Provider>
    </Canvas>
  );
}

function CameraRig() {
  const engine = useEngine();
  useFrame(({ camera }) => {
    const x = engine.state.player.x * 0.35;
    camera.position.set(x, 90, 10);
    camera.lookAt(x, 0, -22.8); // ~20° off straight down
  });
  return null;
}

const DASH_PERIOD = 12;

function Road() {
  const engine = useEngine();
  const dashes = useRef<Group>(null);
  useFrame(() => {
    if (dashes.current) dashes.current.position.z = engine.state.player.s % DASH_PERIOD;
  });
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -60]}>
        <planeGeometry args={[LANES * LANE_W + 5.6, 260]} />
        <meshStandardMaterial color="#5b5f66" />
      </mesh>
      <group ref={dashes}>
        {Array.from({ length: 14 }, (_, i) =>
          Array.from({ length: LANES - 1 }, (_, l) => (
            <mesh key={`${i}-${l}`} rotation-x={-Math.PI / 2} position={[laneX(l) + LANE_W / 2, 0.02, 20 - i * DASH_PERIOD]}>
              <planeGeometry args={[0.15, 3]} />
              <meshBasicMaterial color="#f4f1ea" />
            </mesh>
          )),
        )}
      </group>
    </>
  );
}

function Player() {
  const engine = useEngine();
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    const p = engine.state.player;
    if (!ref.current) return;
    ref.current.position.x = p.x;
    ref.current.rotation.y = -p.vx * 0.04;
    ref.current.visible = p.invulnT === 0 || Math.floor(p.invulnT * 10) % 2 === 0;
  });
  return (
    <mesh ref={ref} position={[0, 0.6, 0]}>
      <boxGeometry args={[PLAYER_DIMS.width, 1.2, PLAYER_DIMS.length]} />
      <meshStandardMaterial color="#f5f5f2" flatShading />
    </mesh>
  );
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
  return ids.map((id) => <NpcBox key={id} id={id} />);
}

function NpcBox({ id }: { id: number }) {
  const engine = useEngine();
  const body = useRef<Mesh>(null);
  const signal = useRef<Mesh>(null);
  const npc = useRef<Npc | undefined>(undefined);
  npc.current ??= engine.state.npcs.find((n) => n.id === id);
  useFrame(({ clock }) => {
    const n = engine.state.npcs.find((o) => o.id === id);
    if (!n || !body.current || !signal.current) return;
    body.current.position.set(n.x, 0.65, -(n.s - engine.state.player.s));
    signal.current.visible = n.signal !== 0 && clock.elapsedTime % 0.5 < 0.25;
    signal.current.position.x = n.signal * (n.width / 2 + 0.1);
  });
  if (!npc.current) return null;
  const { width, length, kind } = npc.current;
  return (
    <mesh ref={body}>
      <boxGeometry args={[width, 1.3, length]} />
      <meshStandardMaterial color={kind === "merger" ? "#c8323a" : "#1b1d22"} flatShading />
      <mesh ref={signal} position={[0, 0.3, -length / 2]}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshBasicMaterial color="#ffb020" />
      </mesh>
    </mesh>
  );
}

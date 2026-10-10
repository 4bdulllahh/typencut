"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import {
  AdditiveBlending, BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, type Group,
} from "three";
import { LANES, LANE_W, laneX } from "@/game/config";
import { useEngine, useNight } from "./context";
import { glowTexture, signTexture } from "./textures";

// Road cross-section (m from centre)
const ROAD = (LANES * LANE_W) / 2; // 9
const SHOULDER = ROAD + 2.8;
const BARRIER = SHOULDER + 0.45;
const POLE = BARRIER + 1;
const NEAR = 25; // metres behind the player that must stay filled
const FAR = 140; // metres ahead

const flat = (color: string) => new MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 });
const M = {
  asphalt: flat("#676b73"),
  shoulder: flat("#7b7d80"),
  paint: new MeshBasicMaterial({ color: "#f3efe4" }),
  yellow: new MeshBasicMaterial({ color: "#e9c25a" }),
  concrete: flat("#d6d0c4"),
  grass: flat("#c2d199"),
  pine: flat("#5f8c5d"),
  leaf: flat("#86ab68"),
  trunk: flat("#8b6a4e"),
  metal: flat("#9aa0a6"),
  dark: flat("#2c3036"),
  lampOff: flat("#e8e4da"),
  lampOn: new MeshBasicMaterial({ color: "#ffe2a8" }),
  camera: flat("#e6c449"),
  pool: new MeshBasicMaterial({ map: glowTexture(), color: "#ffc978", transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }),
};
const G = {
  dash: new PlaneGeometry(0.16, 3),
  pine: new ConeGeometry(1.6, 4.2, 6),
  pineTop: new ConeGeometry(1.1, 2.8, 6),
  round: new IcosahedronGeometry(1.9, 0),
  trunk: new CylinderGeometry(0.22, 0.3, 1.6, 5),
  pool: new PlaneGeometry(14, 14),
};

/** Repeats its children every `period` metres along the road, relative to the player. */
function Repeat({ period, offset = 0, place, children }: {
  period: number;
  offset?: number; // road distance of the first copy
  place?: (g: Group, k: number) => void;
  children: React.ReactNode;
}) {
  const engine = useEngine();
  const count = Math.ceil((NEAR + FAR) / period) + 1;
  const slots = useRef<(Group | null)[]>([]);
  useFrame(() => {
    const s = engine.state.player.s - offset;
    const base = Math.floor((s - NEAR) / period);
    slots.current.forEach((g, i) => {
      if (!g) return;
      const k = base + i;
      g.position.z = -(k * period - s);
      place?.(g, k);
    });
  });
  return Array.from({ length: count }, (_, i) => (
    <group key={i} ref={(g) => void (slots.current[i] = g)}>
      {children}
    </group>
  ));
}

/** Cheap stable 0–1 hash of an integer, so a tree keeps its look while it scrolls. */
const hash = (k: number, salt = 0) => {
  const x = Math.sin(k * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function World() {
  return (
    <>
      <Ground />
      <Repeat period={12}>
        {Array.from({ length: LANES - 1 }, (_, l) => (
          <mesh key={l} geometry={G.dash} material={M.paint} rotation-x={-Math.PI / 2} position={[laneX(l) + LANE_W / 2, 0.02, 0]} />
        ))}
      </Repeat>
      <Repeat period={6} place={placeTrees}>
        <Tree />
        <Tree />
      </Repeat>
      <Repeat period={42}>
        <StreetLight side={-1} />
        <StreetLight side={1} />
      </Repeat>
      <Repeat period={520} offset={48}>
        <Gantry />
      </Repeat>
      <Repeat period={360} offset={35}>
        <SpeedCamera />
      </Repeat>
    </>
  );
}

const STRIP = 320; // length of the static strips; fog hides the ends
const strip = (x: number, w: number, y: number, mat: MeshStandardMaterial | MeshBasicMaterial, key: string) => (
  <mesh key={key} material={mat} rotation-x={-Math.PI / 2} position={[x, y, -STRIP / 2 + NEAR + 10]} receiveShadow>
    <planeGeometry args={[w, STRIP]} />
  </mesh>
);

function Ground() {
  return (
    <>
      {strip(0, 400, -0.02, M.grass, "grass")}
      {strip(0, ROAD * 2, 0, M.asphalt, "road")}
      {strip(-(ROAD + SHOULDER) / 2, SHOULDER - ROAD, 0, M.shoulder, "sl")}
      {strip((ROAD + SHOULDER) / 2, SHOULDER - ROAD, 0, M.shoulder, "sr")}
      {strip(-ROAD + 0.15, 0.18, 0.015, M.yellow, "el")}
      {strip(ROAD - 0.15, 0.18, 0.015, M.paint, "er")}
      {[-1, 1].map((side) => (
        // Jersey barrier: wide foot, narrow top
        <mesh key={side} material={M.concrete} position={[side * BARRIER, 0.42, -STRIP / 2 + NEAR + 10]} castShadow receiveShadow geometry={jersey()} />
      ))}
    </>
  );
}

let jerseyGeo: BoxGeometry | null = null;
function jersey() {
  if (!jerseyGeo) {
    jerseyGeo = new BoxGeometry(0.6, 0.84, STRIP);
    const pos = jerseyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setX(i, pos.getX(i) * 0.4);
    jerseyGeo.computeVertexNormals();
  }
  return jerseyGeo;
}

function Tree() {
  return (
    <group>
      <group name="pine">
        <mesh geometry={G.trunk} material={M.trunk} position-y={0.8} />
        <mesh geometry={G.pine} material={M.pine} position-y={3.4} castShadow />
        <mesh geometry={G.pineTop} material={M.pine} position-y={5.2} castShadow />
      </group>
      <group name="round">
        <mesh geometry={G.trunk} material={M.trunk} position-y={0.8} />
        <mesh geometry={G.round} material={M.leaf} position-y={2.9} castShadow />
      </group>
    </group>
  );
}

function placeTrees(slot: Group, k: number) {
  slot.children.forEach((tree, side) => {
    const h = hash(k, side);
    const sign = side ? 1 : -1;
    tree.visible = h > 0.3; // leave some gaps
    tree.position.set(sign * (POLE + 2.5 + hash(k, side + 7) * 16), 0, hash(k, side + 3) * 5);
    tree.scale.setScalar(0.9 + hash(k, side + 5) * 0.8);
    tree.rotation.y = h * 6.28;
    tree.children[0].visible = h < 0.6;
    tree.children[1].visible = h >= 0.6;
  });
}

function StreetLight({ side }: { side: -1 | 1 }) {
  const night = useNight();
  const armX = side * (ROAD + 0.6);
  return (
    <group>
      <mesh material={M.metal} position={[side * POLE, 4.5, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 9, 6]} />
      </mesh>
      <mesh material={M.metal} position={[(side * POLE + armX) / 2, 9, 0]}>
        <boxGeometry args={[Math.abs(side * POLE - armX), 0.14, 0.14]} />
      </mesh>
      <mesh material={night ? M.lampOn : M.lampOff} position={[armX, 8.85, 0]}>
        <boxGeometry args={[1.1, 0.25, 0.45]} />
      </mesh>
      {night && <mesh geometry={G.pool} material={M.pool} rotation-x={-Math.PI / 2} position={[armX, 0.04, 0]} />}
    </group>
  );
}

function Gantry() {
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} material={M.metal} position={[side * POLE, 3.9, 0]} castShadow>
          <boxGeometry args={[0.4, 7.8, 0.4]} />
        </mesh>
      ))}
      <mesh material={M.metal} position={[0, 7.6, 0]} castShadow>
        <boxGeometry args={[POLE * 2 + 0.4, 0.5, 0.6]} />
      </mesh>
      <Sign x={-laneX(3)} lines={["‹  ,  LEFT", "type the word"]} />
      <Sign x={laneX(3)} lines={["RIGHT  .  ›", "CAPS = NITRO"]} />
    </group>
  );
}

/** Tilted back toward the near-top-down camera so it reads from above. */
function Sign({ x, lines }: { x: number; lines: string[] }) {
  return (
    <group position={[x, 8.6, 0.3]} rotation-x={-1}>
      <mesh material={M.dark} castShadow>
        <boxGeometry args={[6.4, 2.8, 0.15]} />
      </mesh>
      <mesh position-z={0.08}>
        <planeGeometry args={[6.2, 2.7]} />
        <meshStandardMaterial map={signTexture(lines)} roughness={0.9} />
      </mesh>
    </group>
  );
}

function SpeedCamera() {
  const x = POLE + 0.3;
  return (
    <group position-x={x}>
      <mesh material={M.metal} position-y={2.4} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 4.8, 6]} />
      </mesh>
      <mesh material={M.camera} position={[-0.25, 4.9, 0]} castShadow>
        <boxGeometry args={[0.7, 0.8, 1]} />
      </mesh>
      <mesh material={M.dark} position={[-0.25, 4.9, -0.52]}>
        <boxGeometry args={[0.4, 0.4, 0.06]} />
      </mesh>
      <mesh position={[0, 2.6, 0.2]} rotation-x={-0.6}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial color="#2b5fb3" />
      </mesh>
    </group>
  );
}

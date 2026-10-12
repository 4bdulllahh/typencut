"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import {
  AdditiveBlending, BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, type Group,
} from "three";
import type { Weather } from "@/game/types";
import { LANES, LANE_W, SPEED_CAMERA, laneX } from "@/game/config";
import { useEngine, useNight, useWeather } from "./context";
import { glowTexture, limitSignTexture, signTexture } from "./textures";

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
  // Rain: darker and glossy, so the sun leaves a sheen and lights smear into reflections
  asphaltWet: new MeshStandardMaterial({ color: "#474b53", roughness: 0.28 }),
  shoulderWet: new MeshStandardMaterial({ color: "#595c61", roughness: 0.35 }),
  paint: new MeshBasicMaterial({ color: "#f3efe4" }),
  yellow: new MeshBasicMaterial({ color: "#e9c25a" }),
  concrete: flat("#d6d0c4"),
  // Ground per weather: the field, two shades of patch, and the tufts
  grass: flat("#c2d199"),
  patchDark: flat("#a9bf7f"),
  patchLight: flat("#d3dca6"),
  tuft: flat("#8fae62"),
  snow: flat("#eef1f4"),
  snowPatch: flat("#dde4ea"),
  snowGrass: flat("#c3cdb8"),
  snowShoulder: flat("#dfe3e7"),
  sand: flat("#d9c18f"),
  sandPatch: flat("#c9ab74"),
  dryGrass: flat("#b9b277"),
  // Animals
  rabbit: flat("#9a8068"),
  white: flat("#f1ede4"),
  deer: flat("#a2714a"),
  hoof: flat("#3a2c22"),
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
  patch: new CircleGeometry(1, 7).rotateX(-Math.PI / 2),
  blade: new ConeGeometry(0.12, 0.7, 3).translate(0, 0.35, 0),
  box: new BoxGeometry(1, 1, 1),
};

/** Field, patch (dark, light) and tuft materials for a weather: snow covers the grass, a sandstorm dries it out. */
const groundLook = (w: Weather) =>
  w === "snow" ? [M.snow, M.snowPatch, M.snowGrass, M.snowGrass] : w === "sandstorm" ? [M.sand, M.sandPatch, M.dryGrass, M.dryGrass] : [M.grass, M.patchDark, M.patchLight, M.tuft];

/** Repeats its children every `period` metres along the road, relative to the player. */
function Repeat({ period, offset = 0, place, children }: {
  period: number;
  offset?: number; // road distance of the first copy
  place?: (g: Group, k: number, t: number) => void; // t: seconds since the scene started, for animation
  children: React.ReactNode;
}) {
  const engine = useEngine();
  const count = Math.ceil((NEAR + FAR) / period) + 1;
  const slots = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    const s = engine.state.player.s - offset;
    const base = Math.floor((s - NEAR) / period);
    slots.current.forEach((g, i) => {
      if (!g) return;
      const k = base + i;
      g.position.z = -(k * period - s);
      place?.(g, k, clock.elapsedTime);
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

/** `signs`: the left and right gantry signs' lines, which teach the current controls. */
export function World({ signs }: { signs: [string[], string[]] }) {
  const weather = useWeather();
  const sway = weather === "wind" || weather === "sandstorm" ? 1 : 0;
  const [, dark, light, tuft] = groundLook(weather);
  return (
    <>
      <Ground />
      <Repeat period={12}>
        {Array.from({ length: LANES - 1 }, (_, l) => (
          <mesh key={l} geometry={G.dash} material={M.paint} rotation-x={-Math.PI / 2} position={[laneX(l) + LANE_W / 2, 0.02, 0]} />
        ))}
      </Repeat>
      <Repeat period={9} place={placePatches}>
        {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} geometry={G.patch} material={i % 3 === 1 ? light : dark} receiveShadow />)}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <group key={`t${i}`}>
            {[0, 1, 2, 3, 4].map((b) => (
              <mesh key={b} geometry={G.blade} material={tuft} position={[Math.cos(b * 1.3) * 0.3, 0, Math.sin(b * 2.1) * 0.3]} rotation={[0.25 * Math.sin(b), 0, 0.3 * Math.cos(b * 1.7)]} />
            ))}
          </group>
        ))}
      </Repeat>
      <Repeat period={26} offset={11} place={placeAnimals}>
        <Rabbit />
        <Rabbit />
        <Deer />
      </Repeat>
      <Repeat period={6} place={(g, k, t) => placeTrees(g, k, t, sway)}>
        <Tree />
        <Tree />
      </Repeat>
      <Repeat period={42}>
        <StreetLight side={-1} />
        <StreetLight side={1} />
      </Repeat>
      <Repeat period={520} offset={48}>
        <Gantry signs={signs} />
      </Repeat>
      <Repeat period={SPEED_CAMERA.period} offset={SPEED_CAMERA.offset}>
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
  const weather = useWeather();
  const wet = weather === "rain";
  const [road, shoulder] = wet ? [M.asphaltWet, M.shoulderWet] : [M.asphalt, weather === "snow" ? M.snowShoulder : M.shoulder];
  return (
    <>
      {strip(0, 400, -0.02, groundLook(weather)[0], "grass")}
      {strip(0, ROAD * 2, 0, road, "road")}
      {strip(-(ROAD + SHOULDER) / 2, SHOULDER - ROAD, 0, shoulder, "sl")}
      {strip((ROAD + SHOULDER) / 2, SHOULDER - ROAD, 0, shoulder, "sr")}
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

/** Six patches then eight tufts per slot, scattered over both verges (never the road), each laid out by its own hash. */
function placePatches(slot: Group, k: number) {
  slot.children.forEach((m, i) => {
    const h = (n: number) => hash(k * 17 + i, n);
    const tuft = i >= 6;
    const side = i % 2 ? 1 : -1;
    m.visible = h(1) > 0.15;
    m.position.set(side * (BARRIER + 1.2 + h(2) * (tuft ? 20 : 24)), tuft ? 0 : -0.012 + i * 0.001, h(3) * 9);
    if (tuft) m.scale.setScalar(0.8 + h(4) * 0.9);
    else m.scale.set(2 + h(4) * 4, 1, 1.5 + h(5) * 5);
    m.rotation.y = h(6) * 6.28;
  });
}

/** Rabbits hop about and deer graze, each slot showing some of them on a random verge. */
function placeAnimals(slot: Group, k: number, t: number) {
  slot.children.forEach((a, i) => {
    const h = (n: number) => hash(k * 7 + i, n + 20);
    const deer = i === 2;
    const side = h(1) < 0.5 ? -1 : 1;
    a.visible = h(2) < (deer ? 0.45 : 0.55);
    if (!a.visible) return;
    const x = side * (POLE + 2.5 + h(3) * (deer ? 12 : 9));
    a.scale.setScalar(deer ? 1.5 : 2); // bigger than life so they read from 90 m up
    if (deer) {
      a.position.set(x, 0, h(4) * 20);
      a.rotation.y = h(5) * 6.28;
      a.children[1].rotation.x = Math.sin(t * 0.8 + k) > 0.2 ? 0.9 : 0; // the neck: down to graze, up to look around
    } else {
      // A hop every 1.4 s: up and along its heading, then a pause; it turns a little between hops.
      const phase = (t / 1.4 + h(6)) % 1;
      const hop = phase < 0.3 ? Math.sin((phase / 0.3) * Math.PI) : 0;
      const heading = h(5) * 6.28 + Math.floor(t / 1.4 + h(6)) * 0.6;
      a.rotation.y = heading;
      a.position.set(x - Math.sin(heading) * hop * 0.8, hop * 0.7, h(4) * 24 - Math.cos(heading) * hop * 0.8);
    }
  });
}

type V3 = [number, number, number];
const part = (m: MeshStandardMaterial, s: V3, p: V3, r: V3 = [0, 0, 0]) => <mesh geometry={G.box} material={m} scale={s} position={p} rotation={r} castShadow />;

/** Low-poly rabbit. Faces -z. */
function Rabbit() {
  return (
    <group>
      {part(M.rabbit, [0.32, 0.3, 0.5], [0, 0.22, 0])}
      {part(M.rabbit, [0.24, 0.24, 0.26], [0, 0.4, -0.3])}
      {part(M.rabbit, [0.06, 0.3, 0.1], [-0.07, 0.62, -0.26], [0.25, 0, 0])}
      {part(M.rabbit, [0.06, 0.3, 0.1], [0.07, 0.62, -0.26], [0.25, 0, 0])}
      {part(M.white, [0.12, 0.12, 0.1], [0, 0.3, 0.28])}
    </group>
  );
}

/** Low-poly deer: body and legs (child 0), then the neck group (child 1, tipped down to graze) with head and antlers. Faces -z. */
function Deer() {
  return (
    <group>
      <group>
        {part(M.deer, [0.5, 0.55, 1.4], [0, 1.15, 0])}
        {part(M.white, [0.18, 0.2, 0.06], [0, 1.25, 0.72])}
        {[-1, 1].flatMap((sx) =>
          [-0.55, 0.55].map((z) => (
            <group key={`${sx}${z}`}>
              {part(M.deer, [0.1, 0.85, 0.12], [sx * 0.17, 0.45, z])}
              {part(M.hoof, [0.11, 0.08, 0.13], [sx * 0.17, 0.04, z])}
            </group>
          )),
        )}
      </group>
      <group position={[0, 1.3, -0.62]}>
        {part(M.deer, [0.22, 0.75, 0.24], [0, 0.32, -0.08], [-0.35, 0, 0])}
        {part(M.deer, [0.26, 0.26, 0.48], [0, 0.72, -0.3])}
        {part(M.white, [0.32, 0.12, 0.06], [0, 0.88, -0.14])}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            {part(M.hoof, [0.04, 0.4, 0.04], [sx * 0.12, 1.02, -0.18], [0, 0, sx * 0.35])}
            {part(M.hoof, [0.04, 0.2, 0.04], [sx * 0.2, 1.14, -0.26], [0.6, 0, sx * 0.2])}
          </group>
        ))}
      </group>
    </group>
  );
}

/** `sway` (0 or 1): wind and sandstorms rock the trees. */
function placeTrees(slot: Group, k: number, t: number, sway: number) {
  slot.children.forEach((tree, side) => {
    const h = hash(k, side);
    const sign = side ? 1 : -1;
    tree.visible = h > 0.3; // leave some gaps
    tree.position.set(sign * (POLE + 2.5 + hash(k, side + 7) * 16), 0, hash(k, side + 3) * 5);
    tree.scale.setScalar(0.9 + hash(k, side + 5) * 0.8);
    tree.rotation.y = h * 6.28;
    tree.rotation.z = sway * Math.sin(t * 2.4 + k) * 0.07;
    tree.children[0].visible = h < 0.6;
    tree.children[1].visible = h >= 0.6;
  });
}

function StreetLight({ side }: { side: -1 | 1 }) {
  const night = useNight();
  const wet = useWeather() === "rain";
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
      {/* on a wet road the pool becomes a long reflection streaking toward the viewer */}
      {night && <mesh geometry={G.pool} material={M.pool} rotation-x={-Math.PI / 2} position={[armX, 0.04, wet ? 6 : 0]} scale={wet ? [0.45, 2.4, 1] : 1} />}
    </group>
  );
}

function Gantry({ signs }: { signs: [string[], string[]] }) {
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
      <Sign x={-laneX(3)} lines={signs[0]} />
      <Sign x={laneX(3)} lines={signs[1]} />
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
      {/* The speed-trap limit, tilted back to read from above (and unlit, so it shows at night). */}
      <mesh position={[-1, 3.8, 0.6]} rotation-x={-1}>
        <circleGeometry args={[1.6, 24]} />
        <meshBasicMaterial map={limitSignTexture(SPEED_CAMERA.mph)} transparent />
      </mesh>
    </group>
  );
}

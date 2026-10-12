import type { CarModel, Mode, NpcKind } from "./types.ts";

export const LANES = 5;
export const LANE_W = 3.6;
/** Lane 0 is the far left (fast) lane. */
export const laneX = (lane: number) => (lane - (LANES - 1) / 2) * LANE_W;

export const MPH = 0.44704; // m/s in one mph
export const toMph = (ms: number) => ms / MPH;

export const START_LIVES = 3;
export const NITRO_TIME = 1;
export const NITRO_COOLDOWN = 3.5; // s from one nitro firing until the next is allowed
export const BRAKE_TIME = 1;
export const INVULN_TIME = 2;
export const CRUISE_MPH = [100, 140] as const; // player cruise at progress 0 → 1
export const NITRO_MPH = 180;
export const BOOST_TIME = 0.8; // Enter-submitted word: a short surge above cruise
export const BOOST_MPH = 12;
export const SURPRISE_CUT_CHANCE = 0.12;
export const CLEAN_CUT_GAP = 12; // m between bumpers when the player switches out
export const MAX_MULTIPLIER = 5;
export const COMBO_TIME = 6; // s a pass keeps the multiplier alive; after that it drains one step a second
export const DRAFT_RANGE = 16; // m behind a car (bumper to bumper) where the slipstream meter fills
/** Roadside speed cameras: one every `period` m from `offset`; passing one at `mph`+ is a speed trap. */
export const SPEED_CAMERA = { period: 360, offset: 35, mph: 150 } as const;
export const MULTIPLIER_STEP = 0.2;
export const POINTS = { standard: 50, dangerous: 100, cleanCut: 500 } as const;
export const MODES: Mode[] = ["classic", "zen", "rush", "timeAttack", "daily"];
export const HEART = { every: 8, chance: 0.2 } as const; // every 8 s of running time, a 20% chance of a heart (never in zen)
export const TIME_ATTACK_S = 90;
export const RUSH_GAP = 0.55; // rush hour: lane gaps shrink to this fraction

/** Upshift points (mph) of a simulated 7-speed gearbox; cruising sits mid-band, nitro climbs a gear or two. */
const GEARS = [0, 40, 62, 85, 108, 132, 158, 200];

/** Gear (1–7) and revs (0.35 → 1 across each gear) for a speed: the engine note, and the driving controls' pull. */
export function revs(mph: number) {
  let g = 0;
  while (g < GEARS.length - 2 && mph >= GEARS[g + 1]) g++;
  const frac = Math.min(1, Math.max(0, (mph - GEARS[g]) / (GEARS[g + 1] - GEARS[g])));
  return { gear: g + 1, rpm: 0.35 + 0.65 * frac };
}

/**
 * Driving controls (any mode): the player holds the throttle and brake instead of cruising. Arcade handling: lane
 * changes take the same time at any speed and cost no speed.
 * `pull` is the throttle's acceleration in each gear (m/s²), `shift` the pause on each upshift (s).
 */
export const DRIVING = {
  minMph: 45, topMph: 170, startMph: 60,
  pull: [13, 12, 11, 10, 9, 8, 7], shift: 0.15, // arcade: 60 → 170 mph in about 7 s
  coast: 2, // m/s² engine braking with no pedal, down to minMph
  brake: 32, // m/s² holding the brake: top speed to the minimum in under 2 s
  repeat: 0.25, // s between lane changes while a steering key is held
} as const;

export const PLAYER_DIMS = { length: 4.57, width: 1.9 };

/** Real-world footprints (m), so the hitboxes match the meshes. */
export const MODELS: Record<CarModel, { length: number; width: number; kind: NpcKind | "player" }> = {
  // Player cars are looks only: every one uses PLAYER_DIMS for its hitbox.
  gr86: { length: 4.27, width: 1.78, kind: "player" },
  typer: { length: 4.59, width: 1.89, kind: "player" },
  m4: { length: 4.79, width: 1.89, kind: "player" },
  gtr: { length: 4.71, width: 1.9, kind: "player" },
  c8: { length: 4.63, width: 1.93, kind: "player" },
  turbos: { length: 4.54, width: 1.9, kind: "player" },
  gt3rs: { length: 4.57, width: 1.9, kind: "player" },
  p1: { length: 4.59, width: 1.95, kind: "player" },
  jesko: { length: 4.61, width: 2.03, kind: "player" },
  chiron: { length: 4.54, width: 2.04, kind: "player" },
  yaris: { length: 3.95, width: 1.7, kind: "cruiser" },
  civic: { length: 4.67, width: 1.8, kind: "cruiser" },
  malibu: { length: 4.92, width: 1.85, kind: "cruiser" },
  rogue: { length: 4.65, width: 1.84, kind: "cruiser" },
  f150: { length: 5.89, width: 2.03, kind: "cruiser" },
  m3: { length: 4.67, width: 1.88, kind: "merger" },
  c63: { length: 4.73, width: 1.8, kind: "merger" },
  a5: { length: 4.63, width: 1.85, kind: "merger" },
};

export const CRUISERS: CarModel[] = ["yaris", "civic", "malibu", "rogue", "f150"];
export const MERGERS: CarModel[] = ["m3", "c63", "a5"];

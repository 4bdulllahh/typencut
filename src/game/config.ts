import type { CarModel, Mode, NpcKind } from "./types.ts";

export const LANES = 5;
export const LANE_W = 3.6;
/** Lane 0 is the far left (fast) lane. */
export const laneX = (lane: number) => (lane - (LANES - 1) / 2) * LANE_W;

export const MPH = 0.44704; // m/s in one mph
export const toMph = (ms: number) => ms / MPH;

export const START_LIVES = 3;
export const NITRO_TIME = 1;
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
export const MODES: Mode[] = ["classic", "drive", "zen", "rush", "timeAttack", "daily"];
export const HEART_CHANCE = 0.065; // share of lane spawns that are a heart instead of a car (never in zen)
export const TIME_ATTACK_S = 90;
export const RUSH_GAP = 0.55; // rush hour: lane gaps shrink to this fraction

export const PLAYER_DIMS = { length: 4.57, width: 1.9 };

/** Real-world footprints (m), so the hitboxes match the meshes. */
export const MODELS: Record<CarModel, { length: number; width: number; kind: NpcKind | "player" }> = {
  gt3rs: { length: 4.57, width: 1.9, kind: "player" },
  turbos: { length: 4.54, width: 1.9, kind: "player" }, // unlockable looks; every player car uses PLAYER_DIMS for its hitbox
  m4: { length: 4.79, width: 1.89, kind: "player" },
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

# Typencut: handover (compact)

_Updated 2026-10-10 · M1 + M2 pushed (`5fe3183`), M3 done + uncommitted · repo `C:\Users\Computer\Documents\GitHub\typencut`, remote https://github.com/4bdulllahh/typencut · full brief in `docs/spec.md`._

## Resume here
- **M1, M2** are on `origin/main` (push works again).
- **M3** finished and verified (tsc + build clean, 11 tests pass, day/night headless shots with no console errors) but **uncommitted**: new `src/components/scene/Vehicles.tsx`; `Scene.tsx` now renders `PlayerCar`/`NpcCar` instead of boxes; this file.

**First thing next session:**
1. `git status` to confirm M3 is still uncommitted, then ask the owner: "Commit M3 and start M4?"
2. On yes: commit M3 (`feat: M3 vehicles — …`), `git push origin main`, start **M4**.

M4 notes: nitro exhaust flames at the GT3's dual exhausts (car space `x = ±0.1, y = 0.4, z = L/2`; add them inside `PlayerCar`'s root group so they follow `p.x` and yaw), skid marks on lane changes (world-space, scroll with `-(s - player.s)` like `Repeat`), engine smoke when `lives < 3`, Web Audio synth in `src/game/audio.ts` driven by `engine.on` events (key click, blow-off on nitro, screech on lane change, horn, thud on collision).

## Working with the owner
- Build in milestones; stop after each and ask to continue. On approval, commit the finished milestone and push to `origin/main` (commit messages end with a `Co-Authored-By` line). Keep README and this file current, and keep this file short.
- Update **Resume here** and the milestone table as the last step of every milestone (and mid-milestone if tokens run low).

## Milestones
| # | Scope | Status |
| --- | --- | --- |
| M1 | Foundation: Next 16 scaffold, pure-TS sim (traffic AI, steering, nitro, brake, scoring, collisions, words), input matching, engine loop, Node tests, bare playable scene (boxes) + typing input | done |
| M2 | World: low-poly road (dashes, shoulders, barriers, gantries, speed cameras, streetlights, trees), camera rig (15–20° tilt, follow, FOV, shake), day/night lighting, vignette + edge blur | done |
| M3 | Vehicles: procedural GT3 RS + 5 black cruisers + 3 red mergers, indicators, brake lights, night headlights/beams/taillight trails, player damage states | done |
| M4 | FX + audio: nitro exhaust flames, skid marks, engine smoke, Web Audio synth (key click, blow-off, screech, horn, thud) | todo |
| M5 | HUD + meta: dashboard (speedo, combo bar, hearts, WPM), floating words over obstacles, CLEAN CUT text + rumble, leaderboard sidebar, ready overlay, game-over modal, theme toggle, responsive | todo |
| M6 | Polish + ship: tuning pass, headless screenshots, vercel.json, CI, README final | todo |

## Rules the code must keep
| Rule | How |
| --- | --- |
| Sim is pure TS | `src/game/` imports nothing from React/three/DOM (except `audio.ts`, `leaderboard.ts`, `engine.ts` rAF). Rendering only *reads* `engine.state`. |
| All input goes through commands | UI → `engine.send(cmd)` → `applyCommand()`; events out via `engine.on()`. This is the hook for ghosts/WebSockets. |
| Node can run the sim | Relative imports inside `src/game/` use `.ts` extensions (`allowImportingTsExtensions`) so `node --test` runs it with no build. No enums/namespaces (type stripping). |
| World is player-relative | Sim uses road distance `s` (m) and lateral `x` (m). Renderer puts the player at z=0 and everything at `z = -(s - player.s)`. Forward is −z. |

## Decisions (don't re-ask)
Next.js 16 + React 19 + TypeScript 5.9 (strict) · R3F 9 + drei 10 + three 0.186 · Tailwind 4 (CSS config) · no other runtime deps · units: metres, m/s (`MPH` const in `config.ts`) · lanes 0–4 left→right, `laneX()` · seeded RNG in state (mulberry32) · traffic: lane 0 85–95 mph, others 60–80; 12% surprise cuts · scoring: pass in a lane 2+ away = standard 50, adjacent = dangerous 100, passing the car you just cut out from behind (≤12 m gap at the switch) = clean cut 500; multiplier 1 + 0.2 per pass, max 5 · nitro = word typed in ALL CAPS · brake = Enter twice within 350 ms on an empty input.

## Commands
`npm run dev` · `npm run build` · `npm test` (node --test on `src/game/*.test.ts`) · `npx tsc --noEmit` · `node scripts/shot.mjs <url> <outDir> [--night]` (headless Chrome via CDP, no deps: plays 8 words incl. nitro, double-Enter brake, saves 4 PNGs, prints console errors; reads the word from the input's aria-label). Node 24. Windows 11 dev.

## Code map
- `src/game/config.ts` constants, lane geometry, car dimensions · `types.ts` state/command/event types · `words.ts` word buckets + `pickWord` · `sim.ts` ★ `createState`, `applyCommand`, `step`, `snapshot` · `input.ts` `matchWord`, `isPrefix` · `engine.ts` loop + pub/sub.
- `src/app/` layout, page (server) → `components/GameLoader.tsx` (`next/dynamic`, `ssr:false`) → `Game.tsx` (engine owner, 10 Hz HUD snapshot + refresh on every event, 9:16 column).
- `components/TypingDock.tsx` ★ the only keystroke → command code (invisible input over the capsule; refocuses on blur).
- `components/scene/context.ts` `EngineCtx`/`useEngine`, `NightCtx`/`useNight` · `textures.ts` cached canvas textures (`glowTexture`, `signTexture`).
- `components/scene/Scene.tsx` Canvas (`shadows`, `flat` = no tone mapping), `Atmosphere` (sky/fog/hemi/sun per mode; sun shadow box ±70 m around the player at the origin), `CameraRig` (90 m up, 10 m behind, 20° tilt, follows 35% of player x; shake on collision/nitro/clean cut; +8° FOV in nitro), Traffic (re-renders only when the id list changes; mounts one `NpcCar` per id).
- `components/scene/World.tsx` ★ `Repeat` (copies children every `period` m with optional `offset`, window NEAR 25 m behind to FAR 140 m ahead; `place(g, k)` varies copy k via `hash`) · static strips (grass, asphalt, shoulders, edge lines yellow-left/white-right, jersey barriers) · repeated dashes 12 m, trees 6 m, streetlights 42 m (night: lit heads + additive pools), gantry 520 m (first at 48 m; signs tilted back 1 rad to read from above, they teach `,` `.` CAPS), speed camera 360 m.
- `components/scene/Vehicles.tsx` ★ `STYLE` per model (body/cabin/roof heights, cabin span as a length fraction, wheel radius, `bed` for the F-150) → shared `Body` built from one unit `BOX` scaled per part; footprints from `MODELS`. `PlayerCar`: GT3 RS extras (carbon hood/roof, louvers, swan-neck wing, dual exhausts, LED strip = brake light while `brakeT > 0`), `scuffs` group at `lives <= 2`, `dents` at `lives <= 1`, invuln blink, yaw from `vx`, night spotLight. `NpcCar`: black cruiser / red merger, amber corner blinkers per side, yaw while sliding. `NightLights`: additive ground beam ahead + red trail behind, stretched by speed (`setTrail`).
- `Game.tsx` also: theme (`typencut.theme` = day|night in localStorage, toggles `.dark` on `<html>`), `EdgeFx` (masked `backdrop-filter` blur scaled by speed + vignette).

## Traps already found
- Next 16 has breaking changes: read `node_modules/next/dist/docs/` before using a Next API. `ssr:false` dynamic must live in a client component.
- `node --test src/game/` fails on Windows (treated as a module path): quote a glob, `"src/game/*.test.ts"`.
- Don't remount the dock to replay a CSS animation (`key=`): the input loses focus. Toggle a class with a timeout.
- three 0.186 light units are physical: diffuse ≈ albedo × intensity / π. Day lights sum to ~π (hemi 1.7 + sun 2.1) or the scene goes muddy.
- `Repeat` must base its window on `floor((s − NEAR) / period)`; basing it on `floor(s / period)` drops copies when the period is longer than the view.
- `scripts/shot.mjs` reuses a Chrome profile, so it always writes the theme itself (otherwise a `--night` run leaks into the next). Stop the test server with `taskkill //PID <pid> //T //F` (find it with `netstat -ano | grep :3123`); `npx kill-port` hangs when npm is offline.
- Narrowing: after a helper sets `state.status = "over"`, TS still thinks it's `"running"`; check `lives` instead.

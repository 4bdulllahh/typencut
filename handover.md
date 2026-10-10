# Typencut: handover (compact)

_Updated 2026-10-10 · M1 committed locally (`15ef1a1`, not pushed), M2 done + uncommitted · repo `C:\Users\Computer\Documents\GitHub\typencut`, remote https://github.com/4bdulllahh/typencut · full brief in `docs/spec.md`._

## Resume here
State at end of session 2026-10-10 (owner stopped for the night):
- **M1** committed locally as `15ef1a1` but **not pushed**: github.com:443 was unreachable all session. `origin/main` doesn't exist yet (`git status -sb` shows `[gone]`).
- **M2** finished and verified (build clean, 11 tests pass, day/night headless shots with no console errors) but **uncommitted** in the working tree; the owner hasn't approved the commit yet. Files: `src/components/scene/{context.ts,textures.ts,World.tsx}`, changes to `Scene.tsx`, `Game.tsx`, `scripts/shot.mjs`, this file.

**First thing next session:**
1. `git status` to confirm the M2 files are still uncommitted, then ask the owner: "Commit M2 and start M3?"
2. On yes: commit M2 (`feat: M2 world — …`), then `git push -u origin main` (sends M1 + M2). If the push still fails, carry on and retry at the end.
3. Start **M3** (car models), see the notes below and the milestone table.

M3 notes: replace the boxes in `Scene.tsx` (`Player`, `NpcBox`) with procedural low-poly models in a new `scene/Vehicles.tsx`. Keep their `useFrame` positioning, the invulnerability blink and the indicator blink. Footprints come from `MODELS` in `config.ts` (hitboxes match). Forward is −z; origin at ground centre. Also in M3: GT3 RS details (white body, black carbon hood + roof, front louvers, swan-neck wing, dual centre exhausts, full-width red LED strip, brake lights bright while `player.brakeT > 0`), damage looks by `player.lives` (scuffs at 2, dents at 1), night headlight beams (additive `glowTexture` planes plus a spotLight for the player), red taillight trails at night. Smoke, flames and skid marks are M4.

## Working with the owner
- Build in milestones; stop after each and ask to continue. On approval, commit the finished milestone and push to `origin/main` (commit messages end with a `Co-Authored-By` line). Keep README and this file current, and keep this file short.
- Update **Resume here** and the milestone table as the last step of every milestone (and mid-milestone if tokens run low).

## Milestones
| # | Scope | Status |
| --- | --- | --- |
| M1 | Foundation: Next 16 scaffold, pure-TS sim (traffic AI, steering, nitro, brake, scoring, collisions, words), input matching, engine loop, Node tests, bare playable scene (boxes) + typing input | done (committed, not pushed) |
| M2 | World: low-poly road (dashes, shoulders, barriers, gantries, speed cameras, streetlights, trees), camera rig (15–20° tilt, follow, FOV, shake), day/night lighting, vignette + edge blur | done |
| M3 | Vehicles: procedural GT3 RS + 5 black cruisers + 3 red mergers, indicators, brake lights, night headlights/beams/taillight trails, player damage states | todo |
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
- `components/scene/Scene.tsx` Canvas (`shadows`, `flat` = no tone mapping), `Atmosphere` (sky/fog/hemi/sun per mode; sun shadow box ±70 m around the player at the origin), `CameraRig` (90 m up, 10 m behind, 20° tilt, follows 35% of player x; shake on collision/nitro/clean cut; +8° FOV in nitro), Player box, Traffic (re-renders only when the id list changes; positions in `useFrame`). M3 replaces the boxes.
- `components/scene/World.tsx` ★ `Repeat` (copies children every `period` m with optional `offset`, window NEAR 25 m behind to FAR 140 m ahead; `place(g, k)` varies copy k via `hash`) · static strips (grass, asphalt, shoulders, edge lines yellow-left/white-right, jersey barriers) · repeated dashes 12 m, trees 6 m, streetlights 42 m (night: lit heads + additive pools), gantry 520 m (first at 48 m; signs tilted back 1 rad to read from above, they teach `,` `.` CAPS), speed camera 360 m.
- `Game.tsx` also: theme (`typencut.theme` = day|night in localStorage, toggles `.dark` on `<html>`), `EdgeFx` (masked `backdrop-filter` blur scaled by speed + vignette).

## Traps already found
- Next 16 has breaking changes: read `node_modules/next/dist/docs/` before using a Next API. `ssr:false` dynamic must live in a client component.
- `node --test src/game/` fails on Windows (treated as a module path): quote a glob, `"src/game/*.test.ts"`.
- Don't remount the dock to replay a CSS animation (`key=`): the input loses focus. Toggle a class with a timeout.
- three 0.186 light units are physical: diffuse ≈ albedo × intensity / π. Day lights sum to ~π (hemi 1.7 + sun 2.1) or the scene goes muddy.
- `Repeat` must base its window on `floor((s − NEAR) / period)`; basing it on `floor(s / period)` drops copies when the period is longer than the view.
- `scripts/shot.mjs` reuses a Chrome profile, so it always writes the theme itself (otherwise a `--night` run leaks into the next). Stop the test server with `taskkill //PID <pid> //T //F` (find it with `netstat -ano | grep :3123`); `npx kill-port` hangs when npm is offline.
- Narrowing: after a helper sets `state.status = "over"`, TS still thinks it's `"running"`; check `lives` instead.

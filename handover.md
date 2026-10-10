# Typencut: handover (compact)

_Updated 2026-10-10 · M1–M6 pushed, all milestones done · **live** https://typencut-two.vercel.app · v1.0.0 · repo `C:\Users\Computer\Documents\GitHub\typencut`, remote https://github.com/4bdulllahh/typencut · full brief in `docs/spec.md`._

## Resume here
- **M1–M5** are on `origin/main` (M5 = `a6f7a0e`). Owner confirmed the audio sounds right.
- **M6** pushed (typecheck + build clean, 13 tests pass, day/night headless runs with no console errors): `.github/workflows/ci.yml` (Node 24: `npm ci`, typecheck, test, build), README final + `docs/{day,night,over}.png`, player yaw `-p.vx * 0.018` (was 0.04, ~29° → ~13°), this file.
- All milestones done. Check the first CI run on GitHub (it has never run).
- After M6 (pushed, `29f5e3b`): detailed README in the style of the owner's DocSanitize / Paperless-Invoices-Web READMEs (live link, badges, How-it-works sections, mermaid architecture, Limitations, Roadmap = milestones), screenshots moved to `docs/screenshots/*.webp` (regenerate from `scripts/shot.mjs` output, crop the 9:16 column), `LICENSE` (MIT) added, version bumped to 1.0.0.

**First thing next session:** ask the owner what to build next (see open ideas below).

Open ideas, none promised: mute toggle (`attachAudio` would need `setMuted`); hide the floating word while a popup is on screen (they can overlap); difficulty/crash-rate tuning from real play; ESLint (no lint script exists); `@react-three/drei` is unused now (spec names it, so it was kept).

## Working with the owner
- README style: follow the owner's DocSanitize / Paperless-Invoices-Web READMEs; keep every number in it true to the code, and keep its Roadmap in step with the milestone table.
- Build in milestones; stop after each and ask to continue. On approval, commit the finished milestone and push to `origin/main` (commit messages end with a `Co-Authored-By` line). Keep README and this file current, and keep this file short.
- Update **Resume here** and the milestone table as the last step of every milestone (and mid-milestone if tokens run low).

## Milestones
| # | Scope | Status |
| --- | --- | --- |
| M1 | Foundation: Next 16 scaffold, pure-TS sim (traffic AI, steering, nitro, brake, scoring, collisions, words), input matching, engine loop, Node tests, bare playable scene (boxes) + typing input | done |
| M2 | World: low-poly road (dashes, shoulders, barriers, gantries, speed cameras, streetlights, trees), camera rig (15–20° tilt, follow, FOV, shake), day/night lighting, vignette + edge blur | done |
| M3 | Vehicles: procedural GT3 RS + 5 black cruisers + 3 red mergers, indicators, brake lights, night headlights/beams/taillight trails, player damage states | done |
| M4 | FX + audio: nitro exhaust flames, skid marks, engine smoke, Web Audio synth (key click, blow-off, screech, horn, thud) | done |
| M5 | HUD + meta: dashboard (speedo, combo bar, hearts, WPM), floating words over obstacles, CLEAN CUT text + rumble, leaderboard sidebar, ready overlay, game-over modal, theme toggle, responsive | done |
| M6 | Polish + ship: tuning pass, headless screenshots, vercel.json (not needed: Vercel zero-config), CI, README final | done |

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
`npm run dev` · `npm run build` · `npm run typecheck` · `npm test` (node --test on `src/game/*.test.ts`) · `npx tsc --noEmit` · `node scripts/shot.mjs <url> <outDir> [--night]` (headless Chrome via CDP, no deps: plays 8 words incl. nitro, double-Enter brake, saves `01-ready`, `02-nitro` mid-swerve, `02-driving`, `03-braking`, `04-later`, then idles until the run ends for `05-over`, prints console errors; reads the word from the input's aria-label). Node 24. Windows 11 dev.

## Code map
- `src/game/config.ts` constants, lane geometry, car dimensions · `types.ts` state/command/event types · `words.ts` word buckets + `pickWord` · `sim.ts` ★ `createState`, `applyCommand`, `step`, `snapshot` · `input.ts` `matchWord`, `isPrefix` · `engine.ts` loop + pub/sub.
- `src/app/` layout, page (server) → `components/GameLoader.tsx` (`next/dynamic`, `ssr:false`) → `Game.tsx` (engine owner, 10 Hz HUD snapshot + refresh on every event, 9:16 column).
- `components/TypingDock.tsx` ★ the only keystroke → command code (invisible input over the capsule; refocuses on blur).
- `components/scene/context.ts` `EngineCtx`/`useEngine`, `NightCtx`/`useNight` · `textures.ts` cached canvas textures (`glowTexture`, `signTexture`).
- `components/scene/Scene.tsx` Canvas (`shadows`, `flat` = no tone mapping), `Atmosphere` (sky/fog/hemi/sun per mode; sun shadow box ±70 m around the player at the origin), `CameraRig` (90 m up, 10 m behind, 20° tilt, follows 35% of player x; shake on collision/nitro/clean cut; +8° FOV in nitro), Traffic (re-renders only when the id list changes; mounts one `NpcCar` per id).
- `components/scene/World.tsx` ★ `Repeat` (copies children every `period` m with optional `offset`, window NEAR 25 m behind to FAR 140 m ahead; `place(g, k)` varies copy k via `hash`) · static strips (grass, asphalt, shoulders, edge lines yellow-left/white-right, jersey barriers) · repeated dashes 12 m, trees 6 m, streetlights 42 m (night: lit heads + additive pools), gantry 520 m (first at 48 m; signs tilted back 1 rad to read from above, they teach `,` `.` CAPS), speed camera 360 m.
- `components/scene/Vehicles.tsx` ★ `STYLE` per model (body/cabin/roof heights, cabin span as a length fraction, wheel radius, `bed` for the F-150) → shared `Body` built from one unit `BOX` scaled per part; footprints from `MODELS`. `PlayerCar`: GT3 RS extras (carbon hood/roof, louvers, swan-neck wing, dual exhausts, LED strip = brake light while `brakeT > 0`), `scuffs` group at `lives <= 2`, `dents` at `lives <= 1`, invuln blink, yaw from `vx`, night spotLight. `NpcCar`: black cruiser / red merger, amber corner blinkers per side, yaw while sliding. `NightLights`: additive ground beam ahead + red trail behind, stretched by speed (`setTrail`).
- `components/scene/Fx.tsx` `SkidMarks` (instanced ring buffer of 240 road-space segments under the rear tyres while `|vx| > 3` or braking; cleared on restart) · `Smoke` (48 pooled puffs from the rear deck, 8/s at 2 lives, 24/s dark at 1). Nitro flames live in `PlayerCar` (`flames` group).
- `src/game/audio.ts` `attachAudio(engine)` synth on events: `key` click, `nitro` blow-off + whoomp, `laneChange`/`brake` screech, horn on dangerous/clean-cut overtakes, `collision` thud. AudioContext made lazily on the first keystroke.
- `components/Hud.tsx` `Dashboard` (speed + bar, hearts, multiplier bar + combo, score, WPM) · `Popups` (overtake/crash callouts from `engine.on`, big CLEAN CUT; `.pop` CSS, reduced-motion = fade) · `ReadyOverlay` · `GameOver` (dialog, autofocus Play again, compact leaderboard below `xl`) · `Leaderboard` (top runs + best-run records).
- `src/game/leaderboard.ts` `typencut.board` in localStorage: pure `addRun` (top 10 by score + per-stat bests) and `parseBoard` (drops malformed data), tested; `saveRun` called from `Game.tsx` on `gameOver`.
- `Scene.tsx` `WordTag`: projects a point over the nearest car ahead in the player's lane (else 35 m ahead) and writes the transform/text of a plain DOM tag beside the canvas each frame.
- `Game.tsx` also: layout = left spacer + 9:16 column + right `Leaderboard` sidebar at `xl` (≥1280 px); theme (`typencut.theme` = day|night in localStorage, toggles `.dark` on `<html>`), `EdgeFx` (masked `backdrop-filter` blur scaled by speed + vignette).

## Traps already found
- Next 16 has breaking changes: read `node_modules/next/dist/docs/` before using a Next API. `ssr:false` dynamic must live in a client component.
- `node --test src/game/` fails on Windows (treated as a module path): quote a glob, `"src/game/*.test.ts"`.
- Don't remount the dock to replay a CSS animation (`key=`): the input loses focus. Toggle a class with a timeout.
- three 0.186 light units are physical: diffuse ≈ albedo × intensity / π. Day lights sum to ~π (hemi 1.7 + sun 2.1) or the scene goes muddy.
- `Repeat` must base its window on `floor((s − NEAR) / period)`; basing it on `floor(s / period)` drops copies when the period is longer than the view.
- `scripts/shot.mjs` reuses a Chrome profile, so it always writes the theme itself (otherwise a `--night` run leaks into the next). Stop the test server with `taskkill //PID <pid> //T //F` (find it with `netstat -ano | grep :3123`); `npx kill-port` hangs when npm is offline.
- drei `Html` renders an empty wrapper here (React 19.3 + drei 10.7.9): its content never mounts. Project to screen in `useFrame` and write a DOM node instead (see `WordTag`).
- Headless Chrome is killed, so localStorage from one shot run often doesn't survive into the next; the leaderboard starting empty in shots is expected.
- There is no `lint` script: `npm run lint --silent` prints nothing and looks like a pass. Don't report lint results.
- Narrowing: after a helper sets `state.status = "over"`, TS still thinks it's `"running"`; check `lives` instead.

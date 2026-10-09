# Typencut: handover (compact)

_Updated 2026-10-09 · M1 done, not yet committed · repo `C:\Users\Computer\Documents\GitHub\typencut`, remote https://github.com/4bdulllahh/typencut · full brief in `docs/spec.md`._

## Resume here
- **M1 done** (playable with boxes; 11 tests pass; build clean; headless playthrough has no console errors). Waiting for the owner's OK to commit + push M1, then start **M2** (world + camera + day/night).
- M2 notes from the M1 screenshots: the player sits just above the dock (camera foot is 10 m behind the player, 20° tilt, fov 42, height 90); keep that framing but make room for the dock; the tan background is a placeholder.

## Working with the owner
- Build in milestones; stop after each and ask to continue. On approval, commit the finished milestone and push to `origin/main` (commit messages end with a `Co-Authored-By` line). Keep README and this file current, and keep this file short.
- Update **Resume here** and the milestone table as the last step of every milestone (and mid-milestone if tokens run low).

## Milestones
| # | Scope | Status |
| --- | --- | --- |
| M1 | Foundation: Next 16 scaffold, pure-TS sim (traffic AI, steering, nitro, brake, scoring, collisions, words), input matching, engine loop, Node tests, bare playable scene (boxes) + typing input | in progress |
| M2 | World: low-poly road (dashes, shoulders, barriers, gantries, speed cameras, streetlights, trees), camera rig (15–20° tilt, follow, FOV, shake), day/night lighting, vignette + edge blur | todo |
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
- `components/scene/Scene.tsx` Canvas (`flat` = no tone mapping), `EngineCtx`, CameraRig, Road (dashes scroll by `s % period`), Player box, Traffic (re-renders only when the id list changes; positions in `useFrame`). M2/M3 replace the boxes.

## Traps already found
- Next 16 has breaking changes: read `node_modules/next/dist/docs/` before using a Next API. `ssr:false` dynamic must live in a client component.
- `node --test src/game/` fails on Windows (treated as a module path): quote a glob, `"src/game/*.test.ts"`.
- Don't remount the dock to replay a CSS animation (`key=`): the input loses focus. Toggle a class with a timeout.
- Narrowing: after a helper sets `state.status = "over"`, TS still thinks it's `"running"`; check `lives` instead.

# Typencut

A browser speed-typing game: weave a Porsche 911 GT3 RS through highway traffic by typing words. Inspired by *Assetto Corsa: No Hesi* weaving, styled after *Art of Rally*'s low-poly, flat-shaded look.

> Work in progress, built in milestones. See `handover.md` for status and `docs/spec.md` for the full brief.

## How to play
- Type the word shown in the dock, then press **`,`** to move one lane left or **`.`** to move one lane right.
- Type the word in **ALL CAPS** for a one-second nitro burst.
- Press **Enter twice** with an empty input to brake for a second.
- Overtake for points: +50 standard, +100 in the next lane over, **+500 clean cut** when you dodge out from right behind a car. Passes without contact build a multiplier up to 5×. Three crashes and the run is over.
- Words start at three letters and grow longer (with mixed casing) as you go.

## Tech
Next.js 16 · React 19 · React Three Fiber + drei · three.js · Tailwind CSS 4 · Web Audio API. No backend.

The game logic in `src/game/` is plain TypeScript with no React or three.js, so it runs and is tested in Node. Input becomes commands (`engine.send`), the simulation emits events (`engine.on`), and the renderer only reads state: the seams a multiplayer or ghost-car layer would use.

## Develop
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # sim + input tests (node --test)
npm run build
node scripts/shot.mjs http://localhost:3000 shots   # headless playthrough + screenshots
```
Node 22.18 or newer.

## License
MIT

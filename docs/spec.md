# Typencut: original spec

The owner's brief, kept verbatim so every milestone can be checked against it.

---

Create a fully functional, production-ready, browser-based 3D speed-typing game inspired by "Assetto Corsa: No Hesi" highway weaving, styled with the minimalist, low-poly, flat-shaded aesthetic of "Art of Rally".

Build this as a self-contained, high-performance web application (Next.js / React with Three.js using React Three Fiber + Drei, Tailwind CSS, and Web Audio API, deployable directly on Vercel). Produce the full working codebase without placeholders, missing methods, or incomplete stubs.

### 1. Core visuals & camera setup (Art of Rally aesthetic)
- **Visual style:** minimalist, matte/satin finish, flat-shaded low-poly 3D models with clean vertex geometry, soft lighting, and gentle vignette/motion blur on screen borders. No heavy photorealistic textures or retro pixel art.
- **Camera perspective:** stretched vertical aspect ratio highway layout with an orthographic/perspective camera tilted at an angle of 15° to 20° downward from a top-down view so the player has clear long-range visibility down the highway.
- **Highway environment:**
  - 5-lane infinite scrolling asphalt highway with dashed lane markings, concrete barriers, road shoulders, roadside speed cameras, and overhead highway gantry signs.
  - Lane 1 (far left) has faster average traffic speeds than lanes 2 through 5.
- **Day / night (light / dark mode):**
  - Default light mode (day): warm pastel sky, soft shadows, daytime highway.
  - Dark mode (night): deep night sky, illuminated overhead streetlights zooming past, glowing player headlights casting forward beams, and vibrant red taillight trails.

### 2. Vehicle fleet & procedural low-poly generation
1. **Player car — 2022 Porsche 911 GT3 RS:** low-slung silhouette, white body, exposed matte black carbon hood and roof, aggressive front aero louvers, dual center exhausts, functional red LED taillight strip, active headlights, oversized rear swan-neck wing.
   - Particle VFX: dual rear exhaust flame bursts on nitro; tire skid marks on asphalt during lane shifts.
   - Damage states: visual dents, scuffs, and engine smoke particles upon losing health.
2. **Black NPC cruisers (lane-disciplined, constant speed):** 2015 Toyota Yaris (subcompact hatch), 2020 Honda Civic (compact sedan), 2015 Chevrolet Malibu (mid-size sedan), 2016 Nissan Rogue (crossover SUV), 2017 Ford F-150 (tall pickup).
   - Constant cruising speed (lane 1: ~85–95 mph; lanes 2–5: ~60–80 mph). They hold their lane strictly.
3. **Red NPC mergers (dynamic lane shifters):** 2015 BMW M3, 2012 Mercedes-Benz C63 AMG, 2014 Audi A5.
   - Randomly decide to change lanes. Standard: flash an amber indicator on the target side for 1.5–2.0 s before smoothly sliding across. Surprise cut (10–15% chance): immediate aggressive cut without indicating.

### 3. Typing-to-driving mechanics & controls
- **Steering via punctuation:** prompt words float above obstacles or inside the target system. Typing `<word>,` steers 1 lane left; `<word>.` steers 1 lane right. Lane transitions use snappy, smooth interpolation (lerp / spring damping).
- **Nitrous boost:** typing any valid target word in ALL CAPS triggers a 1-second burst of maximum top speed with dual exhaust flames, camera shake and slight FOV widening.
- **Braking:** double-tapping Enter while the input is empty brakes for 1 second, lights bright brake lights and decelerates rapidly to let merging traffic pass.
- **Progressive difficulty:** starts with 3-letter words only; as distance and score grow, longer words (4, 5, 6+) with mixed casing are weighted in.

### 4. Scoring, health & telemetry
- **Health:** 3 lives. A collision costs 1 life, triggers damage FX, decelerates the car and resets the combo multiplier.
- **Overtake points:** standard +50; dangerous pass (cutting close) +100; clean cut / super close call (lane switch immediately adjacent to an NPC) +500 with on-screen "CLEAN CUT" text and screen rumble. Consecutive passes without contact build a multiplier from 1.0x up to 5.0x.
- **HUD:** centered floating typing dock (capsule); digital dashboard with speedometer (MPH), combo multiplier bar, 3-heart health bar, live WPM; right sidebar with a localStorage high-score leaderboard and best-run records.
- **Game over:** at 0 lives, a post-run telemetry modal: total score, final WPM, accuracy %, max speed, clean cuts. "Play Again" resets without a page reload.

### 5. Audio (Web Audio API, synthesised)
Soft linear-switch key click (Tealios-like) on keystrokes; turbo blow-off / flame burst on nitro; tire screech on lane cuts; horn honk / impact thud on near misses and crashes.

### 6. Architecture
Clean, modular, type-safe. State management separates input handling, game-loop physics and rendering so multiplayer ghost cars / WebSockets can be hooked up later.

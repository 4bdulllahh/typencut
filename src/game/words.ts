/** Word buckets by length: 3, 4, 5, 6, 7+. Lowercase letters only. */
export const WORDS: readonly string[][] = [
  "car gas run cut lap rev fly zip map sky red max top low hot box cab dot fan gap hub ice jet key log mud net oil pit ram sun tow van win yaw arc axe bus cop dip dew fog gum hum jam lid mix nod pop rim rot sip tag tip zag".split(" "),
  "fast lane gear turn road race push rush drag dash kick burn flow grip hood horn jump line loop mile pass skid slip spin tire wing zoom brag cool dust edge glow haze lean lift neon park ramp rear ride roll ruby slow star sync tilt veer wild zone".split(" "),
  "drift brake speed shift wheel turbo nitro chase merge swift blaze flash ghost night light power rally route slick storm track tread valve apex crash dodge fight frame glide grind lunge orbit pedal pilot quick racer rapid relay rider risky rumble scoot sedan steer surge tempo throw".split(" "),
  "engine bumper cruise clutch torque mirror piston rocket signal launch charge bypass carbon chrome convoy corner danger dashed detour diesel faster frenzy gantry ignite jacket legacy motion nimble octane outrun plasma radial rattle reflex sprint stance strike stride switch tunnel velvet".split(" "),
  "highway overtake traffic exhaust gearbox momentum velocity spoiler throttle chicane redline sidewalk camshaft headlight blinker freeway skidpad slipstream turbocharge adrenaline overdrive horsepower crossover dashboard intercept nightfall speedway taillight weaving".split(" "),
];

/**
 * Progress 0 → only 3-letter words; then the weight window slides toward longer words.
 * Mixed casing is mixed in after 35% progress. Never returns an all-caps word (all caps = nitro).
 */
export function pickWord(rand: () => number, progress: number, avoid = ""): string {
  const p = Math.min(1, Math.max(0, progress));
  const bucket = p < 0.05 ? 0 : weighted(rand, WORDS.map((_, i) => Math.max(0, 1 - Math.abs(i - p * 3.5) / 1.5)));
  const list = WORDS[bucket];
  let word = list[Math.floor(rand() * list.length)];
  if (word.toLowerCase() === avoid.toLowerCase()) word = list[(list.indexOf(word) + 1) % list.length];
  if (rand() < Math.max(0, p - 0.35) * 0.8) word = mixCase(rand, word);
  return word;
}

function weighted(rand: () => number, weights: number[]): number {
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
  return weights.length - 1;
}

function mixCase(rand: () => number, word: string): string {
  if (rand() < 0.5) return word[0].toUpperCase() + word.slice(1);
  const chars = [...word].map((c) => (rand() < 0.35 ? c.toUpperCase() : c));
  if (chars.every((c) => c === c.toUpperCase())) chars[chars.length - 1] = chars[chars.length - 1].toLowerCase();
  if (chars.every((c) => c === c.toLowerCase())) chars[0] = chars[0].toUpperCase();
  return chars.join("");
}

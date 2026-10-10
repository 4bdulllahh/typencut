/** Built-in word lists. Lowercase A–Z only, so every pack is typeable on any keyboard layout. */
const LISTS = {
  driving:
    "car gas run cut lap rev fly zip map sky red max top low hot box cab dot fan gap hub ice jet key log mud net oil pit ram sun tow van win yaw arc axe bus cop dip dew fog gum hum jam lid mix nod pop rim rot sip tag tip zag " +
    "fast lane gear turn road race push rush drag dash kick burn flow grip hood horn jump line loop mile pass skid slip spin tire wing zoom brag cool dust edge glow haze lean lift neon park ramp rear ride roll ruby slow star sync tilt veer wild zone " +
    "drift brake speed shift wheel turbo nitro chase merge swift blaze flash ghost night light power rally route slick storm track tread valve apex crash dodge fight frame glide grind lunge orbit pedal pilot quick racer rapid relay rider risky rumble scoot sedan steer surge tempo throw " +
    "engine bumper cruise clutch torque mirror piston rocket signal launch charge bypass carbon chrome convoy corner danger dashed detour diesel faster frenzy gantry ignite jacket legacy motion nimble octane outrun plasma radial rattle reflex sprint stance strike stride switch tunnel velvet " +
    "highway overtake traffic exhaust gearbox momentum velocity spoiler throttle chicane redline sidewalk camshaft headlight blinker freeway skidpad slipstream turbocharge adrenaline overdrive horsepower crossover dashboard intercept nightfall speedway taillight weaving",
  common:
    "the and for are but not you all any can had her was one our out day get has him his how man new now old see two way who boy did its let put say she too use " +
    "that with have this will your from they know want been good much some time very when come here just like long make many more only over such take than them well were what " +
    "about other which their there would these thing could first water after where right think three years place sound great again still every small found those never under might while house world below asked going large until along shall being often earth began since study night light above paper parts young story point " +
    "people little number before family follow change answer school mother father should friend always letter animal second become course during enough member public really almost " +
    "between another picture example thought without country through important children together problem question something sentence beautiful",
  programming:
    "var let map git npm api css cli bug log int key set get ssh sql url dom tab row " +
    "node rust java loop null void enum bool type code byte port test lint hash heap json yaml html bash diff fork pull push repo sort tree file path data task lock sync " +
    "array class const async await fetch react query stack queue debug merge index proxy scope float input yield token build cache shell route state hooks props regex " +
    "branch commit deploy docker kernel lambda object string return import export module server socket thread binary buffer cursor schema syntax method vector status render client " +
    "compile function promise closure pointer runtime browser iterator variable database frontend backend refactor recursion interface algorithm typescript javascript generic boolean callback package container middleware",
  spanish:
    "sol mar rio pan dia luz voz mes uno dos sal ojo pie red vez " +
    "casa gato agua rojo azul luna mesa vida amor cara mano tren auto playa nube " +
    "perro fuego verde coche calle noche cielo rueda motor libro silla amigo madre padre mundo fuerte bueno grande nuevo viejo blanco negro dulce feliz queso leche fresa " +
    "tierra viento rapido camino puerta ciudad pueblo tiempo verano maleta montana bosque ventana hermano trabajo invierno manzana naranja caballo carrera domingo semana ",
  french:
    "eau feu mer ami bon vin lit nez oui pas sel roi jeu sac " +
    "chat vert bleu lune ciel vent vite lent roue fort noir doux pain lait rire mot nuit rose port " +
    "rouge route terre porte livre table frere mere pere ville temps monde grand vieux blanc pomme fleur jaune train velo plage " +
    "maison voiture soleil moteur chemin travail nouveau bonjour fromage jardin oiseau merci argent cheval dimanche semaine fenetre montagne riviere chocolat bouteille ",
  german:
    "rot weg rad gut alt neu tag ohr see eis ball hut " +
    "haus hund blau auto mond meer wind buch zeit welt brot dorf baum fisch kalt warm " +
    "katze feuer nacht sonne himmel erde tisch stuhl stadt stark gross weiss apfel milch danke blume vogel insel wagen reise strand " +
    "wasser strasse schnell langsam fenster freund bruder mutter vater arbeit schwarz garten sommer winter kuchen fahrrad bahnhof morgen abend wochenende geschichte ",
};

export type PackId = keyof typeof LISTS | "custom";
export const PACK_IDS = [...Object.keys(LISTS), "custom"] as PackId[];

/** Sorts words into the five length buckets the difficulty ramp uses: ≤3, 4, 5, 6, 7+. */
export function bucketize(words: string[]): string[][] {
  const buckets: string[][] = [[], [], [], [], []];
  for (const w of words) buckets[Math.min(4, Math.max(0, w.length - 3))].push(w);
  return buckets;
}

export const PACKS = Object.fromEntries(Object.entries(LISTS).map(([id, list]) => [id, bucketize(list.trim().split(/\s+/))])) as Record<Exclude<PackId, "custom">, string[][]>;
export const WORDS = PACKS.driving;

/** A pasted word list: letters only, 2–14 long, lowercased, no repeats. Fewer than 10 words is not enough to play. */
export function parseWordList(text: string): string[] {
  const words = text.split(/[\s,;]+/).filter((w) => /^[a-zA-Z]{2,14}$/.test(w)).map((w) => w.toLowerCase());
  return [...new Set(words)];
}
export const MIN_CUSTOM_WORDS = 10;

/** The buckets for a pack choice; a custom list that is too short falls back to the driving words. */
export function packWords(pack: PackId, custom: string): string[][] {
  if (pack !== "custom") return PACKS[pack];
  const words = parseWordList(custom);
  return words.length >= MIN_CUSTOM_WORDS ? bucketize(words) : WORDS;
}

/**
 * Progress 0 → only the shortest words; then the weight window slides toward longer words.
 * Empty buckets (small or custom packs) are skipped. Mixed casing is mixed in after 35% progress.
 * Never returns an all-caps word (all caps = nitro).
 */
export function pickWord(rand: () => number, progress: number, avoid = "", buckets: string[][] = WORDS): string {
  const p = Math.min(1, Math.max(0, progress));
  const nearest = (i: number) => buckets.map((b, j) => [b.length ? Math.abs(j - i) : Infinity, j]).sort((a, b) => a[0] - b[0])[0][1];
  const weights = buckets.map((b, i) => (b.length ? Math.max(0, 1 - Math.abs(i - p * 3.5) / 1.5) : 0));
  const bucket = p < 0.05 || !weights.some((w) => w > 0) ? nearest(Math.round(p * 3.5)) : weighted(rand, weights);
  const list = buckets[bucket];
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

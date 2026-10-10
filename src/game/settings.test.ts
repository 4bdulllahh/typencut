import assert from "node:assert/strict";
import { test } from "node:test";
import { revs } from "./audio.ts";
import { DEFAULT_STEER, bindable, steerDir } from "./input.ts";
import { defaultSettings, parseSettings } from "./settings.ts";

test("parseSettings keeps valid fields and drops the rest", () => {
  const base = defaultSettings(true, false);
  assert.deepEqual(parseSettings(null, base), base);
  assert.deepEqual(parseSettings("not json", base), base);
  const s = parseSettings(JSON.stringify({ volume: 0.3, muted: true, quality: "low", touch: true, engine: "no", reduceMotion: 1 }), base);
  assert.deepEqual(s, { ...base, volume: 0.3, muted: true, quality: "low", touch: true });
  assert.equal(parseSettings(JSON.stringify({ volume: 7, quality: "ultra" }), base).volume, base.volume);
  assert.equal(parseSettings(JSON.stringify({ quality: "ultra" }), base).quality, "high");
  const m = parseSettings(JSON.stringify({ mode: "zen", pack: "french", customWords: "a b c" }), base);
  assert.deepEqual([m.mode, m.pack, m.customWords], ["zen", "french", "a b c"]);
  const bad = parseSettings(JSON.stringify({ mode: "god", pack: "klingon", customWords: 5 }), base);
  assert.deepEqual([bad.mode, bad.pack, bad.customWords], ["classic", "driving", ""]);
  const car = parseSettings(JSON.stringify({ car: "m4", paint: "red" }), base);
  assert.deepEqual([car.car, car.paint], ["m4", "red"]);
  const badCar = parseSettings(JSON.stringify({ car: "yaris", paint: "gold" }), base); // npc models are not player cars
  assert.deepEqual([badCar.car, badCar.paint], ["gt3rs", "white"]);
  assert.equal(parseSettings(JSON.stringify({ weather: "fog" }), base).weather, "fog");
  assert.equal(parseSettings(JSON.stringify({ weather: "snow" }), base).weather, "random");
  const mix = parseSettings(JSON.stringify({ mix: { engine: 0.2, weather: 3, typing: "loud", effects: 0 } }), base).mix;
  assert.deepEqual(mix, { ...base.mix, engine: 0.2, effects: 0 });
  assert.equal(parseSettings(JSON.stringify({ engine: false }), base).mix.engine, 0); // old engine switch carries over
  assert.equal(base.mix.engine, defaultSettings().mix.engine); // parsing never mutates the defaults
  assert.equal(parseSettings(JSON.stringify({ music: "dnb" }), base).music, "dnb");
  assert.equal(parseSettings(JSON.stringify({ music: "radio" }), base).music, "spotify");
});

test("engine revs climb through each gear and drop on the upshift", () => {
  const a = revs(80);
  const b = revs(84);
  const c = revs(86);
  assert.equal(a.gear, b.gear);
  assert.ok(b.rpm > a.rpm);
  assert.equal(c.gear, a.gear + 1);
  assert.ok(c.rpm < b.rpm);
  assert.equal(revs(0).rpm, 0.35);
  assert.equal(revs(500).gear, 7);
  assert.equal(revs(500).rpm, 1);
});

test("lane-switch keys: no letters or reserved keys, two different keys, Shift-proof", () => {
  const base = defaultSettings();
  const steer = (left: string, right: string) => parseSettings(JSON.stringify({ steer: { left: { code: left, key: "x" }, right: { code: right, key: "y" } } }), base).steer;
  assert.deepEqual(steer("ArrowLeft", "ArrowRight").left.code, "ArrowLeft");
  assert.deepEqual(steer("Digit1", "Space").right.code, "Space");
  for (const [l, r] of [["KeyA", "Period"], ["Enter", "Period"], ["Comma", "Comma"], ["Comma", "<script>"]]) assert.deepEqual(steer(l, r), DEFAULT_STEER);
  assert.ok(!bindable("KeyZ") && !bindable("Backspace") && !bindable("CapsLock") && bindable("Semicolon") && bindable("Numpad4"));
  assert.equal(steerDir("Comma", "<", DEFAULT_STEER), -1); // Shift held for an ALL CAPS word
  assert.equal(steerDir("Period", ".", DEFAULT_STEER), 1);
  assert.equal(steerDir("", ",", DEFAULT_STEER), -1); // a phone keyboard with no code
  assert.equal(steerDir("KeyA", "a", DEFAULT_STEER), 0);
});

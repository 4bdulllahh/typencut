import assert from "node:assert/strict";
import { test } from "node:test";
import { revs } from "./audio.ts";
import { defaultSettings, parseSettings } from "./settings.ts";

test("parseSettings keeps valid fields and drops the rest", () => {
  const base = defaultSettings(true, false);
  assert.deepEqual(parseSettings(null, base), base);
  assert.deepEqual(parseSettings("not json", base), base);
  const s = parseSettings(JSON.stringify({ volume: 0.3, muted: true, quality: "low", touch: true, engine: "no", reduceMotion: 1 }), base);
  assert.deepEqual(s, { ...base, volume: 0.3, muted: true, quality: "low", touch: true });
  assert.equal(parseSettings(JSON.stringify({ volume: 7, quality: "ultra" }), base).volume, base.volume);
  assert.equal(parseSettings(JSON.stringify({ quality: "ultra" }), base).quality, "high");
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

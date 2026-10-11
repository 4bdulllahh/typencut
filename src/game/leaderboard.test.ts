import assert from "node:assert/strict";
import { test } from "node:test";
import { TOP_N, addRun, boardKey, emptyBoard, parseBoard, type Run } from "./leaderboard.ts";

const run = (score: number, extra: Partial<Run> = {}): Run => ({ score, accuracy: 95, maxSpeedMph: 150, cleanCuts: 1, date: score, ...extra });

test("board keeps the top runs by score and the best of every stat", () => {
  let b = emptyBoard();
  for (let i = 0; i < TOP_N + 3; i++) b = addRun(b, run(i * 100));
  b = addRun(b, run(0, { accuracy: 100, cleanCuts: 7 })); // poor score, record accuracy
  assert.equal(b.runs.length, TOP_N);
  assert.equal(b.runs[0].score, (TOP_N + 2) * 100);
  assert.ok(b.runs.every((r, i) => i === 0 || r.score <= b.runs[i - 1].score));
  assert.equal(b.best.accuracy, 100);
  assert.equal(b.best.cleanCuts, 7);
  assert.equal(b.best.score, (TOP_N + 2) * 100);
});

test("parseBoard drops malformed storage", () => {
  assert.deepEqual(parseBoard("not json"), emptyBoard());
  assert.deepEqual(parseBoard(null), emptyBoard());
  const b = parseBoard(JSON.stringify({ runs: [run(5), { score: "9" }, null], best: { score: 5, accuracy: "x" } }));
  assert.equal(b.runs.length, 1);
  assert.equal(b.best.score, 5);
  assert.equal(b.best.accuracy, 0);
});

test("boards per mode and control style; old keys carry over", () => {
  assert.equal(boardKey("classic", "2026-10-10"), "typencut.board");
  assert.equal(boardKey("classic", "2026-10-10", true), "typencut.board.drive"); // the old Drive mode's board
  assert.equal(boardKey("rush", "2026-10-10", true), "typencut.board.rush.drive");
  assert.equal(boardKey("daily", "2026-10-10", true), "typencut.board.daily.2026-10-10.drive");
});

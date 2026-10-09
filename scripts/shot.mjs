// Plays a few words in headless Chrome and saves screenshots. No dependencies (Node 24 WebSocket).
// Usage: node scripts/shot.mjs [url] [outDir] [--night]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "shots";
const night = process.argv.includes("--night");
const chrome = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9333;
mkdirSync(out, { recursive: true });

const proc = spawn(chrome, [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), "typencut-shot")}`,
  "--window-size=1280,900", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required", "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; i < 50 && !ws; i++) {
  try {
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  } catch {
    await sleep(200);
  }
}
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg.result), pending.delete(msg.id);
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.text + " " + (msg.params.exceptionDetails.exception?.description ?? ""));
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
});
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;
const shot = async (name) => {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(out, `${name}.png`), Buffer.from(data, "base64"));
  console.log("saved", join(out, `${name}.png`));
};
const key = (k) => Promise.all(["keyDown", "keyUp"].map((type) => send("Input.dispatchKeyEvent", { type, key: k, text: type === "keyDown" && k.length === 1 ? k : undefined })));
const word = () => evaluate(`document.querySelector('input')?.getAttribute('aria-label')?.match(/“(.*?)”/)?.[1]`);

await send("Runtime.enable");
await send("Page.enable");
if (night) await send("Page.addScriptToEvaluateOnNewDocument", { source: "localStorage.setItem('typencut.theme','night')" });
await send("Page.navigate", { url });
await sleep(4000);
await shot("01-ready");

// Weave: alternate left/right, every third word in caps (nitro).
for (let i = 0; i < 8; i++) {
  const w = await word();
  if (!w) break;
  await send("Input.insertText", { text: i % 3 === 2 ? w.toUpperCase() : w });
  await key(i % 2 ? "." : ",");
  await sleep(450);
}
await shot("02-driving");
await key("Enter");
await sleep(120);
await key("Enter");
await sleep(300);
await shot("03-braking");
await sleep(6000);
await shot("04-later");
console.log(errors.length ? "CONSOLE ERRORS:\n" + errors.join("\n") : "no console errors");
ws.close();
proc.kill();
process.exit(0);

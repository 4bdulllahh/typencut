import type { Snapshot } from "@/game/sim";

const SIZE = 1080;
const SITE = "typencut-two.vercel.app";

/** A square image of the run's stats, drawn in the page's own font. */
export function drawShareCard(snap: Snapshot, title: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext("2d")!;
  const font = getComputedStyle(document.body).fontFamily;
  const bg = g.createLinearGradient(0, 0, 0, SIZE);
  bg.addColorStop(0, "#f2a65a");
  bg.addColorStop(0.45, "#7a3b5e");
  bg.addColorStop(1, "#0b1022");
  g.fillStyle = bg;
  g.fillRect(0, 0, SIZE, SIZE);
  // a road receding into the distance
  g.fillStyle = "rgba(20,22,30,0.55)";
  g.beginPath();
  g.moveTo(SIZE * 0.44, SIZE * 0.3);
  g.lineTo(SIZE * 0.56, SIZE * 0.3);
  g.lineTo(SIZE * 1.1, SIZE);
  g.lineTo(SIZE * -0.1, SIZE);
  g.fill();

  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.font = `italic 900 96px ${font}`;
  g.fillText("TYPENCUT", SIZE / 2, 150);
  g.font = `700 34px ${font}`;
  g.fillStyle = "#fde68a";
  g.fillText(title.toUpperCase(), SIZE / 2, 210);
  g.fillStyle = "#fff";
  g.font = `900 200px ${font}`;
  g.fillText(snap.score.toLocaleString(), SIZE / 2, 450);
  g.font = `600 36px ${font}`;
  g.fillText("points", SIZE / 2, 505);

  const stats: [string, string][] = [
    ["ACCURACY", `${Math.round(snap.accuracy)}%`],
    ["TOP SPEED", `${Math.round(snap.maxSpeedMph)} mph`],
    ["CLEAN CUTS", String(snap.cleanCuts)],
    ["DISTANCE", `${(snap.distance / 1000).toFixed(1)} km`],
  ];
  stats.forEach(([k, v], i) => {
    const x = 90 + (i % 2) * 465;
    const y = 590 + Math.floor(i / 2) * 190;
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.roundRect(x, y, 435, 160, 28);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.font = `700 28px ${font}`;
    g.fillText(k, x + 217, y + 55);
    g.fillStyle = "#fff";
    g.font = `800 64px ${font}`;
    g.fillText(v, x + 217, y + 130);
  });
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.font = `600 30px ${font}`;
  g.fillText(SITE, SIZE / 2, 1035);
  return canvas;
}

/** The phone share sheet where it can take an image; otherwise the image downloads. */
export async function shareRun(snap: Snapshot, title: string) {
  const blob = await new Promise<Blob | null>((ok) => drawShareCard(snap, title).toBlob(ok, "image/png"));
  if (!blob) return;
  const file = new File([blob], "typencut-run.png", { type: "image/png" });
  const text = `I scored ${snap.score.toLocaleString()} in Typencut (${title}). https://${SITE}`;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
    } catch {} // the user closed the share sheet
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import { CanvasTexture, SRGBColorSpace, type Texture } from "three";

const cache = new Map<string, Texture>();

function canvasTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  let tex = cache.get(key);
  if (!tex) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d")!);
    tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    cache.set(key, tex);
  }
  return tex;
}

/** White radial falloff for light pools, glows and beams (tint with the material color). */
export const glowTexture = () =>
  canvasTexture("glow", 128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });

/** Highway sign face: green panel, white border, one or two lines of text. */
export const signTexture = (lines: string[]) =>
  canvasTexture(`sign:${lines.join("|")}`, 512, 224, (g) => {
    g.fillStyle = "#2f6b4f";
    g.fillRect(0, 0, 512, 224);
    g.strokeStyle = "#f2f2ea";
    g.lineWidth = 8;
    g.strokeRect(14, 14, 484, 196);
    g.fillStyle = "#f2f2ea";
    g.textAlign = "center";
    g.textBaseline = "middle";
    lines.forEach((line, i) => {
      g.font = `bold ${i === 0 ? 76 : 40}px system-ui, sans-serif`;
      g.fillText(line, 256, lines.length === 1 ? 112 : 88 + i * 74);
    });
  });

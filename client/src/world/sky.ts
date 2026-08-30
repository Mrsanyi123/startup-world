import * as THREE from "three";

/**
 * Dusk-ish vertical gradient used as the scene background — deep blue
 * overhead melting into a warm horizon. Rendered once to a tiny canvas and
 * stretched across the screen by three.js.
 */
export function createSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#26315e");
  gradient.addColorStop(0.5, "#7c6f9e");
  gradient.addColorStop(0.8, "#d9a08c");
  gradient.addColorStop(1, "#f0c39b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

import * as THREE from "three";
import { PLANET_RADIUS } from "./constants";

/**
 * The planet as a place: a stylized watercolor toy-world.
 *
 * Visual-only layers (clouds, atmosphere) sit slightly outside the sphere,
 * but the planet mesh itself is a perfect sphere of PLANET_RADIUS — no
 * displacement, so the walkable surface stays exactly `|p| == R`.
 */

// Seeded PRNG (mulberry32) so the planet looks identical on every refresh.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEX_W = 1024;
const TEX_H = 512;

/** Draw a filled circle, repeated at x ± width so the equirect seam wraps. */
function wrapCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  for (const dx of [-TEX_W, 0, TEX_W]) {
    ctx.beginPath();
    ctx.arc(x + dx, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function createSurfaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  const rand = mulberry32(1337);

  // Shallow ocean base with a soft vertical shift.
  const ocean = ctx.createLinearGradient(0, 0, 0, TEX_H);
  ocean.addColorStop(0, "#7dc3c6");
  ocean.addColorStop(0.5, "#67b0bd");
  ocean.addColorStop(1, "#7dc3c6");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Large faint darker patches so the water isn't flat.
  ctx.fillStyle = "rgba(58, 199, 182, 0.18)";
  for (let i = 0; i < 8; i++) {
    wrapCircle(ctx, rand() * TEX_W, TEX_H * (0.15 + rand() * 0.7), 60 + rand() * 110);
  }

  // Continents: blobby clusters of overlapping discs from a random walk.
  // Each continent is drawn twice — a wider sand fringe, then grass on top.
  const grassTones = ["#8fbf68", "#9cc973", "#84b660", "#a6cf7f"];
  const continentCount = 13;
  interface Disc { x: number; y: number; r: number; }
  const landDiscs: Disc[] = [];

  for (let c = 0; c < continentCount; c++) {
    let x = rand() * TEX_W;
    let y = TEX_H * (0.2 + rand() * 0.6); // keep off the smeared poles
    const discs: Disc[] = [];
    const steps = 8 + Math.floor(rand() * 8);
    let r = 20 + rand() * 26;
    for (let s = 0; s < steps; s++) {
      discs.push({ x, y, r });
      x += (rand() - 0.5) * r * 1.8;
      y += (rand() - 0.5) * r * 1.2;
      r *= 0.82 + rand() * 0.22;
    }
    ctx.fillStyle = "#e7d8a4";
    for (const d of discs) wrapCircle(ctx, d.x, d.y, d.r * 1.35);
    for (const d of discs) {
      ctx.fillStyle = grassTones[Math.floor(rand() * grassTones.length)];
      wrapCircle(ctx, d.x, d.y, d.r);
    }
    landDiscs.push(...discs);
  }

  // Dirt patches scattered inside the continents.
  ctx.fillStyle = "rgba(186, 148, 101, 0.4)";
  for (let i = 0; i < 60; i++) {
    const d = landDiscs[Math.floor(rand() * landDiscs.length)];
    wrapCircle(
      ctx,
      d.x + (rand() - 0.5) * d.r,
      d.y + (rand() - 0.5) * d.r,
      d.r * (0.15 + rand() * 0.2),
    );
  }

  // Soft polar caps.
  for (const top of [true, false]) {
    const g = top
      ? ctx.createLinearGradient(0, 0, 0, TEX_H * 0.12)
      : ctx.createLinearGradient(0, TEX_H, 0, TEX_H * 0.88);
    g.addColorStop(0, "rgba(244, 246, 240, 0.95)");
    g.addColorStop(1, "rgba(244, 246, 240, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, top ? 0 : TEX_H * 0.88, TEX_W, TEX_H * 0.12);
  }

  // Watercolor grain: thousands of faint 1–2px speckles, alternating
  // light/dark, so the sphere never reads as a pool ball.
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle =
      i % 2 === 0 ? "rgba(30, 60, 45, 0.05)" : "rgba(255, 255, 250, 0.06)";
    ctx.fillRect(rand() * TEX_W, rand() * TEX_H, 1 + rand(), 1 + rand());
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  const rand = mulberry32(9001);

  for (let c = 0; c < 22; c++) {
    const cx = rand() * TEX_W;
    const cy = TEX_H * (0.18 + rand() * 0.64);
    const puffs = 4 + Math.floor(rand() * 6);
    for (let p = 0; p < puffs; p++) {
      const x = cx + (rand() - 0.5) * 90;
      const y = cy + (rand() - 0.5) * 30;
      const r = 12 + rand() * 26;
      for (const dx of [-TEX_W, 0, TEX_W]) {
        const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        g.addColorStop(0, "rgba(255, 255, 255, 0.55)");
        g.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y - r, r * 2, r * 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface Planet {
  group: THREE.Group;
  /** Advance visual-only animation (cloud drift). */
  update(dt: number): void;
}

export function createPlanet(): Planet {
  const group = new THREE.Group();

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS, 64, 64),
    new THREE.MeshLambertMaterial({ map: createSurfaceTexture() }),
  );
  group.add(surface);

  // Very slow cloud layer, above the third-person camera's head so clouds
  // drift overhead instead of fogging the character. Visual only.
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS * 1.1, 48, 48),
    new THREE.MeshLambertMaterial({
      map: createCloudTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  clouds.rotation.x = 0.15;
  group.add(clouds);

  // Faint atmosphere shell: a slightly larger back-facing sphere reads as a
  // soft rim of sky around the silhouette. Kept BELOW the game camera's
  // radius so it never veils the whole screen from inside.
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS * 1.06, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xaed6ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  group.add(atmosphere);

  return {
    group,
    update(dt: number) {
      clouds.rotation.y += 0.008 * dt;
    },
  };
}

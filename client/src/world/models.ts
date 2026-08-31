import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ASSET_MANIFEST, type AssetEntry } from "@startup-village/shared";
import { CHARACTER_HEIGHT } from "../character/character";

import houseA from "../../../models/houses/building-type-a.glb?url";
import houseB from "../../../models/houses/building-type-b.glb?url";
import houseC from "../../../models/houses/building-type-c.glb?url";
import houseD from "../../../models/houses/building-type-d.glb?url";
import houseE from "../../../models/houses/building-type-e.glb?url";
import houseF from "../../../models/houses/building-type-f.glb?url";
import houseG from "../../../models/houses/building-type-g.glb?url";
import houseH from "../../../models/houses/building-type-h.glb?url";
import houseI from "../../../models/houses/building-type-i.glb?url";
import houseJ from "../../../models/houses/building-type-j.glb?url";
import houseK from "../../../models/houses/building-type-k.glb?url";
import houseL from "../../../models/houses/building-type-l.glb?url";

import fence1x4 from "../../../models/fences/fence-1x4.glb?url";
import fence2x2 from "../../../models/fences/fence-2x2.glb?url";
import fence2x3 from "../../../models/fences/fence-2x3.glb?url";
import fence3x2 from "../../../models/fences/fence-3x2.glb?url";
import fence3x3 from "../../../models/fences/fence-3x3.glb?url";

import pathLong from "../../../models/path/path-long.glb?url";
import pathShort from "../../../models/path/path-short.glb?url";
import pathStonesLong from "../../../models/path/path-stones-long.glb?url";
import pathStonesMessy from "../../../models/path/path-stones-messy.glb?url";
import pathStonesShort from "../../../models/path/path-stones-short.glb?url";
import planter from "../../../models/path/planter.glb?url";

// The Kenney colormap palette every model UV-samples. Without it the meshes
// render flat white (the models reference an *external* Textures/colormap.png
// that the bundler does not resolve), so we load it once and assign it to
// every material ourselves.
import colormapUrl from "../../../models/Textures/colormap.png?url";

/**
 * Maps each hashed `?url` asset to its manifest key so placement/scaling can
 * read measured dimensions instead of guessing (Prompt 04b, steps 1–2).
 */
const URL_TO_KEY: Record<string, string> = {
  [houseA]: "building_type_a",
  [houseB]: "building_type_b",
  [houseC]: "building_type_c",
  [houseD]: "building_type_d",
  [houseE]: "building_type_e",
  [houseF]: "building_type_f",
  [houseG]: "building_type_g",
  [houseH]: "building_type_h",
  [houseI]: "building_type_i",
  [houseJ]: "building_type_j",
  [houseK]: "building_type_k",
  [houseL]: "building_type_l",
  [fence1x4]: "fence_1x4",
  [fence2x2]: "fence_2x2",
  [fence2x3]: "fence_2x3",
  [fence3x2]: "fence_3x2",
  [fence3x3]: "fence_3x3",
  [pathLong]: "path_long",
  [pathShort]: "path_short",
  [pathStonesLong]: "path_stones_long",
  [pathStonesMessy]: "path_stones_messy",
  [pathStonesShort]: "path_stones_short",
  [planter]: "planter",
};

export function manifestForUrl(url: string): AssetEntry | undefined {
  const key = URL_TO_KEY[url];
  return key ? (ASSET_MANIFEST as Record<string, AssetEntry>)[key] : undefined;
}

export const HOUSE_URLS = [
  houseA, houseB, houseC, houseD, houseE, houseF,
  houseG, houseH, houseI, houseJ, houseK, houseL,
] as const;

export const FENCE_URLS = [fence1x4, fence2x2, fence2x3, fence3x2, fence3x3] as const;
/** Straight garden-fence rail used to ring claimed plots (length along +X). */
export const FENCE_RAIL_URL = fence1x4;
export const PATH_ROAD_URL = pathLong;
export const PATH_SHORT_URL = pathShort;
export const PATH_LONG_URL = pathLong;
export const PATH_STONES_SHORT_URL = pathStonesShort;
export const PATH_STONES_LONG_URL = pathStonesLong;
export const PATH_STONES_MESSY_URL = pathStonesMessy;
export const PLANTER_URL = planter;

/**
 * Tier → building assignment, derived from measured height so higher tiers use
 * genuinely taller models (no per-tier stretch of short-wide models). Two
 * models per tier for variety.
 */
export const TIER_HOUSE_URLS: readonly (readonly string[])[] = (() => {
  const sorted = [...HOUSE_URLS].sort(
    (a, b) =>
      (manifestForUrl(a)?.dimensions.height ?? 1) -
      (manifestForUrl(b)?.dimensions.height ?? 1),
  );
  const pairs: string[][] = [];
  for (let t = 0; t < 6; t++) pairs.push([sorted[t * 2], sorted[t * 2 + 1]]);
  return pairs;
})();

/** Smallest building height across the kit, from measured data. */
const MIN_HOUSE_HEIGHT = Math.min(
  ...HOUSE_URLS.map((u) => manifestForUrl(u)?.dimensions.height ?? 1),
);

/**
 * Global model→world scale so the *smallest* house reads clearly bigger than
 * the character, plus a gentle per-tier growth on top. Because it is anchored
 * to CHARACTER_HEIGHT and measured model heights, it is not a guessed constant.
 */
const BASE_SCALE = (CHARACTER_HEIGHT * 1.9) / MIN_HOUSE_HEIGHT;
const TIER_GROWTH = [1.0, 1.06, 1.12, 1.19, 1.27, 1.36];

/**
 * Uniform world scale for a building at `tierIndex`. A single global factor
 * (from the smallest model, anchored to CHARACTER_HEIGHT) preserves each
 * model's real proportions — short-wide bungalows stay bungalows — while a
 * gentle per-tier multiplier makes higher tiers visibly grow.
 */
export function houseScaleForTier(tierIndex: number): number {
  return BASE_SCALE * (TIER_GROWTH[tierIndex] ?? 1);
}

/** World bounding box (w,d,h) of a building at a tier, from measured dims. */
export function houseWorldSize(
  url: string,
  tierIndex: number,
): { width: number; depth: number; height: number } {
  const d = manifestForUrl(url)?.dimensions ?? { width: 1, depth: 1, height: 1 };
  const s = houseScaleForTier(tierIndex);
  return { width: d.width * s, depth: d.depth * s, height: d.height * s };
}

/** Half-diagonal footprint radius of a building at a tier (for fence ring). */
export function houseFootprintRadius(url: string, tierIndex: number): number {
  const { width, depth } = houseWorldSize(url, tierIndex);
  return 0.5 * Math.hypot(width, depth);
}

/** Load a building sized for its tier (uniform, proportion-preserving). */
export async function loadHouseForTier(
  url: string,
  tierIndex: number,
): Promise<THREE.Group> {
  return loadModelScaled(url, houseScaleForTier(tierIndex));
}

// ---------------------------------------------------------------------------
const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Group>>();

/** Shared Kenney palette. Assigned to every model material in prepare(). */
const colormap = new THREE.TextureLoader().load(colormapUrl);
colormap.colorSpace = THREE.SRGBColorSpace;
colormap.flipY = false; // glTF UV convention
colormap.magFilter = THREE.NearestFilter; // flat palette cells, no bleeding
colormap.minFilter = THREE.NearestFilter;
colormap.generateMipmaps = false;
colormap.needsUpdate = true;

function prepare(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
        // Wire in the palette the model references but the bundler can't find,
        // and clear any tint so true colors show.
        (std as THREE.MeshStandardMaterial).map = colormap;
        (std as THREE.MeshStandardMaterial).color?.setRGB(1, 1, 1);
        if (std.isMeshStandardMaterial) {
          std.metalness = Math.min(std.metalness ?? 0, 0.0);
          std.roughness = Math.max(std.roughness ?? 1, 0.75);
        }
        std.needsUpdate = true;
      }
    }
  });
}

async function baseModel(url: string): Promise<THREE.Group> {
  let pending = cache.get(url);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          prepare(gltf.scene);
          resolve(gltf.scene);
        },
        undefined,
        reject,
      );
    });
    cache.set(url, pending);
  }
  return pending;
}

/** Clone the model and apply a uniform world `scale`, grounded on its pivot. */
export async function loadModelScaled(
  url: string,
  scale: number,
): Promise<THREE.Group> {
  const src = await baseModel(url);
  const clone = src.clone(true);
  clone.scale.setScalar(scale);
  // Base-pivot models sit at y=0 already; offset by the measured base just in
  // case (baseY ~= 0 for this kit).
  const baseY = manifestForUrl(url)?.baseY ?? 0;
  clone.position.y -= baseY * scale;
  return clone;
}

/** Clone the model scaled so its measured height maps to `worldHeight`. */
export async function loadModelToHeight(
  url: string,
  worldHeight: number,
): Promise<THREE.Group> {
  const realH = manifestForUrl(url)?.dimensions.height ?? 1;
  return loadModelScaled(url, worldHeight / realH);
}

/** Back-compat: older callers pass a target height. */
export async function loadModel(
  url: string,
  targetHeight: number,
): Promise<THREE.Group> {
  return loadModelToHeight(url, targetHeight);
}

export function houseUrlForTier(tierIndex: number, salt: number): string {
  const pair = TIER_HOUSE_URLS[tierIndex] ?? TIER_HOUSE_URLS[0];
  return pair[Math.abs(salt) % pair.length];
}

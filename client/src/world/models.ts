import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

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

export const HOUSE_URLS = [
  houseA,
  houseB,
  houseC,
  houseD,
  houseE,
  houseF,
  houseG,
  houseH,
  houseI,
  houseJ,
  houseK,
  houseL,
] as const;

/** Two building types per house tier, a/b → tent … k/l → tower. */
export const TIER_HOUSE_URLS: readonly (readonly string[])[] = [
  [houseA, houseB],
  [houseC, houseD],
  [houseE, houseF],
  [houseG, houseH],
  [houseI, houseJ],
  [houseK, houseL],
];

export const TIER_HOUSE_HEIGHT = [0.75, 0.95, 1.25, 1.65, 1.9, 2.7];

export const FENCE_URLS = [fence1x4, fence2x2, fence2x3, fence3x2, fence3x3] as const;
export const PATH_SHORT_URL = pathShort;
export const PATH_LONG_URL = pathLong;
export const PATH_STONES_SHORT_URL = pathStonesShort;
export const PATH_STONES_LONG_URL = pathStonesLong;
export const PATH_STONES_MESSY_URL = pathStonesMessy;
export const PLANTER_URL = planter;

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Group>>();

function prepare(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial) {
        std.metalness = Math.min(std.metalness, 0.15);
        std.roughness = Math.max(std.roughness, 0.55);
      }
    }
  });
}

function fitFeet(root: THREE.Group, targetHeight: number): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const tall = Math.max(size.y, 1e-4);
  root.scale.multiplyScalar(targetHeight / tall);
  const fitted = new THREE.Box3().setFromObject(root);
  root.position.y -= fitted.min.y;
}

export async function loadModel(
  url: string,
  targetHeight: number,
): Promise<THREE.Group> {
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
  const src = await pending;
  const clone = src.clone(true);
  fitFeet(clone, targetHeight);
  return clone;
}

export function houseUrlForTier(tierIndex: number, salt: number): string {
  const pair = TIER_HOUSE_URLS[tierIndex] ?? TIER_HOUSE_URLS[0];
  return pair[Math.abs(salt) % pair.length];
}

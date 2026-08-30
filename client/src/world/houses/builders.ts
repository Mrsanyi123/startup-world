import * as THREE from "three";
import { HOUSE_TIERS } from "./tiers";

/**
 * The six house presets, built from three.js primitives only. One factory
 * per tier, distinct silhouettes, origin at the base (ground level), front
 * toward local -Z — same convention as the character and orientOnSurface().
 *
 * These are the ONLY house shapes (no procedural architecture, per spec).
 */

// Shared Lambert materials, cached per color.
const materialCache = new Map<number, THREE.MeshLambertMaterial>();
function mat(color: number): THREE.MeshLambertMaterial {
  let m = materialCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    materialCache.set(color, m);
  }
  return m;
}

function box(
  w: number,
  h: number,
  d: number,
  color: number,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, y, z);
  return mesh;
}

/** 4-sided pyramid roof (a cone with 4 segments, corners squared to axes). */
function pyramid(
  radius: number,
  height: number,
  color: number,
  y: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 4),
    mat(color),
  );
  mesh.rotation.y = Math.PI / 4;
  mesh.position.y = y;
  return mesh;
}

const CANVAS = 0xe8dcc0;
const WOOD_DARK = 0x6f4f33;
const WOOD = 0xa5794f;
const POLE = 0x7a5c3e;
const PLASTER = 0xecdcb4;
const TERRACOTTA = 0xc96f4a;
const BRICK = 0x9c5a44;
const DOOR = 0x503a26;
const GLASS = 0xcfe7f2;
const CREAM = 0xefe3c8;
const TRIM = 0x8a6a4a;
const COLUMN = 0xf7f1e2;
const SLATE = 0x7d95a8;
const SLATE_LIGHT = 0x91a9bc;

function buildTent(): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const panel = box(0.66, 0.05, 0.85, CANVAS, 0.22 * side, 0.3, 0);
    panel.rotation.z = side * 1.0;
    g.add(panel);
  }
  const ridge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.95, 6),
    mat(POLE),
  );
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = 0.58;
  g.add(ridge);
  return g;
}

function buildShack(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.7, 0.5, 0.6, WOOD, 0, 0.25, 0));
  const roof = box(0.85, 0.05, 0.72, WOOD_DARK, -0.03, 0.56, 0);
  roof.rotation.z = 0.2;
  g.add(roof);
  g.add(box(0.16, 0.3, 0.02, DOOR, 0, 0.15, -0.31));
  return g;
}

function buildCottage(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.9, 0.55, 0.7, PLASTER, 0, 0.275, 0));
  g.add(pyramid(0.68, 0.45, TERRACOTTA, 0.775));
  g.add(box(0.12, 0.3, 0.12, BRICK, 0.28, 0.85, 0.15));
  g.add(box(0.18, 0.32, 0.02, DOOR, -0.15, 0.16, -0.36));
  g.add(box(0.18, 0.16, 0.02, GLASS, 0.22, 0.34, -0.36));
  return g;
}

function buildHouse(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.1, 1.05, 0.8, 0xdcc59c, 0, 0.525, 0));
  g.add(box(1.14, 0.04, 0.84, 0xb09774, 0, 0.55, 0)); // floor divider trim
  g.add(pyramid(0.85, 0.5, 0xa3573c, 1.3));
  g.add(box(0.2, 0.38, 0.02, DOOR, 0, 0.19, -0.41));
  for (const side of [-1, 1]) {
    g.add(box(0.2, 0.2, 0.02, GLASS, 0.27 * side, 0.78, -0.41));
  }
  return g;
}

function buildMansion(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.0, 1.2, 0.7, CREAM, 0, 0.6, 0));
  g.add(box(1.06, 0.07, 0.76, TRIM, 0, 1.235, 0));
  g.add(box(0.6, 0.32, 0.5, CREAM, 0, 1.43, 0)); // small upper block
  g.add(box(0.66, 0.06, 0.56, TRIM, 0, 1.62, 0));
  for (const side of [-1, 1]) {
    g.add(box(0.55, 0.65, 0.6, CREAM, 0.75 * side, 0.325, 0));
    g.add(box(0.6, 0.06, 0.66, TRIM, 0.75 * side, 0.685, 0));
  }
  // Colonnade + portico slab at the entrance.
  for (const x of [-0.3, -0.1, 0.1, 0.3]) {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8),
      mat(COLUMN),
    );
    column.position.set(x, 0.25, -0.42);
    g.add(column);
  }
  g.add(box(0.8, 0.05, 0.2, TRIM, 0, 0.53, -0.42));
  g.add(box(0.2, 0.36, 0.02, DOOR, 0, 0.18, -0.36));
  return g;
}

function buildTower(): THREE.Group {
  const g = new THREE.Group();
  const stories: Array<[number, number, number]> = [
    [0.75, 1.0, 0.5], // [width/depth, height, centerY]
    [0.65, 0.95, 1.475],
    [0.55, 0.9, 2.4],
  ];
  stories.forEach(([w, h, y], i) => {
    g.add(box(w, h, w, i % 2 === 0 ? SLATE : SLATE_LIGHT, 0, y, 0));
    g.add(box(w + 0.02, 0.08, w + 0.02, GLASS, 0, y, 0)); // window band
  });
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6),
    mat(0x3a3129),
  );
  antenna.position.y = 3.05;
  g.add(antenna);
  return g;
}

const BUILDERS: ReadonlyArray<() => THREE.Group> = [
  buildTent,
  buildShack,
  buildCottage,
  buildHouse,
  buildMansion,
  buildTower,
];

export function buildHouseForTier(tierIndex: number): THREE.Group {
  const builder = BUILDERS[tierIndex] ?? BUILDERS[0];
  return builder();
}

/** Simple scaffold sized to the incoming tier, for the construction beat. */
export function buildScaffold(tierIndex: number): THREE.Group {
  const g = new THREE.Group();
  const height = Math.min(HOUSE_TIERS[tierIndex]?.height ?? 0.6, 1.6);
  const half = 0.42;
  const poleGeometry = new THREE.CylinderGeometry(0.025, 0.025, height, 6);
  for (const [x, z] of [
    [-half, -half],
    [-half, half],
    [half, -half],
    [half, half],
  ]) {
    const pole = new THREE.Mesh(poleGeometry, mat(POLE));
    pole.position.set(x, height / 2, z);
    g.add(pole);
  }
  // Cross planks.
  g.add(box(half * 2 + 0.1, 0.05, 0.12, WOOD, 0, height * 0.55, -half));
  g.add(box(half * 2 + 0.1, 0.05, 0.12, WOOD, 0, height * 0.85, half));
  g.add(box(0.12, 0.05, half * 2 + 0.1, WOOD, half, height * 0.7, 0));
  // A crate of "materials".
  g.add(box(0.22, 0.22, 0.22, WOOD_DARK, -0.2, 0.11, 0.1));
  return g;
}

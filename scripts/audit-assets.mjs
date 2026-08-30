// Asset audit (Prompt 04b, step 1).
//
// Loads every .glb under models/, measures its real bounding-box dimensions
// (world space, after applying node transforms), classifies its pivot as
// "base" (origin at the object's foot, min.y ~= 0) or "center", and records
// whether it carries a color texture/material. Emits a structured manifest to
// shared/src/assetManifest.ts so placement/scaling/fencing read measured data
// instead of guessed constants.
//
// Run: node scripts/audit-assets.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODELS_DIR = path.join(ROOT, "models");

// ---- minimal glb reader ---------------------------------------------------
function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`not a glb: ${file}`);
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  return { json, bin };
}

// ---- minimal column-major mat4 --------------------------------------------
function identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
function multiply(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function fromTRS(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const [sx, sy, sz] = s;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1,
  ];
}
function nodeMatrix(node) {
  if (node.matrix) return node.matrix.slice();
  return fromTRS(node.translation, node.rotation, node.scale);
}
function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

// ---- bounding box over the whole scene ------------------------------------
function corners(min, max) {
  const out = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]]) out.push([x, y, z]);
  return out;
}

function measure(json) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let hasTexture = false;

  const materials = json.materials || [];
  const textureCount = (json.textures || []).length;

  const scene = json.scenes?.[json.scene ?? 0] ?? { nodes: [] };
  const walk = (idx, parent) => {
    const node = json.nodes[idx];
    const world = multiply(parent, nodeMatrix(node));
    if (node.mesh !== undefined) {
      for (const prim of json.meshes[node.mesh].primitives) {
        const acc = json.accessors[prim.attributes.POSITION];
        if (!acc?.min || !acc?.max) continue;
        for (const corner of corners(acc.min, acc.max)) {
          const w = transformPoint(world, corner);
          for (let i = 0; i < 3; i++) {
            if (w[i] < min[i]) min[i] = w[i];
            if (w[i] > max[i]) max[i] = w[i];
          }
        }
        const mat = materials[prim.material];
        if (mat?.pbrMetallicRoughness?.baseColorTexture || textureCount > 0) {
          if (prim.attributes.TEXCOORD_0 !== undefined) hasTexture = true;
        }
      }
    }
    for (const child of node.children || []) walk(child, world);
  };
  for (const n of scene.nodes || []) walk(n, identity());

  return { min, max, hasTexture };
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

// ---- enumerate models -----------------------------------------------------
function listGlb(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listGlb(full));
    else if (entry.name.endsWith(".glb")) out.push(full);
  }
  return out;
}

const files = listGlb(MODELS_DIR).sort();
const entries = {};
const table = [];

for (const file of files) {
  const rel = "/" + path.relative(ROOT, file).split(path.sep).join("/");
  const { json } = readGlb(file);
  const { min, max, hasTexture } = measure(json);
  const width = round(max[0] - min[0]);
  const height = round(max[1] - min[1]);
  const depth = round(max[2] - min[2]);
  // Pivot: base if the model's lowest point sits at (or just below) y=0.
  const pivot = Math.abs(min[1]) <= Math.max(0.02, height * 0.08) ? "base" : "center";
  const key = path
    .basename(file, ".glb")
    .replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();
  entries[key] = {
    path: rel,
    dimensions: { width, height, depth },
    pivot,
    textured: hasTexture,
    baseY: round(min[1]),
  };
  table.push({ key, width, height, depth, pivot, textured: hasTexture, baseY: round(min[1]) });
}

console.table(table);

// ---- emit manifest --------------------------------------------------------
const header = `// AUTO-GENERATED by scripts/audit-assets.mjs — do not edit by hand.
// Real measured dimensions (world units), pivot, and texture presence for
// every .glb in /models. Placement, scaling, and fencing read from here so
// nothing is a guessed constant (Prompt 04b, step 1).

export type Pivot = "base" | "center";

export interface AssetEntry {
  /** Path relative to the repo root (matches the ?url import in models.ts). */
  readonly path: string;
  /** Real bounding-box size in the model's own units. */
  readonly dimensions: { readonly width: number; readonly height: number; readonly depth: number };
  /** "base" = origin at the foot (y=0 sits on the ground); "center" = mid-height. */
  readonly pivot: Pivot;
  /** Whether the model carries a color texture (Kenney colormap atlas). */
  readonly textured: boolean;
  /** Measured min.y in model space (grounding offset reference). */
  readonly baseY: number;
}
`;

const body =
  "export const ASSET_MANIFEST = {\n" +
  Object.entries(entries)
    .map(([k, v]) => `  "${k}": ${JSON.stringify(v)},`)
    .join("\n") +
  "\n} as const satisfies Record<string, AssetEntry>;\n\nexport type AssetKey = keyof typeof ASSET_MANIFEST;\n";

const outFile = path.join(ROOT, "shared", "src", "assetManifest.ts");
fs.writeFileSync(outFile, header + "\n" + body);
console.log(`\nWrote ${outFile} (${files.length} models).`);

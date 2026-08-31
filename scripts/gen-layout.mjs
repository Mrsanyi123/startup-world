// Design-time layout author (Prompt 04b, step 5).
//
// Produces a FIXED, hand-authored layout — 32 plot positions and a list of
// straight road segments — and freezes it to shared/src/layout.ts as data.
// Plots are placed as houses along streets: each plot sits a fixed clearance
// off a road centerline, so by construction no plot footprint (house + fence)
// can overlap a road. The script validates every clearance before writing.
//
// Conceptual sketch:
//   - One RING road around the equator; 12 rungs, a plot on each side (24).
//   - Two SPUR streets (north @ lon45, south @ lon225) branching off the ring
//     toward the poles; 2 rungs each, a plot on each side (8).
//   => 3 connected clusters (ring + two cul-de-sacs), 32 plots total.
//
// Run: node scripts/gen-layout.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = 20;

// Reserved footprint (house + fence) and road half-width drive the geometry.
const FOOTPRINT = 3.8; // max tier-5 house + fence ring, world units
const ROAD_HALF = 0.5;
const MARGIN = 0.4;
const PLOT_OFFSET = FOOTPRINT + ROAD_HALF + MARGIN; // 4.7 — plot center off centerline
const MIN_PLOT_GAP = 2 * FOOTPRINT; // 7.6 — house-to-house
const ROAD_STEP = 1.8; // spacing of road pieces along a street

// ---- vector helpers -------------------------------------------------------
const v = (x, y, z) => ({ x, y, z });
const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, s) => v(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) =>
  v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const dist = (a, b) => len(sub(a, b));

function dir(latDeg, lonDeg) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return v(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon),
  );
}
/** Great-circle interpolation between two unit dirs. */
function slerp(a, b, t) {
  const d = Math.min(1, Math.max(-1, dot(a, b)));
  const o = Math.acos(d);
  if (o < 1e-6) return norm(a);
  const s = Math.sin(o);
  return norm(add(mul(a, Math.sin((1 - t) * o) / s), mul(b, Math.sin(t * o) / s)));
}
/** Unit tangent along the a→b arc at parameter t. */
function tangent(a, b, t) {
  const p0 = slerp(a, b, Math.max(0, t - 0.001));
  const p1 = slerp(a, b, Math.min(1, t + 0.001));
  return norm(sub(p1, p0));
}
/** Geodesic offset of surface point `p` (unit) by `world` units along tangent-perp. */
function offset(pUnit, sideUnit, world) {
  const a = world / R;
  return norm(add(mul(pUnit, Math.cos(a)), mul(sideUnit, Math.sin(a))));
}

// ---- street definitions (authored) ---------------------------------------
// Each street: an arc (from→to) plus rung parameters where plots are placed.
const streets = [
  // RING: equator, 12 rungs spaced 30° — represented as 12 short arcs so the
  // road wraps the whole planet. Plots on both (north/south) sides.
  ...Array.from({ length: 12 }, (_, k) => ({
    from: dir(0, k * 30),
    to: dir(0, (k + 1) * 30),
    rungs: [0], // one rung at the arc start
    bothSides: true,
    road: true,
  })),
  // North spur off the ring at lon 45, up toward the pole.
  { from: dir(30, 45), to: dir(74, 45), rungs: [0.26, 0.9], bothSides: true, road: true },
  // South spur off the ring at lon 225.
  { from: dir(-30, 225), to: dir(-74, 225), rungs: [0.26, 0.9], bothSides: true, road: true },
  // Connector roads linking the ring to each spur base (roads only, no plots).
  { from: dir(0, 45), to: dir(30, 45), rungs: [], bothSides: false, road: true },
  { from: dir(0, 225), to: dir(-30, 225), rungs: [], bothSides: false, road: true },
];

// ---- build plots + road centerline ----------------------------------------
const plots = [];
const roadPieces = [];
const centerline = []; // dense samples for clearance validation

for (const st of streets) {
  const arcLen = Math.acos(Math.min(1, Math.max(-1, dot(st.from, st.to)))) * R;

  // road pieces along the arc
  if (st.road) {
    const steps = Math.max(1, Math.round(arcLen / ROAD_STEP));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = slerp(st.from, st.to, t);
      roadPieces.push({ pos: mul(p, R), tan: tangent(st.from, st.to, t) });
    }
  }
  // dense centerline samples
  {
    const steps = Math.max(2, Math.round(arcLen / 0.5));
    for (let i = 0; i <= steps; i++) centerline.push(mul(slerp(st.from, st.to, i / steps), R));
  }
  // plots at rungs, offset to the side(s)
  for (const rt of st.rungs) {
    const p = slerp(st.from, st.to, rt);
    const t = tangent(st.from, st.to, rt);
    const side = norm(cross(p, t)); // perpendicular, in the tangent plane
    const sides = st.bothSides ? [1, -1] : [1];
    for (const s of sides) {
      const pu = offset(p, mul(side, s), PLOT_OFFSET);
      plots.push(mul(pu, R));
    }
  }
}

if (plots.length !== 32) {
  console.error(`Expected 32 plots, got ${plots.length}. Adjust street rungs.`);
}

// ---- validation -----------------------------------------------------------
let violations = 0;
// plot vs road centerline
for (let i = 0; i < plots.length; i++) {
  let minD = Infinity;
  for (const c of centerline) minD = Math.min(minD, dist(plots[i], c));
  const need = FOOTPRINT + ROAD_HALF;
  if (minD < need) {
    violations++;
    console.error(`plot ${i}: ${minD.toFixed(2)} from road < ${need} (need clearance)`);
  }
}
// plot vs plot
for (let i = 0; i < plots.length; i++) {
  for (let j = i + 1; j < plots.length; j++) {
    const d = dist(plots[i], plots[j]);
    if (d < MIN_PLOT_GAP) {
      violations++;
      console.error(`plots ${i},${j}: ${d.toFixed(2)} < ${MIN_PLOT_GAP} (house overlap)`);
    }
  }
}
console.log(
  `\nplots=${plots.length} roadPieces=${roadPieces.length} centerlineSamples=${centerline.length} violations=${violations}`,
);
const minRoad = Math.min(
  ...plots.map((p) => Math.min(...centerline.map((c) => dist(p, c)))),
);
const minPP = Math.min(
  ...plots.flatMap((p, i) => plots.slice(i + 1).map((q) => dist(p, q))),
);
console.log(`min plot→road = ${minRoad.toFixed(2)} (need ≥ ${(FOOTPRINT + ROAD_HALF).toFixed(2)})`);
console.log(`min plot→plot = ${minPP.toFixed(2)} (need ≥ ${MIN_PLOT_GAP.toFixed(2)})`);

if (violations > 0) {
  console.error("\nLayout has violations — not writing. Tune streets and rerun.");
  process.exit(1);
}

// ---- emit shared/src/layout.ts -------------------------------------------
const r4 = (n) => Math.round(n * 1e4) / 1e4;
const vec = (a) => `{ x: ${r4(a.x)}, y: ${r4(a.y)}, z: ${r4(a.z)} }`;

const out = `// AUTO-GENERATED by scripts/gen-layout.mjs — do not edit by hand.
// Fixed, hand-authored planet layout (Prompt 04b, step 5): a deliberate list
// of ${plots.length} plot positions and ${roadPieces.length} straight road segments, designed together so
// no plot footprint (house + fence) overlaps a road. These are DATA, not
// computed at runtime.
import type { Vec3 } from "./types";

/** Planet radius (kept in sync with plots.ts / constants.ts). */
export const LAYOUT_RADIUS = ${R};

/** Reserved space per plot: max tier-5 house + fence ring, world units. */
export const PLOT_FOOTPRINT_RADIUS = ${FOOTPRINT};

/** Road half-width (world units) for the scaled path pieces. */
export const ROAD_HALF_WIDTH = ${ROAD_HALF};

/**
 * Interaction range for "press E to claim", derived from the fixed footprint
 * so the trigger tracks the authored spacing rather than old scatter logic.
 */
export const PLOT_CLAIM_RANGE = ${r4(FOOTPRINT * 0.85)};

/** Fixed plot centers on the sphere (|p| == LAYOUT_RADIUS). */
export const PLOT_POSITIONS: readonly Vec3[] = [
${plots.map((p) => `  ${vec(p)},`).join("\n")}
];

/** A straight road segment: where to place a path piece and its heading. */
export interface RoadSegment {
  /** Center on the sphere surface. */
  readonly position: Vec3;
  /** Unit tangent the piece's length runs along. */
  readonly tangent: Vec3;
}

export const ROAD_SEGMENTS: readonly RoadSegment[] = [
${roadPieces.map((p) => `  { position: ${vec(p.pos)}, tangent: ${vec(p.tan)} },`).join("\n")}
];
`;

const outFile = path.join(ROOT, "shared", "src", "layout.ts");
fs.writeFileSync(outFile, out);
console.log(`\nWrote ${outFile}`);

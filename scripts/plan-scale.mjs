// Design-time helper: choose house world scale + tier→model assignment from
// measured dimensions, and print resulting world sizes + footprints so the
// numbers going into code are grounded (not guessed).
import { ASSET_MANIFEST } from "../shared/src/assetManifest.ts";

const CHAR_H = 0.85;
const FENCE_CLEARANCE = 0.7; // world gap between house wall and fence ring

const houses = Object.entries(ASSET_MANIFEST)
  .filter(([k]) => k.startsWith("building_type_"))
  .map(([k, v]) => ({ k, ...v.dimensions }))
  .sort((a, b) => a.height - b.height);

// Smallest building should read clearly bigger than the character.
const smallest = houses[0];
const S = (CHAR_H * 1.9) / smallest.height; // base model→world scale
const tierMult = [1.0, 1.06, 1.12, 1.19, 1.27, 1.36];

console.log(`character height = ${CHAR_H}`);
console.log(`smallest building = ${smallest.k} (h=${smallest.height})`);
console.log(`base scale S = ${S.toFixed(3)}  → smallest world height = ${(smallest.height * S).toFixed(2)}\n`);

// Assign two smallest→tier0 … two largest→tier5 (real growth via model size).
const pairs = [];
for (let t = 0; t < 6; t++) pairs.push([houses[t * 2], houses[t * 2 + 1]]);

let maxFoot = 0;
const rows = [];
for (let t = 0; t < 6; t++) {
  for (const h of pairs[t]) {
    const sc = S * tierMult[t];
    const wH = h.height * sc;
    const wW = h.width * sc;
    const wD = h.depth * sc;
    const foot = 0.5 * Math.hypot(wW, wD) + FENCE_CLEARANCE;
    maxFoot = Math.max(maxFoot, foot);
    rows.push({
      tier: t,
      model: h.k,
      scale: +sc.toFixed(2),
      worldH: +wH.toFixed(2),
      worldW: +wW.toFixed(2),
      footR: +foot.toFixed(2),
      vsChar: +(wH / CHAR_H).toFixed(2),
    });
  }
}
console.table(rows);
console.log(`\nmax footprint radius (incl fence clearance) = ${maxFoot.toFixed(2)}`);
console.log("tier→model pairs:", pairs.map((p, t) => `t${t}:${p.map((x) => x.k.replace("building_type_", "")).join("/")}`).join("  "));

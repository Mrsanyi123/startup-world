import * as THREE from "three";
import { ROAD_SEGMENTS } from "@startup-village/shared";
import type { WorldPlot } from "../net/plots";
import { offsetOnSurface } from "./surface";
import {
  FENCE_RAIL_URL,
  houseFootprintRadius,
  houseUrlForTier,
  loadModelScaled,
  manifestForUrl,
} from "./models";

/**
 * A low garden fence ringing every CLAIMED plot (Prompt 04b, step 4). The ring
 * radius is derived from the house's real footprint (not a guessed constant),
 * each rail is oriented outward on the surface normal, and an entrance gap is
 * left facing the nearest road segment.
 */

const REF_Y = new THREE.Vector3(0, 1, 0);
const REF_X = new THREE.Vector3(1, 0, 0);
const FENCE_WORLD_HEIGHT = 0.5; // low, waist-high next to the houses
const RING_MARGIN = 0.45; // gap between house wall and the fence ring
const ENTRANCE_HALF_ANGLE = Math.PI / 5; // ~36° opening toward the road

/** Tangent frame matching offsetOnSurface's internal (right, forward, up). */
function plotFrame(pos: THREE.Vector3): {
  up: THREE.Vector3;
  right: THREE.Vector3;
  forward: THREE.Vector3;
} {
  const up = pos.clone().normalize();
  const ref = Math.abs(up.y) < 0.99 ? REF_Y : REF_X;
  const forward = ref.clone().addScaledVector(up, -up.dot(ref)).normalize();
  const right = new THREE.Vector3().crossVectors(forward, up);
  return { up, right, forward };
}

/** Precompute road segment centers once for nearest-road lookup. */
const ROAD_POINTS = ROAD_SEGMENTS.map(
  (s) => new THREE.Vector3(s.position.x, s.position.y, s.position.z),
);

function nearestRoadAngle(pos: THREE.Vector3): number {
  let best = Infinity;
  let bestPoint = ROAD_POINTS[0];
  for (const p of ROAD_POINTS) {
    const d = p.distanceToSquared(pos);
    if (d < best) {
      best = d;
      bestPoint = p;
    }
  }
  const { up, right, forward } = plotFrame(pos);
  const dir = bestPoint.clone().sub(pos);
  dir.addScaledVector(up, -dir.dot(up)); // project into tangent plane
  return Math.atan2(dir.dot(forward), dir.dot(right));
}

function railUrlForPlot(plot: WorldPlot): { url: string; tier: number } {
  const tier = plot.tierIndex ?? 0;
  return { url: houseUrlForTier(tier, plotSalt(plot.id)), tier };
}

function plotSalt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface Fences {
  group: THREE.Group;
  sync(plots: readonly WorldPlot[]): void;
}

export function createFences(): Fences {
  const group = new THREE.Group();
  const rings = new Map<string, { root: THREE.Group; key: string }>();

  const railEntry = manifestForUrl(FENCE_RAIL_URL)?.dimensions ?? {
    width: 1.675,
    height: 0.27,
    depth: 0.438,
  };
  const railScale = FENCE_WORLD_HEIGHT / railEntry.height;
  const railLength = railEntry.width * railScale;

  function buildRing(plot: WorldPlot): THREE.Group {
    const root = new THREE.Group();
    const center = plot.position;
    const { url, tier } = railUrlForPlot(plot);
    const ringR = houseFootprintRadius(url, tier) + RING_MARGIN;
    const roadAngle = nearestRoadAngle(center);

    const count = Math.max(6, Math.round((2 * Math.PI * ringR) / railLength));
    for (let k = 0; k < count; k++) {
      const theta = (k / count) * Math.PI * 2;
      // Skip the rails whose arc faces the road → leaves an entrance gap.
      let diff = Math.abs(theta - (roadAngle + Math.PI * 2)) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < ENTRANCE_HALF_ANGLE) continue;

      const railPos = offsetOnSurface(
        center,
        Math.cos(theta) * ringR,
        Math.sin(theta) * ringR,
      );
      const nextPos = offsetOnSurface(
        center,
        Math.cos(theta + 0.06) * ringR,
        Math.sin(theta + 0.06) * ringR,
      );
      const up = railPos.clone().normalize();
      const tangent = nextPos.clone().sub(railPos);
      tangent.addScaledVector(up, -tangent.dot(up)).normalize();
      const zAxis = new THREE.Vector3().crossVectors(tangent, up);
      const basis = new THREE.Matrix4().makeBasis(tangent, up, zAxis);
      const quat = new THREE.Quaternion().setFromRotationMatrix(basis);

      void loadModelScaled(FENCE_RAIL_URL, railScale)
        .then((rail) => {
          rail.position.copy(railPos);
          rail.quaternion.copy(quat);
          root.add(rail);
        })
        .catch(() => {});
    }
    return root;
  }

  return {
    group,
    sync(plots: readonly WorldPlot[]) {
      const seen = new Set<string>();
      for (const plot of plots) {
        if (plot.status !== "claimed") continue;
        seen.add(plot.id);
        // Rebuild when the tier changes (ring radius tracks the house size).
        const key = `${plot.tierIndex ?? "none"}`;
        const existing = rings.get(plot.id);
        if (existing && existing.key === key) continue;
        if (existing) group.remove(existing.root);
        const root = buildRing(plot);
        group.add(root);
        rings.set(plot.id, { root, key });
      }
      for (const [id, ring] of rings) {
        if (!seen.has(id)) {
          group.remove(ring.root);
          rings.delete(id);
        }
      }
    },
  };
}

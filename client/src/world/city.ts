import * as THREE from "three";
import {
  PLANET_RADIUS,
  RESERVED_PLOT_IDS,
  fibonacciSpherePoint,
  plotLayout,
} from "@startup-village/shared";
import { offsetOnSurface, orientOnSurface, slerpOnSurface } from "./surface";
import {
  FENCE_URLS,
  HOUSE_URLS,
  PATH_LONG_URL,
  PATH_SHORT_URL,
  PATH_STONES_LONG_URL,
  PATH_STONES_MESSY_URL,
  PATH_STONES_SHORT_URL,
  PLANTER_URL,
  TIER_HOUSE_HEIGHT,
  loadModel,
} from "./models";

/**
 * Scenic village dressing: extra GLB houses, occasional fences, and paths
 * between reserved plots. Not claimable — plot houses stay in houses.ts.
 */

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function place(
  obj: THREE.Object3D,
  position: THREE.Vector3,
  yaw = 0,
): void {
  obj.position.copy(position);
  obj.quaternion.copy(orientOnSurface(position));
  if (yaw !== 0) obj.rotateY(yaw);
}

export function createCity(): THREE.Group {
  const group = new THREE.Group();
  void populate(group);
  return group;
}

async function populate(group: THREE.Group): Promise<void> {
  const reserved = new Set(RESERVED_PLOT_IDS);
  const plots = plotLayout().map((p) => ({
    ...p,
    position: new THREE.Vector3(p.position.x, p.position.y, p.position.z),
    reserved: reserved.has(p.id),
  }));
  const village = plots.filter((p) => p.reserved);

  const jobs: Promise<void>[] = [];

  function add(
    url: string,
    height: number,
    position: THREE.Vector3,
    yaw: number,
  ): void {
    jobs.push(
      loadModel(url, height)
        .then((mesh) => {
          place(mesh, position, yaw);
          group.add(mesh);
        })
        .catch(() => {
          /* skip a missing piece rather than blank the city */
        }),
    );
  }

  for (let i = 0; i < village.length; i++) {
    const plot = village[i];
    const h = hash(i + 3);
    const satellites = 2 + Math.floor(hash(i + 11) * 3);
    for (let s = 0; s < satellites; s++) {
      const ang = (s / satellites) * Math.PI * 2 + h * 1.7;
      const dist = 1.35 + hash(i * 17 + s) * 0.85;
      const pos = offsetOnSurface(
        plot.position,
        Math.cos(ang) * dist,
        Math.sin(ang) * dist,
      );
      const url = HOUSE_URLS[(i * 3 + s) % HOUSE_URLS.length];
      const height = TIER_HOUSE_HEIGHT[(i + s) % TIER_HOUSE_HEIGHT.length] * 0.82;
      add(url, height, pos, ang + 0.4);
    }

    if (hash(i + 41) > 0.38) {
      const fenceUrl = FENCE_URLS[i % FENCE_URLS.length];
      const sides = 4;
      const radius = 0.95 + hash(i + 2) * 0.2;
      for (let s = 0; s < sides; s++) {
        const ang = (s / sides) * Math.PI * 2 + 0.2;
        const pos = offsetOnSurface(
          plot.position,
          Math.cos(ang) * radius,
          Math.sin(ang) * radius,
        );
        add(fenceUrl, 0.38, pos, ang + Math.PI / 2);
      }
    }

    if (hash(i + 71) > 0.35) {
      const planterPos = offsetOnSurface(
        plot.position,
        (hash(i) - 0.5) * 1.1,
        0.7 + hash(i + 5) * 0.4,
      );
      add(PLANTER_URL, 0.28, planterPos, h * Math.PI);
    }
  }

  for (let i = 0; i < village.length; i++) {
    const a = village[i];
    let best: (typeof village)[0] | null = null;
    let bestD = 7.2;
    for (let j = 0; j < village.length; j++) {
      if (i >= j) continue;
      const d = a.position.distanceTo(village[j].position);
      if (d > 2.4 && d < bestD) {
        bestD = d;
        best = village[j];
      }
    }
    if (!best) continue;
    const steps = Math.max(2, Math.round(bestD / 0.85));
    const stones = hash(i + 19) > 0.45;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const pos = slerpOnSurface(a.position, best.position, t);
      const url = stones
        ? s % 2 === 0
          ? PATH_STONES_SHORT_URL
          : PATH_STONES_LONG_URL
        : s % 2 === 0
          ? PATH_SHORT_URL
          : PATH_LONG_URL;
      add(url, 0.08, pos, t * 0.3);
    }
  }

  for (let i = 0; i < 40; i++) {
    const p = fibonacciSpherePoint(i, 40, PLANET_RADIUS);
    const pos = new THREE.Vector3(p.x, p.y, p.z);
    const tooClose = plots.some(
      (plot) => plot.position.distanceTo(pos) < (plot.reserved ? 1.15 : 1.55),
    );
    if (tooClose) continue;
    const url = HOUSE_URLS[i % HOUSE_URLS.length];
    const height = TIER_HOUSE_HEIGHT[i % TIER_HOUSE_HEIGHT.length] * 0.78;
    add(url, height, pos, hash(i + 99) * Math.PI * 2);
    if (hash(i + 23) > 0.55) {
      add(
        PATH_STONES_MESSY_URL,
        0.07,
        offsetOnSurface(pos, 0.55, 0.1),
        hash(i) * 2,
      );
    }
    if (hash(i + 53) > 0.7) {
      add(FENCE_URLS[i % FENCE_URLS.length], 0.34, offsetOnSurface(pos, 0.7, -0.15), 0.6);
    }
  }

  await Promise.all(jobs);
}

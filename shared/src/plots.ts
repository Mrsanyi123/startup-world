import type { Vec3 } from "./types";
import { PLOT_POSITIONS } from "./layout";

/**
 * Shared planet layout. Client and server both import this so plot markers
 * and the Postgres seed cannot drift.
 *
 * Plot positions are a FIXED, hand-authored list (see layout.ts / Prompt 04b
 * step 5) designed together with the roads so nothing overlaps. The old
 * Fibonacci-sphere helper is retained only for incidental sampling.
 */
export const PLANET_RADIUS = 20;
export const PLOT_COUNT = PLOT_POSITIONS.length;

export function plotId(index: number): string {
  return `plot-${index}`;
}

export function fibonacciSpherePoint(
  index: number,
  count: number = PLOT_COUNT,
  radius: number = PLANET_RADIUS,
): Vec3 {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (2 * (index + 0.5)) / count;
  const ringRadius = Math.sqrt(1 - y * y);
  const theta = goldenAngle * index;
  return {
    x: Math.cos(theta) * ringRadius * radius,
    y: y * radius,
    z: Math.sin(theta) * ringRadius * radius,
  };
}

/**
 * The canonical plot list: fixed authored positions (layout.ts), one per id
 * `plot-0` … `plot-{N-1}`. Used by the client renderer, the demo store, and
 * the Postgres seed alike.
 */
export function plotLayout(): { id: string; position: Vec3 }[] {
  return PLOT_POSITIONS.map((position, i) => ({
    id: plotId(i),
    position: { x: position.x, y: position.y, z: position.z },
  }));
}

import type { Vec3 } from "./types";

/**
 * Shared planet layout. Client and server both import this so plot markers
 * and the Postgres seed cannot drift.
 *
 * Fibonacci sphere: N points spread evenly over the sphere with zero
 * randomness. Independent random x/y/z would cluster at the poles.
 */
export const PLANET_RADIUS = 20;
export const PLOT_COUNT = 32;

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

export function plotLayout(
  count: number = PLOT_COUNT,
  radius: number = PLANET_RADIUS,
): { id: string; position: Vec3 }[] {
  return Array.from({ length: count }, (_, i) => ({
    id: plotId(i),
    position: fibonacciSpherePoint(i, count, radius),
  }));
}

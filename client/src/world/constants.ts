import { PLANET_RADIUS as SHARED_RADIUS } from "@startup-village/shared";

/**
 * World constants for the tiny planet. Everything that positions or orients
 * an object on the planet must import from here — no scattered magic numbers.
 *
 * Coordinate conventions:
 * - The planet mesh is centered at the world origin (0, 0, 0).
 * - The walkable surface is a *perfect* sphere: every walkable point `p`
 *   satisfies `p.length() === PLANET_RADIUS`. Visual-only layers (clouds,
 *   atmosphere) may be larger, but nothing walkable ever leaves this radius.
 * - Local "up" at any surface point is `normalize(point)` — the direction
 *   from the planet's center out through that point. There is no world-space
 *   "down"; anything gravity-like always points toward the origin.
 *
 * Radius lives in `shared/` so the server seed uses the same sphere as the client.
 */
export const PLANET_RADIUS = SHARED_RADIUS;

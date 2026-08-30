import type { HouseTier } from "./types";

/**
 * Discrete house tiers. Thresholds are cents ($0, $100, $1k, $5k, $20k, $50k).
 * A connected plot at $0 still gets a tent; unclaimed plots stay empty.
 */
export const HOUSE_TIERS: readonly HouseTier[] = [
  { tierIndex: 0, label: "tent", mrrThresholdCents: 0, modelRef: "tent" },
  {
    tierIndex: 1,
    label: "shack",
    mrrThresholdCents: 10_000,
    modelRef: "shack",
  },
  {
    tierIndex: 2,
    label: "cottage",
    mrrThresholdCents: 100_000,
    modelRef: "cottage",
  },
  {
    tierIndex: 3,
    label: "house",
    mrrThresholdCents: 500_000,
    modelRef: "house",
  },
  {
    tierIndex: 4,
    label: "mansion",
    mrrThresholdCents: 2_000_000,
    modelRef: "mansion",
  },
  {
    tierIndex: 5,
    label: "tower",
    mrrThresholdCents: 5_000_000,
    modelRef: "tower",
  },
];

/** Highest tier whose threshold is <= mrrCents. Null only when there is no MRR snapshot. */
export function tierForMrr(mrrCents: number | null): HouseTier | null {
  if (mrrCents === null) return null;
  let current = HOUSE_TIERS[0];
  for (const tier of HOUSE_TIERS) {
    if (mrrCents >= tier.mrrThresholdCents) current = tier;
  }
  return current;
}

/**
 * Static house-tier reference data (About.md §7). Discrete tiers only — the
 * house for a plot is always exactly one of these, chosen by CURRENT MRR
 * (dropping MRR shrinks the house).
 */

export interface HouseTier {
  tierIndex: number;
  label: string;
  /** Minimum MRR (in cents) to unlock this tier. */
  mrrThresholdCents: number;
  /** Rough built height, used for scaffold sizing and nameplate offsets. */
  height: number;
}

export const HOUSE_TIERS: readonly HouseTier[] = [
  { tierIndex: 0, label: "tent", mrrThresholdCents: 0, height: 0.62 },
  { tierIndex: 1, label: "shack", mrrThresholdCents: 10_000, height: 0.66 },
  { tierIndex: 2, label: "cottage", mrrThresholdCents: 100_000, height: 1.1 },
  { tierIndex: 3, label: "house", mrrThresholdCents: 500_000, height: 1.55 },
  { tierIndex: 4, label: "mansion", mrrThresholdCents: 2_000_000, height: 1.65 },
  { tierIndex: 5, label: "tower", mrrThresholdCents: 5_000_000, height: 3.1 },
];

/** Highest tier whose threshold the given MRR meets. */
export function tierForMrr(mrrCents: number): HouseTier {
  let current = HOUSE_TIERS[0];
  for (const tier of HOUSE_TIERS) {
    if (mrrCents >= tier.mrrThresholdCents) current = tier;
  }
  return current;
}

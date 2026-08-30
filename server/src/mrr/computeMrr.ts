/**
 * Isolated MRR engine. This is the only place monthly recurring revenue is
 * defined. UI and Stripe/Polar adapters must normalize into SubscriptionInput
 * and call computeMrr — they must not invent their own math.
 *
 * No I/O. No provider "mrr" field. USD only; no FX.
 *
 * Rounding: included rows are converted to monthly **floats**, **summed**,
 * then rounded once with Math.round (nearest cent, half away from zero per
 * IEEE 754 except ties-to-even on .5). Tests lock the resulting integers.
 */

export type Interval = "day" | "week" | "month" | "year";
export type Status =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

export type SubscriptionInput = {
  status: Status;
  cancelAtPeriodEnd: boolean;
  /** If canceled-at-period-end, still paying until this instant. */
  currentPeriodEnd: Date | null;
  /** Lowercase ISO currency code. */
  currency: string;
  /** Current price in cents (after proration / new plan). */
  unitAmountCents: number;
  interval: Interval;
  /** e.g. 3 + month = quarterly. */
  intervalCount: number;
};

export type SkipReason =
  | "non_usd"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "incomplete"
  | "canceled_expired"
  | "canceled_no_end"
  | "cancel_at_period_end_expired"
  | "cancel_at_period_end_no_end"
  | "unknown_status"
  | "invalid_amount"
  | "invalid_interval_count";

export type SkippedRow = {
  index: number;
  reason: SkipReason;
};

export type ComputeMrrResult = {
  mrrCents: number;
  includedCount: number;
  skipped: SkippedRow[];
};

/** Average days per month (365.25 / 12). Daily amount × this / intervalCount. */
export const DAY_TO_MONTH = 30.4375;
/** Weeks per month (52 / 12). Weekly amount × this / intervalCount. */
export const WEEK_TO_MONTH = 52 / 12;
/** Months in a year. Yearly amount / (this × intervalCount). */
export const MONTHS_PER_YEAR = 12;

function toMonthlyFloat(
  amount: number,
  interval: Interval,
  intervalCount: number,
): number {
  switch (interval) {
    case "day":
      return amount * (DAY_TO_MONTH / intervalCount);
    case "week":
      return amount * (WEEK_TO_MONTH / intervalCount);
    case "month":
      return amount / intervalCount;
    case "year":
      return amount / (MONTHS_PER_YEAR * intervalCount);
  }
}

function periodStillOpen(end: Date | null, now: Date): boolean {
  return end !== null && end.getTime() > now.getTime();
}

function skipReason(
  sub: SubscriptionInput,
  now: Date,
): SkipReason | null {
  if (sub.currency.toLowerCase() !== "usd") return "non_usd";
  if (!Number.isFinite(sub.unitAmountCents)) return "invalid_amount";
  if (!Number.isFinite(sub.intervalCount) || sub.intervalCount <= 0) {
    return "invalid_interval_count";
  }

  switch (sub.status) {
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "incomplete":
      return "incomplete";
    case "canceled":
      if (sub.currentPeriodEnd === null) return "canceled_no_end";
      if (!periodStillOpen(sub.currentPeriodEnd, now)) return "canceled_expired";
      return null;
    case "active":
      if (sub.cancelAtPeriodEnd) {
        if (sub.currentPeriodEnd === null) return "cancel_at_period_end_no_end";
        if (!periodStillOpen(sub.currentPeriodEnd, now)) {
          return "cancel_at_period_end_expired";
        }
      }
      return null;
    default:
      return "unknown_status";
  }
}

/**
 * Turn a messy subscription list into integer monthly cents.
 * `now` is injectable so period-end tests are deterministic (still no I/O).
 */
export function computeMrr(
  subscriptions: readonly SubscriptionInput[],
  now: Date = new Date(),
): ComputeMrrResult {
  const skipped: SkippedRow[] = [];
  let sum = 0;
  let includedCount = 0;

  for (let i = 0; i < subscriptions.length; i++) {
    const sub = subscriptions[i];
    const reason = skipReason(sub, now);
    if (reason) {
      skipped.push({ index: i, reason });
      continue;
    }
    sum += toMonthlyFloat(sub.unitAmountCents, sub.interval, sub.intervalCount);
    includedCount += 1;
  }

  const mrrCents = includedCount === 0 ? 0 : Math.round(sum);
  return {
    mrrCents: Number.isFinite(mrrCents) ? mrrCents : 0,
    includedCount,
    skipped,
  };
}

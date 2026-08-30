import { describe, expect, test } from "vitest";
import {
  WEEK_TO_MONTH,
  computeMrr,
  type SubscriptionInput,
} from "./computeMrr";

const NOW = new Date("2026-08-29T12:00:00.000Z");
const YESTERDAY = new Date("2026-08-28T12:00:00.000Z");
const TOMORROW = new Date("2026-08-30T12:00:00.000Z");

function sub(overrides: Partial<SubscriptionInput> = {}): SubscriptionInput {
  return {
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    currency: "usd",
    unitAmountCents: 1000,
    interval: "month",
    intervalCount: 1,
    ...overrides,
  };
}

describe("computeMrr", () => {
  test("1. one monthly $10 active → 1000 cents", () => {
    // $10.00 / month, already monthly, intervalCount 1 → 1000 cents.
    const result = computeMrr([sub({ unitAmountCents: 1000 })], NOW);
    expect(result.mrrCents).toBe(1000);
    expect(result.includedCount).toBe(1);
    expect(result.skipped).toEqual([]);
  });

  test("2. one yearly $120 active → 1000 cents", () => {
    // $120.00 / year → 12000 / 12 = 1000 cents monthly.
    const result = computeMrr(
      [sub({ unitAmountCents: 12000, interval: "year" })],
      NOW,
    );
    expect(result.mrrCents).toBe(1000);
    expect(result.includedCount).toBe(1);
  });

  test("3. one weekly $5 active → hand-calculated weekly→month", () => {
    // $5.00 / week = 500 cents.
    // Monthly = 500 * (52/12) / 1 = 500 * WEEK_TO_MONTH = 2166.666...¢
    // Round once at the end → 2167 cents.
    const monthlyFloat = 500 * WEEK_TO_MONTH;
    expect(monthlyFloat).toBeCloseTo(2166.666666, 5);
    const result = computeMrr(
      [sub({ unitAmountCents: 500, interval: "week" })],
      NOW,
    );
    expect(result.mrrCents).toBe(Math.round(monthlyFloat));
    expect(result.mrrCents).toBe(2167);
    expect(result.includedCount).toBe(1);
  });

  test("4. trialing $99 → 0", () => {
    // Trials are not real revenue → skip, MRR 0.
    const result = computeMrr(
      [sub({ status: "trialing", unitAmountCents: 9900 })],
      NOW,
    );
    expect(result.mrrCents).toBe(0);
    expect(result.includedCount).toBe(0);
    expect(result.skipped).toEqual([{ index: 0, reason: "trialing" }]);
  });

  test("5. past-due $50 → 0", () => {
    // Failed / past-due payment is not reliable revenue → skip.
    const result = computeMrr(
      [sub({ status: "past_due", unitAmountCents: 5000 })],
      NOW,
    );
    expect(result.mrrCents).toBe(0);
    expect(result.includedCount).toBe(0);
    expect(result.skipped).toEqual([{ index: 0, reason: "past_due" }]);
  });

  test("6. canceled, period end yesterday → 0", () => {
    // Canceled and the paid period has already ended → exclude.
    const result = computeMrr(
      [
        sub({
          status: "canceled",
          unitAmountCents: 3000,
          currentPeriodEnd: YESTERDAY,
        }),
      ],
      NOW,
    );
    expect(result.mrrCents).toBe(0);
    expect(result.includedCount).toBe(0);
    expect(result.skipped).toEqual([{ index: 0, reason: "canceled_expired" }]);
  });

  test("7. canceled, period end tomorrow, $30/mo → 3000", () => {
    // Still paying until currentPeriodEnd → include the $30/mo = 3000 cents.
    const result = computeMrr(
      [
        sub({
          status: "canceled",
          unitAmountCents: 3000,
          currentPeriodEnd: TOMORROW,
        }),
      ],
      NOW,
    );
    expect(result.mrrCents).toBe(3000);
    expect(result.includedCount).toBe(1);
    expect(result.skipped).toEqual([]);
  });

  test("8. two actives $10 + $20 monthly → 3000", () => {
    // 1000 + 2000 = 3000 cents. Sum first, round once (already integers).
    const result = computeMrr(
      [sub({ unitAmountCents: 1000 }), sub({ unitAmountCents: 2000 })],
      NOW,
    );
    expect(result.mrrCents).toBe(3000);
    expect(result.includedCount).toBe(2);
  });

  test("9. EUR row + USD row → only USD", () => {
    // Non-USD is skipped (no FX). $10 USD monthly remains → 1000 cents.
    const result = computeMrr(
      [
        sub({ currency: "eur", unitAmountCents: 5000 }),
        sub({ currency: "usd", unitAmountCents: 1000 }),
      ],
      NOW,
    );
    expect(result.mrrCents).toBe(1000);
    expect(result.includedCount).toBe(1);
    expect(result.skipped).toEqual([{ index: 0, reason: "non_usd" }]);
  });

  test("10. quarterly (month + intervalCount 3) $30 → 1000", () => {
    // $30 every 3 months → 3000 / 3 = 1000 cents monthly.
    const result = computeMrr(
      [sub({ unitAmountCents: 3000, interval: "month", intervalCount: 3 })],
      NOW,
    );
    expect(result.mrrCents).toBe(1000);
    expect(result.includedCount).toBe(1);
  });

  test("11. upgrade: unit amount is the new price only", () => {
    // Was $10/mo, upgraded to $25/mo. Input is already the new price (2500).
    // Do not average 1000 and 2500 (that would be 1750).
    const result = computeMrr([sub({ unitAmountCents: 2500 })], NOW);
    expect(result.mrrCents).toBe(2500);
    expect(result.mrrCents).not.toBe(1750);
    expect(result.includedCount).toBe(1);
  });
});

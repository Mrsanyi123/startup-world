import { describe, expect, test } from "vitest";
import { computeMrr } from "./computeMrr";
import { subscriptionsFromPolar } from "./fromPolar";

const NOW = new Date("2026-08-29T12:00:00.000Z");

const MONTHLY_ACTIVE = {
  items: [
    {
      status: "active",
      cancel_at_period_end: false,
      current_period_end: "2026-09-29T12:00:00.000Z",
      amount: 1000,
      currency: "usd",
      recurring_interval: "month",
      recurring_interval_count: 1,
    },
  ],
};

describe("subscriptionsFromPolar", () => {
  test("monthly $10 active → computeMrr 1000", () => {
    const { subscriptions, skipped } = subscriptionsFromPolar(MONTHLY_ACTIVE);
    expect(skipped).toEqual([]);
    expect(computeMrr(subscriptions, NOW).mrrCents).toBe(1000);
  });

  test("yearly $120 active → 1000 cents monthly", () => {
    const fixture = {
      items: [
        {
          ...MONTHLY_ACTIVE.items[0],
          amount: 12000,
          recurring_interval: "year",
        },
      ],
    };
    const { subscriptions } = subscriptionsFromPolar(fixture);
    expect(computeMrr(subscriptions, NOW).mrrCents).toBe(1000);
  });

  test("missing amount is omitted", () => {
    const fixture = {
      items: [{ ...MONTHLY_ACTIVE.items[0], amount: null }],
    };
    const { subscriptions, skipped } = subscriptionsFromPolar(fixture);
    expect(subscriptions).toEqual([]);
    expect(skipped[0]?.reason).toBe("missing_price");
  });

  test("unknown interval is omitted", () => {
    const fixture = {
      items: [{ ...MONTHLY_ACTIVE.items[0], recurring_interval: "fortnight" }],
    };
    const { subscriptions, skipped } = subscriptionsFromPolar(fixture);
    expect(subscriptions).toEqual([]);
    expect(skipped[0]?.reason).toBe("unknown_interval");
  });

  test("non-USD is mapped; computeMrr skips it", () => {
    const fixture = {
      items: [{ ...MONTHLY_ACTIVE.items[0], currency: "eur" }],
    };
    const { subscriptions } = subscriptionsFromPolar(fixture);
    expect(subscriptions[0]?.currency).toBe("eur");
    expect(computeMrr(subscriptions, NOW).skipped[0]?.reason).toBe("non_usd");
  });

  test("quarterly (interval_count 3) $30 → 1000", () => {
    const fixture = {
      items: [
        {
          ...MONTHLY_ACTIVE.items[0],
          amount: 3000,
          recurring_interval_count: 3,
        },
      ],
    };
    const { subscriptions } = subscriptionsFromPolar(fixture);
    expect(computeMrr(subscriptions, NOW).mrrCents).toBe(1000);
  });

  test("bare array payload works the same as { items }", () => {
    const { subscriptions } = subscriptionsFromPolar(MONTHLY_ACTIVE.items);
    expect(subscriptions).toHaveLength(1);
  });
});

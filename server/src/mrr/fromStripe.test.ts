import { describe, expect, test } from "vitest";
import { computeMrr } from "./computeMrr";
import { subscriptionsFromStripe } from "./fromStripe";

const NOW = new Date("2026-08-29T12:00:00.000Z");

/** Stripe list payload: one $10/mo active subscription. */
const MONTHLY_ACTIVE = {
  object: "list",
  data: [
    {
      object: "subscription",
      status: "active",
      cancel_at_period_end: false,
      current_period_end: 1_788_307_200,
      items: {
        data: [
          {
            quantity: 1,
            price: {
              unit_amount: 1000,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1 },
            },
          },
        ],
      },
    },
  ],
};

describe("subscriptionsFromStripe", () => {
  test("monthly $10 active → computeMrr 1000", () => {
    const { subscriptions, skipped } = subscriptionsFromStripe(MONTHLY_ACTIVE);
    expect(skipped).toEqual([]);
    expect(computeMrr(subscriptions, NOW).mrrCents).toBe(1000);
  });

  test("yearly $120 active → 1000 cents monthly", () => {
    const fixture = structuredClone(MONTHLY_ACTIVE);
    fixture.data[0].items.data[0].price.unit_amount = 12000;
    fixture.data[0].items.data[0].price.recurring.interval = "year";
    const { subscriptions } = subscriptionsFromStripe(fixture);
    expect(computeMrr(subscriptions, NOW).mrrCents).toBe(1000);
  });

  test("missing price is omitted (not sent to computeMrr)", () => {
    const fixture = {
      data: [
        {
          object: "subscription",
          status: "active",
          items: { data: [{ quantity: 1, price: null }] },
        },
      ],
    };
    const { subscriptions, skipped } = subscriptionsFromStripe(fixture);
    expect(subscriptions).toEqual([]);
    expect(skipped.some((s) => s.reason === "missing_price")).toBe(true);
    expect(computeMrr(subscriptions, NOW).mrrCents).toBe(0);
  });

  test("unknown interval (one-off price) is omitted", () => {
    const fixture = {
      data: [
        {
          object: "subscription",
          status: "active",
          items: {
            data: [
              {
                quantity: 1,
                price: {
                  unit_amount: 5000,
                  currency: "usd",
                  recurring: null,
                },
              },
            ],
          },
        },
      ],
    };
    const { subscriptions, skipped } = subscriptionsFromStripe(fixture);
    expect(subscriptions).toEqual([]);
    expect(skipped[0]?.reason).toBe("unknown_interval");
  });

  test("non-USD is mapped; computeMrr skips it", () => {
    const fixture = structuredClone(MONTHLY_ACTIVE);
    fixture.data[0].items.data[0].price.currency = "eur";
    const { subscriptions } = subscriptionsFromStripe(fixture);
    expect(subscriptions[0]?.currency).toBe("eur");
    const result = computeMrr(subscriptions, NOW);
    expect(result.mrrCents).toBe(0);
    expect(result.skipped[0]?.reason).toBe("non_usd");
  });

  test("quantity 3 × $10 = 3000 cents", () => {
    const fixture = structuredClone(MONTHLY_ACTIVE);
    fixture.data[0].items.data[0].quantity = 3;
    const { subscriptions } = subscriptionsFromStripe(fixture);
    expect(subscriptions[0]?.unitAmountCents).toBe(3000);
    expect(computeMrr(subscriptions, NOW).mrrCents).toBe(3000);
  });

  test("current_period_end on the item (newer Stripe API)", () => {
    const fixture = {
      data: [
        {
          object: "subscription",
          status: "canceled",
          cancel_at_period_end: false,
          current_period_end: null,
          items: {
            data: [
              {
                quantity: 1,
                current_period_end: 1_788_307_200,
                price: {
                  unit_amount: 3000,
                  currency: "usd",
                  recurring: { interval: "month", interval_count: 1 },
                },
              },
            ],
          },
        },
      ],
    };
    const { subscriptions } = subscriptionsFromStripe(fixture);
    expect(subscriptions[0]?.currentPeriodEnd?.toISOString()).toBe(
      "2026-09-02T00:00:00.000Z",
    );
    expect(computeMrr(subscriptions, NOW).mrrCents).toBe(3000);
  });
});

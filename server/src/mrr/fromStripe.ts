import type { Interval, Status, SubscriptionInput } from "./computeMrr";

/**
 * Map Stripe subscription list objects → SubscriptionInput.
 * No I/O. Does not read Stripe's "MRR" field. Missing price / unknown
 * interval rows are omitted (computeMrr never sees them).
 *
 * A Stripe subscription with several items becomes several inputs
 * (quantity × unit_amount per item).
 */

const INTERVALS = new Set<Interval>(["day", "week", "month", "year"]);
const STATUSES = new Set<Status>([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
]);

export type StripeMapSkip =
  | "missing_price"
  | "unknown_interval"
  | "unknown_status"
  | "not_a_subscription";

export type StripeMapResult = {
  subscriptions: SubscriptionInput[];
  skipped: { reason: StripeMapSkip; detail?: string }[];
};

type StripePrice = {
  unit_amount?: number | null;
  currency?: string | null;
  type?: string | null;
  recurring?: {
    interval?: string | null;
    interval_count?: number | null;
  } | null;
};

type StripeItem = {
  quantity?: number | null;
  current_period_end?: number | null;
  price?: StripePrice | null;
  plan?: StripePrice | null;
};

type StripeSubscription = {
  object?: string;
  status?: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end?: number | null;
  items?: { data?: StripeItem[] | null } | null;
};

function asUnixDate(seconds: number | null | undefined): Date | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000);
}

function asStatus(raw: string | null | undefined): Status | null {
  if (!raw) return null;
  if (raw === "incomplete_expired" || raw === "paused") return null;
  return STATUSES.has(raw as Status) ? (raw as Status) : null;
}

function priceOf(item: StripeItem): StripePrice | null {
  return item.price ?? item.plan ?? null;
}

function periodEnd(sub: StripeSubscription, item: StripeItem): Date | null {
  return (
    asUnixDate(item.current_period_end) ?? asUnixDate(sub.current_period_end)
  );
}

export function subscriptionsFromStripe(
  payload: unknown,
): StripeMapResult {
  const skipped: StripeMapResult["skipped"] = [];
  const subscriptions: SubscriptionInput[] = [];

  const list = normalizeList(payload);
  if (!list) {
    skipped.push({ reason: "not_a_subscription", detail: "unrecognized payload" });
    return { subscriptions, skipped };
  }

  for (const raw of list) {
    if (!raw || typeof raw !== "object") {
      skipped.push({ reason: "not_a_subscription" });
      continue;
    }
    const sub = raw as StripeSubscription;
    if (sub.object && sub.object !== "subscription") {
      skipped.push({ reason: "not_a_subscription" });
      continue;
    }

    const status = asStatus(sub.status);
    if (!status) {
      skipped.push({
        reason: "unknown_status",
        detail: sub.status ?? "missing",
      });
      continue;
    }

    const items = sub.items?.data ?? [];
    if (items.length === 0) {
      skipped.push({ reason: "missing_price", detail: "no items" });
      continue;
    }

    for (const item of items) {
      const price = priceOf(item);
      const unit = price?.unit_amount;
      if (price == null || unit == null || !Number.isFinite(unit)) {
        skipped.push({ reason: "missing_price" });
        continue;
      }
      const interval = price.recurring?.interval;
      if (!interval || !INTERVALS.has(interval as Interval)) {
        skipped.push({
          reason: "unknown_interval",
          detail: interval ?? "none",
        });
        continue;
      }
      const intervalCount = price.recurring?.interval_count ?? 1;
      const quantity =
        typeof item.quantity === "number" && item.quantity > 0
          ? item.quantity
          : 1;

      subscriptions.push({
        status,
        cancelAtPeriodEnd: sub.cancel_at_period_end === true,
        currentPeriodEnd: periodEnd(sub, item),
        currency: (price.currency ?? "usd").toLowerCase(),
        unitAmountCents: Math.round(unit * quantity),
        interval: interval as Interval,
        intervalCount,
      });
    }
  }

  return { subscriptions, skipped };
}

function normalizeList(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const obj = payload as { object?: string; data?: unknown };
    if (Array.isArray(obj.data)) return obj.data;
  }
  return null;
}

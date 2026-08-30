import type { Interval, Status, SubscriptionInput } from "./computeMrr";

/**
 * Map Polar subscription objects → SubscriptionInput.
 * No I/O. Missing amount / unknown interval rows are omitted.
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

export type PolarMapSkip =
  | "missing_price"
  | "unknown_interval"
  | "unknown_status"
  | "not_a_subscription";

export type PolarMapResult = {
  subscriptions: SubscriptionInput[];
  skipped: { reason: PolarMapSkip; detail?: string }[];
};

type PolarSubscription = {
  status?: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;
  amount?: number | null;
  currency?: string | null;
  recurring_interval?: string | null;
  recurring_interval_count?: number | null;
};

function asStatus(raw: string | null | undefined): Status | null {
  if (!raw) return null;
  if (raw === "incomplete_expired") return "incomplete";
  return STATUSES.has(raw as Status) ? (raw as Status) : null;
}

function asPeriodEnd(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function subscriptionsFromPolar(payload: unknown): PolarMapResult {
  const skipped: PolarMapResult["skipped"] = [];
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
    const sub = raw as PolarSubscription;

    const status = asStatus(sub.status);
    if (!status) {
      skipped.push({
        reason: "unknown_status",
        detail: sub.status ?? "missing",
      });
      continue;
    }

    if (sub.amount == null || !Number.isFinite(sub.amount)) {
      skipped.push({ reason: "missing_price" });
      continue;
    }

    const interval = sub.recurring_interval;
    if (!interval || !INTERVALS.has(interval as Interval)) {
      skipped.push({
        reason: "unknown_interval",
        detail: interval ?? "none",
      });
      continue;
    }

    subscriptions.push({
      status,
      cancelAtPeriodEnd: sub.cancel_at_period_end === true,
      currentPeriodEnd: asPeriodEnd(sub.current_period_end),
      currency: (sub.currency ?? "usd").toLowerCase(),
      unitAmountCents: Math.round(sub.amount),
      interval: interval as Interval,
      intervalCount: sub.recurring_interval_count ?? 1,
    });
  }

  return { subscriptions, skipped };
}

function normalizeList(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const obj = payload as { items?: unknown; data?: unknown };
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return null;
}

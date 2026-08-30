# PROMPT 08 — Isolated MRR engine

You are a coding agent. You may run this **in parallel** with 05–07. No Three.js. No HTTP required except optional wiring of an internal route.

Also read `About.md` §6.

## Goal

A pure function that turns a messy list of subscriptions into `mrr_cents`. This is the only place MRR is defined. UI and Stripe adapters call it; they do not invent their own math.

## Module

`server/src/mrr/computeMrr.ts` (or `shared/` if you keep it isomorphic)

Input (normalize providers into this shape **before** calling compute):

```ts
type Interval = "day" | "week" | "month" | "year"
type Status = "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete"

type SubscriptionInput = {
  status: Status
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: Date | null  // if canceled-at-period-end, still paying until this
  currency: string               // lowercase iso
  unitAmountCents: number        // current price (after proration / new plan)
  interval: Interval
  intervalCount: number          // e.g. 3 + month = quarterly
}
```

Output: `{ mrrCents: number, includedCount: number, skipped: ... }` integer cents, never NaN.

## Locked rules (do not “improve”)

- **USD only.** Skip non-`usd` rows (count them in `skipped`).
- **Exclude** `trialing`.
- **Exclude** `past_due`, `unpaid`, `incomplete`.
- **Include** `active`.
- **Include** `canceled` (or active + `cancelAtPeriodEnd`) **only while** `currentPeriodEnd` is in the future. If no end date, exclude.
- **Proration / upgrades:** use `unitAmountCents` as given (the new price). Do not average old/new.
- Multiple subscriptions: **sum** included rows.
- Normalize to monthly:
  - day: `amount * (365/12) / intervalCount` — actually: `amount * (30.4375 / intervalCount)` for day, or document equivalent
  - week: `amount * (52/12) / intervalCount` ≈ `amount * 4.333... / intervalCount`
  - month: `amount / intervalCount`
  - year: `amount / (12 * intervalCount)`
- Round to nearest cent at the **end** (sum first in float or integer-millis, then round once). Document which. Tests must match.

Put the interval factors in named constants.

## Tests (required — write these first or with the function)

`server/src/mrr/computeMrr.test.ts` using vitest or node:test.

Fixtures must include **all** of:

1. One monthly $10 active → 1000 cents
2. One yearly $120 active → 1000 cents
3. One weekly $5 active → hand-calculated weekly→month
4. Trialing $99 → 0
5. Past-due $50 → 0
6. Canceled, period end yesterday → 0
7. Canceled, period end tomorrow, $30/mo → 3000
8. Two actives $10 + $20 monthly → 3000
9. EUR row + USD row → only USD
10. Quarterly (`month` + `intervalCount: 3`) $30 → 1000
11. Upgrade: unit amount is the new price only

Each test comments the hand-calculated expectation.

## Optional

`POST /internal/mrr/refresh` with header `x-internal-secret` — can no-op or run against fixtures if no connections exist. Do not call Stripe yet.

## Do not

- Call Stripe or Polar APIs
- Import Three.js
- Trust a provider “mrr” field
- Add FX conversion

## Gate

All tests pass and match the comments. Function has no I/O.

When finished, note in README: “Phase 08 done — MRR tests passing.”

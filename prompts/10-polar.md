# PROMPT 10 — Polar OAuth

You are a coding agent. Prompt 09 is the template. Do the same for Polar.

## Flow

- `GET /integrations/polar/oauth/start`
- `GET /integrations/polar/oauth/callback`
- Same CSRF, encryption, one connection per plot, same `computeMrr`, same snapshot table
- `provider = polar`

Read **current** Polar OAuth + subscriptions/orders docs. Request **read** access only. Map Polar’s subscription objects in `server/src/mrr/fromPolar.ts` to `SubscriptionInput`. Fixture tests, no live network in unit tests.

## Client

Enable “Connect Polar.” If Polar docs are incomplete or the human has no app yet: keep the button but show “Coming soon” and document what env vars are missing. Do not fake a successful connect.

## Do not

- Duplicate MRR math (call `computeMrr` only)
- Write to Polar
- Share Stripe tokens with Polar routes

## Gate

Same as Stripe: test Polar org → snapshot → correct house. Or: clearly stubbed with README note if keys are absent.

When finished, note in README: “Phase 10 done — Polar” or “Phase 10 skipped — waiting on Polar app.”

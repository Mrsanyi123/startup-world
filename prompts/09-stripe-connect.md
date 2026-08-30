# PROMPT 09 — Stripe Connect

You are a coding agent. Prompts 07–08 are done (DB + `computeMrr`). Human has a Stripe **platform** in test mode and will paste keys.

Wire **read-only** Connect OAuth. Never write charges, products, or customer data.

Also read `About.md` §§6, 10, 11.

## Flow

1. Signed-in user who **owns a plot** hits `GET /integrations/stripe/oauth/start`
2. Server stores a short-lived state CSRF value (cookie or table)
3. Redirect to Stripe Connect OAuth (Standard / OAuth link — use current Stripe Connect OAuth docs, read-only scopes sufficient to **list subscriptions**)
4. `GET /integrations/stripe/oauth/callback` exchanges the code, encrypts tokens, upserts `connections` for that plot (`provider = stripe`)
5. Immediately fetch subscriptions (server-side), map to `SubscriptionInput`, `computeMrr`, insert `mrr_snapshots`
6. Redirect client back to the game. House appears from existing Prompt 05 renderer using GET /plots

## Encryption

- `TOKEN_ENCRYPTION_KEY` — 32-byte key, AES-256-GCM
- Encrypt access (and refresh if any) **before** INSERT
- Decrypt only on the server when refreshing
- Never log tokens, never send them to the client, never put them in GET /plots

## Routes

- Start + callback as above
- `PATCH /connections/:id` already exists — keep using it for `is_mrr_public`
- Rate-limit OAuth start

If the user has no plot: 400. If they already connected this plot: replace tokens and recompute (one connection per plot).

## Mapping Stripe → SubscriptionInput

Write `server/src/mrr/fromStripe.ts`. Handle missing price, unknown interval, non-USD. Tests with fixture JSON (no live network).

## Client

Enable the “Connect Stripe” button: navigate to `/integrations/stripe/oauth/start` (same origin via Vite proxy or absolute API URL).

## Do not

- Use Stripe “MRR” reports
- Request write scopes
- Add webhooks unless you need them (v1 poll/on-connect is enough)
- Implement Polar here

## Gate

Human connects a **test** Stripe account with a known subscription. Snapshot matches `computeMrr`. House tier matches. Tokens are ciphertext in the DB. Client response has no token fields.

When finished, note in README: Stripe dashboard redirect URI + “Phase 09 done.”

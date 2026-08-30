# PROMPT 07 — Auth, Postgres, real claims

You are a coding agent. Prompts 01–06 are done (client village with local claims).

Persist the world. Do **not** start Stripe/Polar OAuth or the MRR math module (those are 08–10).

Also read `About.md` §§5, 8, 10, 11.

## Stack

- Clerk for auth (Google + email). Human will paste keys into `.env`.
- Neon Postgres via `DATABASE_URL`
- Drizzle ORM + a migration you can run with a script
- Fastify: verify Clerk session on protected routes

If keys are missing, keep the app bootable and print a clear error on API routes — do not crash the Vite client.

## Schema

```
users          id (Clerk user id is fine), display_name, created_at
plots          id, pos_x, pos_y, pos_z, owner_id null FK, status, claimed_at
connections    id, plot_id unique FK, provider, access_token, refresh_token,
               is_mrr_public default false, connected_at
               -- tokens will be encrypted later; varchar/text is fine
mrr_snapshots  id, connection_id FK, mrr_cents, computed_at
house_tiers    tier_index PK, label, mrr_threshold_cents, model_ref
```

Seed:

- 32 plots at the **same Fibonacci positions** the client used (shared function in `shared/` — client and server must not drift)
- 6 house_tier rows as in Prompt 05
- Optional: a few demo claimed plots with stub connections + snapshots so houses still appear without Stripe

Constraints:

- A plot has at most one owner
- **One claimed plot per user** (unique partial index on `plots.owner_id` where status = claimed, or equivalent)
- Claim race: unique / conditional update so two POSTs → one winner

## API

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| GET | `/plots` | optional | All plots + owner display name + **tier**. Include `mrr_cents` only if `is_mrr_public` OR the requester is the owner |
| POST | `/plots/:id/claim` | required | 409 if already claimed or user already has a plot. Rate-limit. On success, persist |
| PATCH | `/connections/:id` | required, owner | Toggle `is_mrr_public` only |

Upsert `users` on first authenticated request from Clerk profile.

## Client

- Replace local claim with `POST /plots/:id/claim`
- Load world via `GET /plots` on boot (and after claim)
- Sign-in button becomes real Clerk
- After refresh, the player’s claim and houses remain

## Realtime

Skip Socket.io in this prompt. Polling `GET /plots` after claim is enough.

## Do not

- Store Clerk secrets in the client
- Return access tokens
- Implement OAuth
- Drop the unique claim constraints “to make testing easier”

## Gate

Two browser profiles: both try the same plot → one 200, one 409. Refresh keeps the winner. Unsigned users can walk and see houses but cannot claim.

When finished, note in README: env vars needed + “Phase 07 done — persisted claims.”

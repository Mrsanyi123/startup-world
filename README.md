# Startup Village

A browser game: walk on a tiny planet, claim a plot, connect Stripe or Polar, and grow a house from computed MRR. Inspiration: [Messenger](https://messenger.abeto.co/).

## Setup

Requires Node 24 and [pnpm](https://pnpm.io/).

```sh
pnpm install
cp .env.example .env   # then paste keys (see below)
pnpm db:migrate        # needs DATABASE_URL
pnpm dev
```

- Client (Vite): [http://localhost:5173](http://localhost:5173)
- Server (Fastify): [http://localhost:3001](http://localhost:3001)
- Health check: `GET http://localhost:3001/health` → `{ "ok": true, "database": …, "clerk": … }`

Without Clerk/Neon keys the game still plays in **demo mode**: one-click sign-in as “Founder”, claims and houses live in an in-memory store (saved to `.demo-world.json`), and **Demo Stripe / Demo Polar** attach a stub MRR so construction runs. Add real keys later to swap in Clerk, Neon, and live billing.

`pnpm build` typechecks every workspace package (and bundles the client).
`pnpm test` runs the isolated MRR engine tests (including Stripe/Polar fixtures).

## Env vars (repo-root `.env`, never commit)

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | Neon Postgres — persist plots, houses, claims |
| `CLERK_PUBLISHABLE_KEY` | Browser sign-in (Google + email) |
| `CLERK_SECRET_KEY` | Verify sessions on claims and OAuth start |
| `INTERNAL_JOB_SECRET` | `POST /internal/mrr/refresh` (`x-internal-secret` header) |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM for OAuth tokens. Generate: `openssl rand -hex 32` |
| `STRIPE_CLIENT_ID` | Connect OAuth (`ca_…` from Stripe Connect settings) |
| `STRIPE_SECRET_KEY` | Token exchange + listing subscriptions (`sk_test_…`) |
| `STRIPE_OAUTH_SCOPE` | Default `read_only`. Platforms that are not Connect *extensions* may need `read_write` — we still only ever GET. |
| `POLAR_CLIENT_ID` / `POLAR_CLIENT_SECRET` | Polar OAuth (read: `subscriptions:read`) |
| `POLAR_SANDBOX` | `1` to use Polar sandbox authorize + API hosts |
| `OAUTH_REDIRECT_ORIGIN` | Default `http://localhost:3001` — must match the dashboard redirect URI |

In Clerk, add `http://localhost:5173` as an allowed origin / redirect.

## Stripe Connect (read-only)

In the [Stripe Connect settings](https://dashboard.stripe.com/settings/connect) (test mode), add this redirect URI:

```
http://localhost:3001/integrations/stripe/oauth/callback
```

Sign in, claim a plot, click **Connect Stripe**. Tokens are encrypted at rest (`v1:` AES-256-GCM) and never returned from `GET /plots`.

## Polar OAuth

Create an OAuth app at [polar.sh](https://polar.sh/docs/integrate/oauth2/connect) with redirect URI:

```
http://localhost:3001/integrations/polar/oauth/callback
```

Scopes: `subscriptions:read` only. Without `POLAR_CLIENT_ID` / `POLAR_CLIENT_SECRET` the **Connect Polar** button stays visible and shows “Coming soon” — it does not fake a successful connect.

## Hourly MRR refresh

`node-cron` on the Fastify process runs at minute 0 of every hour. Same job, on demand:

```sh
curl -X POST http://localhost:3001/internal/mrr/refresh \
  -H "x-internal-secret: $INTERNAL_JOB_SECRET"
```

Response includes `tierChangedPlotIds`. After a tier change the server also broadcasts `house:tier_changed` so people already on the planet see construction without a refresh. The client still polls `GET /plots` every 45s as a fallback. One bad token marks that connection `broken` (last house stays; a “Disconnected” marker shows) and does not stop the rest of the job.

Demo seed connections use stub tokens and are skipped (not marked broken).

## Database

```sh
pnpm db:migrate
```

Applies `server/drizzle/*.sql` in order, seeds 32 Fibonacci plots (same layout as the client), 6 house tiers, and a handful of demo claimed plots so houses appear without Stripe.

## Folders

| Path | Role |
|---|---|
| `client/` | Vite + TypeScript + vanilla Three.js |
| `server/` | Fastify API (will later serve the built client) |
| `shared/` | Shared types + Fibonacci plot layout + house tiers |
| `About.md` | Product spec |
| `Plan.md` | Build order |

Phase 01 done — skeleton only.

Phase 02 done — planet only.

Phase 03 done — movement. Playtest before plots.

Phase 04 done — local plots.

Phase 05 done — stub houses.

Phase 06 done — HUD.

Phase 07 done — persisted claims.

Phase 08 done — MRR tests passing.

Phase 09 done — Stripe Connect OAuth (read-only). Add the redirect URI above.

Phase 10 done — Polar (button is “Coming soon” until Polar app keys are in `.env`).

Phase 11 done — hourly MRR refresh + internal curl route.

Phase 12 done — multiplayer. Two browsers see each other walk; claims and house tiers update live over Socket.io (Postgres stays the source of truth). Cap is 20 walkers on the planet.

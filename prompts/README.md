# Agent prompts — how to use

Each file in this folder is a **full prompt**. Paste the entire file into Cursor, Claude, or any coding agent. Also attach `About.md` if the tool lets you add files.

Do the parts **in number order**. Do not start a part until the previous part’s **Gate** is true. Parts 08 (MRR) can overlap with 05–07 because it has no UI.

| # | File | What it builds | Needs your keys? |
|---|---|---|---|
| 01 | `01-repo-skeleton.md` | Monorepo, Vite, Fastify, blank sphere | No |
| 02 | `02-planet.md` | The tiny planet look and lighting | No |
| 03 | `03-character-and-movement.md` | Walk the sphere + third-person camera | No |
| 04 | `04-plots.md` | 32 claimable plots (local only) | No |
| 05 | `05-houses.md` | Tiered houses + construction animation | No |
| 06 | `06-hud.md` | On-screen UI, claim prompt, nameplates | No |
| 07 | `07-auth-and-database.md` | Clerk, Neon, real claims | Clerk + Neon |
| 08 | `08-mrr-engine.md` | Isolated MRR math + tests | No |
| 09 | `09-stripe-connect.md` | Connect Stripe → real MRR | Stripe |
| 10 | `10-polar.md` | Same for Polar | Polar |
| 11 | `11-hourly-refresh.md` | Cron + live tier changes | Same as 09 |
| 12 | `12-multiplayer.md` | Other players on the planet | No extra |
| 13 | `13-deploy.md` | README, Railway, privacy page | Host account |

Locked product defaults (already decided — do not reopen unless the human says so):

- 1 plot per user
- House follows **current** MRR (can shrink)
- Disconnect = keep plot, freeze last tier, show disconnected marker
- USD only; skip other currencies
- Trials excluded; canceled-in-period included; past-due excluded; proration uses new price
- 32 plots, Fibonacci sphere
- MRR public = off by default
- Tiers: tent $0 · shack $100 · cottage $1k · house $5k · mansion $20k · tower $50k

Stack (do not substitute): Vite + TypeScript + vanilla Three.js · Fastify · Postgres/Neon · Drizzle · Clerk · Socket.io · AES-256-GCM for tokens · pnpm workspaces.

Not in v1: R3F, physics engines, Colyseus, procedural houses, jump, multiple planets, trading, mobile apps, writing to Stripe/Polar.

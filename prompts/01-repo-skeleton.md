# PROMPT 01 — Repo skeleton

You are a coding agent. Build only what this prompt asks. Do not start planet art, movement, plots, auth, or billing.

Also read `About.md` in this repo if it is available.

## Product (one paragraph)

Startup Village is a browser game: people walk on a tiny planet, claim a plot, connect Stripe or Polar, and grow a house from computed MRR. Inspiration: https://messenger.abeto.co/ — small fully-visible world, calm, no invisible walls.

## Stack (do not change)

- pnpm workspaces, TypeScript everywhere
- `client/` — Vite + vanilla Three.js (not React, not R3F)
- `server/` — Fastify, will later serve the built client
- Shared types in `shared/` or `packages/shared`
- `.env.example` and a root README
- No Clerk/Neon wiring yet — placeholders only

## Do this

1. Create the monorepo:

```
package.json                 # workspaces: client, server, shared
pnpm-workspace.yaml
client/                      # Vite + TS + three
server/                      # Fastify + TS
shared/                      # types only
.env.example
README.md
```

2. Shared types (fields only, no DB yet):

```ts
// users, plots, connections, mrr_snapshots, house_tiers
// PlotStatus = "unclaimed" | "claimed"
// Provider = "stripe" | "polar"
// HouseTier: tierIndex, label, mrrThresholdCents, modelRef
```

3. Client: a full-window `<canvas>`, create a Three.js scene, camera, renderer, resize handler, animation loop. Put a **placeholder sphere** (radius 20, flat green/blue material) at the origin so we know WebGL works. No character, no controls.

4. Server: Fastify on a port (e.g. 3001). `GET /health` returns `{ ok: true }`. CORS open for the Vite origin.

5. Root scripts: `pnpm dev` runs client + server together. `pnpm build` typechecks both.

6. `.env.example` list (empty values):

```
DATABASE_URL=
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
TOKEN_ENCRYPTION_KEY=
STRIPE_CLIENT_ID=
STRIPE_SECRET_KEY=
POLAR_CLIENT_ID=
POLAR_CLIENT_SECRET=
INTERNAL_JOB_SECRET=
```

7. README: how to `pnpm install` and `pnpm dev`, what each folder is.

## Do not

- Add WASD, OrbitControls as the “game camera,” physics, React, Next.js
- Add plots, houses, login buttons, Stripe
- Commit secrets
- Invent extra packages (no Tailwind required; plain CSS is fine)

## Gate (stop when this is true)

`pnpm dev` opens the browser and you see a colored sphere on a dark/clear background. `GET /health` returns ok. Types compile.

When finished, write a short note at the bottom of the root README: “Phase 01 done — skeleton only.”

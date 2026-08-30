# Startup Village — master plan

Get a playable tiny-planet land + MRR game live as fast as possible. Spec lives in `About.md`. Feel target: [Messenger](https://messenger.abeto.co/) — a small fully-visible planet, walk a full lap in a couple of minutes, calm third-person movement, other people visible as you pass.

This file is the **order of work**. Who does what, accounts, money, and research live in `Division-of-Work.md`. Paste-ready agent prompts for each part live in `prompts/` — start at `prompts/README.md`.

---

## 0. What “done” means for v1

A browser game someone can open, sign in, walk around a sphere, claim **one** empty plot, connect Stripe **or** Polar, and see a house appear. Other signed-in players see that house (and the exact MRR only if the owner opted in). Houses upgrade with a short construction beat when MRR crosses a tier.

Not in v1: custom 3D art, procedural houses, multiple planets, trading, mobile apps, writing anything to Stripe/Polar.

---

## 1. Decisions we lock now (so build does not stall)

These were open in `About.md`. Defaults below are the fastest honest choices. Change them in `Division-of-Work.md` if you disagree — do it before Phase 4.

| Question | v1 default | Why |
|---|---|---|
| Plots per user | **1** | Fair, simple, no land-grab |
| MRR drop | **House follows current MRR** (can shrink) | Matches “this is your real startup,” easy to flip later |
| Owner disconnects Stripe/Polar | **Keep the plot**, freeze last-known tier, show a “disconnected” marker | No griefing / reclaim wars |
| Currency | **USD only** for v1; ignore or skip other currencies | Avoid FX until we have users |
| Trials | **Exclude** | Not real revenue |
| Canceled but still in period | **Include until period end** | Still paying |
| Past-due / failed payment | **Exclude** | Not reliable revenue |
| Mid-proration upgrade | **Use the new price** | Matches “current” MRR |
| Plot count | **32** (Fibonacci-sphere layout) | Enough choice, not a desert |
| Public MRR | **Off by default** | Privacy |

House tiers (cents):

| Tier | Label | Threshold |
|---|---|---|
| 0 | tent | $0 |
| 1 | shack | $100 |
| 2 | cottage | $1,000 |
| 3 | house | $5,000 |
| 4 | mansion | $20,000 |
| 5 | tower | $50,000 |

A connected account at $0 still gets a **tent**. Empty plots stay empty until claimed.

---

## 2. Stack (one choice, no shopping)

Picked for speed and fewer moving parts. One repo, one language.

| Layer | Choice | Why |
|---|---|---|
| Client | Vite + TypeScript + Three.js (vanilla, not R3F) | Closest to Messenger; movement code stays explicit |
| Server | Fastify + TypeScript | Serves the built client **and** the API — one deploy |
| DB | Postgres on [Neon](https://neon.tech) | Free, instant, real Postgres |
| ORM | Drizzle | Thin, typed, easy migrations |
| Auth | [Clerk](https://clerk.com) | Fastest hosted auth; no password code |
| Realtime | Socket.io | Positions + “plot claimed” events only |
| Jobs | `node-cron` on the same server | Hourly MRR refresh; no extra worker yet |
| Tokens | AES-256-GCM, key from env | Never sent to the client |
| Hosting | [Railway](https://railway.app) (or Fly.io) | One Node process, WebSockets work |
| Domain | Whatever you already have, or buy one later | Can launch on `*.up.railway.app` first |

Local: `pnpm dev` runs Vite + Fastify together. Postgres via Neon (or Docker if you prefer).

We are **not** using Supabase Realtime, Colyseus, a physics engine, or React Three Fiber for v1.

---

## 3. Sequence — first to last

Do not skip ahead of the gate at the end of each phase. Parallel work is called out.

### Phase 0 — You, today (blocks nothing except live OAuth)

Create the accounts listed in `Division-of-Work.md`. Play [Messenger](https://messenger.abeto.co/) for 10–15 minutes and write 5 notes: camera distance, walk speed, how small the planet feels, how other players appear, what UI stays out of the way.

I start Phase 1 the moment this repo is the working directory. Stripe Connect can take days to approve — start that form **now** so it is ready when we hit Phase 7.

### Phase 1 — Repo skeleton (me)

- `client/` (Vite + Three.js) and `server/` (Fastify) in one monorepo
- Shared types for Plot, User, Connection, HouseTier
- `.env.example`, README with how to run
- Health check: `GET /health`
- Empty world canvas that loads Three.js

**Gate:** `pnpm dev` opens a blank planet-colored sphere in the browser.

### Phase 2 — Movement only (me, then you playtest)

This is the load-bearing piece. Isolated. No plots, no auth.

- Sphere radius `R` (start ~20 units; tune so a lap is ~60–90 seconds)
- Capsule character
- WASD / arrows, local `up` / `facing` / `right` as specified in `About.md` §4
- Third-person camera using the same local `up`
- No Euler angles, no physics engine
- Soft pointer-lock or click-to-look so turning feels like Messenger

**Gate:** You walk full circles, including over the poles, with no flip, jitter, or clipping. If it feels wrong, we iterate here. Do not add plots until you say the walk feels good.

### Phase 3 — Plots on the client (me)

- 32 Fibonacci-sphere points
- Markers sitting on the surface (oriented to the normal)
- Walk near an unclaimed plot → prompt “Press E to claim”
- Claim is **local-only** at this stage (memory), so we can tune range and UX

**Gate:** You can walk up and “claim” a plot; refresh loses it (expected).

### Phase 4 — Auth + database + real claims (me + your Clerk/Neon keys)

- Clerk sign-in (Google + email is enough)
- Drizzle schema: `users`, `plots`, `connections`, `mrr_snapshots`, `house_tiers`
- Seed 32 plots on first migrate
- `GET /plots`, `POST /plots/:id/claim`
- Unique constraint so two simultaneous claims → one winner, loser gets `409 already claimed`
- Rate-limit claims
- One plot per user enforced in the API
- Client uses the API instead of local memory

**Gate:** Refresh keeps your claim. Two browsers, same plot → only one owner.

### Phase 5 — Houses from fake MRR (me)

Do this **before** Stripe. Visual loop must work with stub data.

- Primitive houses (boxes / cones / stacked meshes), one look per tier
- Seed a few claimed plots with fake MRR so the planet is not empty
- Construction animation: short scaffold / scale-up (~1.5s) on tier change
- HUD: your plot, “Connect billing (coming)” placeholder, public-MRR toggle (wired, no-ops until Phase 7)
- Nameplate: owner display name + tier; exact $ only if `is_mrr_public`

**Gate:** You can walk the planet and see different-sized houses. Changing a stub MRR in the DB + refresh plays construction.

### Phase 6 — MRR module, isolated (me)

Pure TypeScript. No HTTP, no Three.js.

- Input: messy subscription list
- Output: `mrr_cents` using the rules in §1
- Fixtures + tests for: trial, canceled-in-period, past-due, annual, weekly, multi-sub, proration, non-USD skip
- `POST /internal/mrr/refresh` exists but can run against fixtures

**Gate:** Tests pass and match hand-calculated numbers. No UI yet.

### Phase 7 — Stripe Connect (me writes code; you finish the Stripe dashboard)

- OAuth start + callback routes from `About.md` §10
- Read-only scopes only
- Encrypt tokens at rest
- After connect: run MRR once, write snapshot, spawn tent/shack/etc.
- `PATCH /connections/:id` for `is_mrr_public`
- Never log tokens; never send them to the client

**Gate:** You connect a **test** Stripe account, a house appears at the right tier.

### Phase 8 — Polar (same pattern as Stripe)

- Polar OAuth app you create; I wire start/callback + the same MRR module
- Same encryption, same snapshot table, same house path

**Gate:** Same as Stripe, with a Polar test account. If Polar review is slow, ship with Stripe only and leave Polar as “coming soon.”

### Phase 9 — Hourly refresh (me)

- `node-cron` every hour: refresh all connections, write snapshots, detect tier changes
- Realtime event `house:tier_changed` so people already on the planet see construction live
- Simple admin log: last refresh time, failures (token expired → mark connection broken, do not crash the job)

**Gate:** Change MRR in the test account, wait for a refresh (or hit the internal route), house updates without a reload.

### Phase 10 — Multiplayer (me)

Only after a solo loop works.

- Socket.io: other players’ positions (throttled, ~10–15 Hz)
- Broadcast **after** DB writes: `plot:claimed`, `house:tier_changed`
- Join cap ~20 on one planet (Messenger-style calm, not a crowd)
- Disconnect = player mesh disappears; claims stay in Postgres

**Gate:** Two browsers see each other walk. One claims a plot, the other sees the marker flip without refresh.

### Phase 11 — Ship

- README: env vars, how to run, what is real vs stubbed
- Deploy one Node service to Railway
- Clerk production keys, Neon production branch, Stripe **live** Connect (only when you are ready)
- Privacy page: we store read-only billing tokens, MRR is private by default
- Soft launch to a few founder friends

**Gate:** A stranger can open the URL, sign in, claim, connect, and other people see the house.

---

## 4. Critical path (what actually delays launch)

```
Stripe Connect signup (you, start Day 0)
        │
        ▼
Playtest movement (Phase 2) ──► plots ──► auth/DB ──► stub houses
                                                       │
                              MRR tests (Phase 6) ─────┤  (I do these in parallel)
                                                       ▼
                                              Stripe OAuth (Phase 7)
                                                       │
                                              Polar can slip to v1.1
                                                       ▼
                                              cron + multiplayer + deploy
```

Longest waits that are **not code**: Stripe Connect platform approval, Polar OAuth app, you playtesting movement.

---

## 5. Repo shape (when we start coding)

```
/
  About.md
  Plan.md
  Division-of-Work.md
  package.json                 # pnpm workspaces
  client/                      # Vite + Three.js
    src/movement/              # sphere walk — do not reimplement elsewhere
    src/world/                 # planet, plots, houses
    src/net/                   # REST + socket
  server/
    src/db/                    # drizzle schema + migrations
    src/routes/                # plots, oauth, connections
    src/mrr/                   # isolated, tested
    src/realtime/              # socket.io
    src/crypto/                # token encrypt/decrypt
  .env.example
  README.md
```

---

## 6. API (v1)

| Method | Path | Notes |
|---|---|---|
| — | Clerk-hosted auth | No custom `/auth` |
| GET | `/plots` | All plots + public tier / optional MRR |
| POST | `/plots/:id/claim` | Auth, 1 per user, race-safe |
| GET | `/integrations/stripe/oauth/start` | Auth required, must own a plot |
| GET | `/integrations/stripe/oauth/callback` | |
| GET | `/integrations/polar/oauth/start` | |
| GET | `/integrations/polar/oauth/callback` | |
| PATCH | `/connections/:id` | Toggle `is_mrr_public` |
| POST | `/internal/mrr/refresh` | Secret header, cron + manual |

Realtime (not source of truth): `player:move`, `plot:claimed`, `house:tier_changed`.

---

## 7. Security (non-negotiable from day one)

- Encrypt OAuth tokens at rest; key only in env
- Read-only provider scopes
- MRR hidden unless opted in
- Rate-limit claim + OAuth start
- Internal refresh route locked by a secret
- No financial write APIs, ever

---

## 8. What we cut if time gets tight

Drop in this order. The game still makes sense.

1. Polar (Stripe only)
2. Live construction for *other* players (they see the new house on next fetch)
3. Socket positions (ghosts / “others online” count instead)
4. Fancy construction VFX (instant swap + a 1-line toast)
5. Custom domain (use Railway URL)

Never cut: sphere movement, persisted claims, MRR module tests, token encryption, 1-plot-per-user.

---

## 9. After v1 (do not start these now)

- Real house models (Blender / Kenney pack)
- High-water-mark toggle if founders hate shrinking
- FX conversion
- Second planet when 32 plots fill
- Jump / hop (Messenger has it; we don’t need it to ship)
- In-world nameplates + emoji wave
- Multiple plots per user

---

## 10. How we work from here

1. You do Phase 0 in `Division-of-Work.md` (accounts + the 3 leftover decisions if you want different defaults).
2. You say **go** (or “start Phase 1 now”), **or** paste `prompts/01-repo-skeleton.md` into this chat or another agent.
3. After each prompt’s Gate, playtest (especially movement), then paste the next file in `prompts/`.
4. We march the phases in order. I will not invent features outside this plan unless you ask.

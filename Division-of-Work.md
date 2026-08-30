# You vs me — accounts, research, and who does what

Companion to `Plan.md`. Use this as a checklist. I cannot create Stripe/Polar/Clerk/Neon accounts or click through OAuth consents for you. I can write almost all of the product once those keys exist.

---

## 1. The short version

**You:** companies, keys, money, taste, legal, live billing accounts.  
**Me:** the repo, the planet, the APIs, the MRR math, the houses, deploy config.  
**Together:** movement feel, Stripe/Polar “does this house look right,” launch.

Start **today**: Stripe Connect + Clerk + Neon. Those are the only things that can stall us.

---

## 2. Things only you can do

Check these off. Order matches how soon we need them.

### Today (Phase 0) — do these even if I have not written code yet

- [ ] Play [Messenger](https://messenger.abeto.co/) for 10–15 minutes. Write 5 notes: planet size, walk speed, camera height, how quiet the UI is, how other players show up. Drop the notes in this folder or in chat.
- [ ] Create a [Clerk](https://dashboard.clerk.com) application (dev instance). Enable Google + email. Copy publishable key + secret key.
- [ ] Create a [Neon](https://neon.tech) project. Copy the connection string.
- [ ] Create a [Stripe](https://dashboard.stripe.com) account if you do not have one. Start **Connect** / platform setup. This can take days. Use test mode first.
- [ ] Create a [Polar](https://polar.sh) account and an OAuth application (read subscriptions/orders). If review is slow, we ship Stripe first.
- [ ] Generate a random 32-byte hex string for `TOKEN_ENCRYPTION_KEY` (I can generate it when we add `.env`; you store it somewhere safe, not in git).
- [ ] Decide if you accept the defaults in `Plan.md` §1 (1 plot, houses shrink with MRR, USD only). If not, reply with changes **before** Phase 4.

### When we reach auth (Phase 4)

- [ ] Paste Clerk + Neon values into `.env` (I will give you the exact variable names).
- [ ] In Clerk, add `http://localhost:5173` (or whatever we use) as an allowed origin / redirect.

### When we reach Stripe (Phase 7)

- [ ] In Stripe Dashboard: Connect settings, redirect URI I will give you (e.g. `http://localhost:3000/integrations/stripe/oauth/callback`).
- [ ] Copy Connect client id, secret, webhook secret if we add webhooks later (v1 can skip webhooks and just poll).
- [ ] Have a **second** Stripe account (or Stripe test “connected account”) you can OAuth with, so we are not connecting the platform to itself.
- [ ] Click through the real OAuth consent screen and confirm a house appears.

### When we reach Polar (Phase 8)

- [ ] Same as Stripe: redirect URI, client id/secret, a test Polar org with at least one subscription.
- [ ] Click through OAuth once.

### Before anyone else plays (Phase 11)

- [ ] Railway (or Fly) account + GitHub if we deploy from git.
- [ ] Clerk **production** instance + production URLs.
- [ ] Neon production branch (or same project, production connection string).
- [ ] Stripe **live** Connect only when you are ready for real founders. Test mode is enough for a private demo.
- [ ] A privacy blurb: we store read-only billing tokens, we compute MRR, numbers are private unless you opt in. You own the words; I can draft.
- [ ] Optional: buy a domain and point DNS. Not required for first demo.

### Taste and product (ongoing)

- [ ] Playtest every phase gate in `Plan.md`. Especially **Phase 2 movement**. If walking feels wrong, say so immediately.
- [ ] Pick a name, if “Startup Village” is not final.
- [ ] Later (not v1): hire or make real house models. I will ship primitive geometry so we are not blocked on art.

---

## 3. Things I can do without you

I start these as soon as you say go.

| Work | Phase | Needs your keys? |
|---|---|---|
| Monorepo, Vite, Fastify, README, `.env.example` | 1 | No |
| Sphere + walk + camera | 2 | No |
| Fibonacci plots, E-to-claim (local) | 3 | No |
| Schema, migrations, claim API, race handling | 4 | Yes — Clerk + Neon |
| Primitive houses, construction animation, stub MRR | 5 | Neon only |
| MRR module + fixture tests | 6 | No |
| Stripe OAuth routes + encryption | 7 | Yes — Stripe |
| Polar OAuth routes | 8 | Yes — Polar |
| Hourly cron + tier-change events | 9 | Same as 7 |
| Socket.io positions + claim broadcasts | 10 | No extra accounts |
| Railway config, production env checklist | 11 | You create the host account |

I will not: invent extra game features, add a second planet, write financial data back to Stripe/Polar, or skip MRR tests.

---

## 4. Resources you need

### Accounts (create these)

| Service | What it is for | Cost to start | Link |
|---|---|---|---|
| Clerk | Sign in | Free tier is enough | [clerk.com](https://clerk.com) |
| Neon | Postgres | Free tier | [neon.tech](https://neon.tech) |
| Stripe | Connect OAuth + test subscriptions | Free; they take a cut of *their* users’ payments, not ours | [dashboard.stripe.com](https://dashboard.stripe.com) |
| Polar | Second billing provider | Free to start | [polar.sh](https://polar.sh) |
| Railway or Fly.io | Host the Node app + WebSockets | Railway hobby is typically a few $/mo once you leave the trial | [railway.app](https://railway.app) / [fly.io](https://fly.io) |
| GitHub | Repo + optional deploy | Free | — |

No AWS, no Docker-in-prod required. No custom email server (Clerk handles that).

### Keys that will live in `.env` (never commit)

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

I will add the exact names when the skeleton exists.

### Optional later (not blocking v1)

- Domain (~$12/year)
- Kenney or itch.io low-poly house pack, or a Blender freelancer
- Lo-fi loop for ambience (Messenger’s vibe; license it, don’t rip it)
- Sentry (error tracking) once real users exist

### Money reality

Building locally is **$0**. A public demo is roughly **$0–10/month** (Railway + leftover free tiers). Stripe/Polar do not charge us for reading MRR. You do not need a 3D artist or a designer to ship v1.

---

## 5. What you should look into (so you are not surprised)

Read these enough to know what you are clicking. You do not need to implement them.

### Must understand (you will click these dashboards)

1. **[Messenger](https://messenger.abeto.co/)** — the feel we are stealing: tiny planet, no invisible walls, calm multiplayer. Built with Three.js + WebSockets, ~10 players per instance. We are a different game (land + MRR), same *physical* toy.
2. **[Stripe Connect](https://docs.stripe.com/connect)** — we are a **platform**. Founders connect *their* Stripe. We request **read** access to subscriptions. We never charge their customers. Look at “OAuth” / “Standard” vs “Express”; I will tell you which button when we get there. Start the platform application early.
3. **[Polar API / OAuth](https://docs.polar.sh)** — same idea as Stripe, different dashboard. Confirm they still expose subscription list + interval + amount. If their OAuth is painful, we delay Polar.
4. **Clerk** — social login, allowed origins, prod vs dev keys. 10 minutes in the dashboard is enough.

### Good to skim (I implement these)

5. **Three.js on a sphere** — `About.md` §4 is the algorithm. If you want intuition: position is always `R` from center; “up” is away from the center. [This](https://threejs.org/docs/) is the library, not a tutorial you must finish.
6. **MRR definition** — we will *not* trust Stripe’s “MRR” number. We sum normalized active subscriptions. Know that founders will argue about trials and past-due; our rules are in `Plan.md` §1.
7. **Token encryption** — we store OAuth tokens in Postgres, encrypted. If `TOKEN_ENCRYPTION_KEY` is lost, everyone must reconnect. Back it up.
8. **Fibonacci sphere** — how we place 32 plots evenly. You do not need the math; just know we will not `Math.random()` them.

### Legal / trust (you own this)

9. Privacy: you store **read-only** billing credentials and derived MRR. Say that in plain language before public launch.
10. Stripe/Polar ToS: connecting another company’s account is allowed as a platform; you are not a bank and you do not move money.
11. Do not scrape or store card numbers. We never see them.

### You can ignore for v1

- React Three Fiber, Cannon/Rapier physics, Colyseus, Supabase Realtime, Kubernetes, Redis, WebGPU, mobile wrappers, procedural architecture papers.

---

## 6. What I need from you at each gate

| When | I need | You do |
|---|---|---|
| Start | “Go” + any decision overrides | Message in chat |
| End of Phase 2 | 10 minutes walking | “Feels good” / “too fast” / “camera flips at the pole” |
| Start of Phase 4 | Clerk + Neon keys | Paste into `.env` |
| End of Phase 4 | Two browser windows | Try to steal the same plot |
| Start of Phase 7 | Stripe Connect ids + a test connected account | Dashboard + one OAuth click |
| Start of Phase 8 | Polar app ids + a test org | Same |
| Phase 11 | Railway login | I write the config; you click deploy / add env vars |

If a key is missing I will stub that part and keep going (fake MRR, no Polar, etc.). I will not invent live billing without your accounts.

---

## 7. Suggested calendar if we want this ASAP

Assume you can spend ~30–60 minutes a day on accounts and playtests, and I am building in between.

| Day | You | Me |
|---|---|---|
| 0 | Messenger notes, Clerk, Neon, start Stripe Connect | Phase 1 skeleton |
| 1 | Walk the planet, complain about feel | Phase 2 until you like it |
| 2 | — | Phase 3 plots |
| 3 | Drop Clerk + Neon keys, try claiming | Phase 4 persistence |
| 4 | Walk a planet with stub houses | Phase 5 + 6 (houses + MRR tests) |
| 5+ | Stripe dashboard + OAuth click | Phase 7 |
| Next | Polar if ready | Phase 8–10 |
| Ship | Railway env vars, privacy sentence | Phase 11 |

Stripe approval slipping is the usual delay. That is why stub houses exist — you can demo the village to friends with fake MRR before Connect is live.

---

## 8. Risks that are yours vs mine

| Risk | Whose problem | What we do |
|---|---|---|
| Walking feels nauseating or flips at poles | Both | We stay on Phase 2 until it is good |
| Stripe Connect review is slow | You (waiting) | Demo with stub MRR; Polar later |
| Polar OAuth incomplete / review | You + product | Ship Stripe only |
| Two people claim one plot | Me | Unique constraint + 409 |
| Token leak | Both | Encrypt, never log, rotate key = everyone reconnects |
| Founders angry about “wrong MRR” | Product | Document the rules in-app later; tests now |
| Empty planet at launch | You | Invite 10 founders; I can seed a few demo houses |

---

## 9. Reply checklist (copy into chat)

When you are ready:

```
Go: yes

Decisions: accept Plan.md defaults  /  here are changes: …

Messenger notes:
1.
2.
3.
4.
5.

Accounts I have created: Clerk / Neon / Stripe / Polar / none yet
```

I will start at Phase 1 as soon as you say go. If you already have Clerk or Neon, say so and we skip that wait.

# PROMPT 13 — Deploy and README

You are a coding agent. The game works locally. Make it shippable. Do not add features.

## Do this

1. **README** (rewrite so a stranger can run it):
   - What the game is (3 sentences)
   - Stack
   - `pnpm install`, `.env`, migrate, `pnpm dev`
   - Every env var and where to get it
   - Stripe + Polar redirect URIs for local and prod
   - What is real vs stubbed (e.g. “Polar coming soon”)
   - How to run MRR tests
   - How to hit `/internal/mrr/refresh`

2. **Production serve:** Fastify serves `client/dist` in production. One Node process. Socket.io on the same server.

3. **Railway (or Fly) config:** `railway.toml` or Dockerfile if needed. `PORT` from env. Do not hardcode localhost in production builds — use env for Clerk, API, and public URL.

4. **Privacy page** at `/privacy` (static HTML is fine): we store read-only billing tokens, we compute MRR ourselves, numbers are private unless the owner opts in, we never charge customers or write to their Stripe/Polar. Keep it short. Human will edit legal wording later.

5. `.env.example` complete and accurate. `.gitignore` includes `.env`.

## Do not

- Turn on Stripe live mode
- Add analytics SDKs without asking
- Force a custom domain
- Check in keys

## Gate

README is enough to run locally. `pnpm build` works. A deploy file exists. Privacy route loads.

When finished, note in README: “Phase 13 done — ready to host.”

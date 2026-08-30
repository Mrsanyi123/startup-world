# App spec: tiny-planet land & MRR game

Reference document. Drop this into context for any AI (or human) working on the app — it should cover everything needed to understand the concept, data model, and integrations without re-deriving them from scratch each time.

## 1. Elevator pitch

A browser-based 3D game where each player walks around the surface of a small planet, claims empty plots of land, and connects a plot to their startup's Stripe or Polar account. The plot then grows a house sized and styled to that startup's current MRR — small shack at low MRR, growing into bigger and more elaborate structures as MRR climbs, with a visible "construction" moment each time it crosses a tier.

## 2. Core gameplay loop

1. Player spawns on the planet's surface and walks around (WASD/arrows).
2. Player finds an unclaimed plot and claims it.
3. Player optionally connects a Stripe or Polar account to their claimed plot.
4. The app computes that account's MRR on a schedule and stores it.
5. The plot's house tier updates based on current MRR; a construction animation plays on tier changes.
6. Other players walking by can see the house (and, if the owner made it public, the MRR/tier).

## 3. Glossary

- **Plot** — a fixed location on the planet's surface that can be claimed by one player.
- **Tier** — one of a fixed set of house sizes/styles, unlocked at MRR thresholds.
- **Connection** — an OAuth link between a plot/user and a Stripe or Polar account.
- **MRR snapshot** — a stored, timestamped MRR value for a connection, computed by our own normalization logic (not taken as a single field from the provider).
- **Surface normal / local up** — the vector from the planet's center through a given point on its surface; used instead of world-space "down" for all movement and object orientation.

## 4. World & movement system

The planet is a sphere of fixed radius `R`. There is no flat ground plane and no traditional gravity vector — "down" is always toward the planet's center, and it's different at every point on the surface.

**Movement algorithm** (this is the load-bearing piece of the whole client — get it right once, don't reimplement it per feature):

- Character position is a 3D point constrained to lie on the sphere (`|position| == R` at all times).
- Local up = `normalize(position)`.
- A separate `facing` vector is tracked and re-projected onto the tangent plane every frame (subtract its component along `up`, then renormalize) so it never accumulates drift off the surface.
- `right = cross(facing, up)`.
- Input moves the character along combinations of `facing`/`right`, scaled by speed and delta time; after moving, the position is renormalized back onto the sphere (`normalize(position) * R`).
- Orientation (for the character model, houses, and any placed object) is rebuilt each frame from the basis `(right, up, facing)` — never from Euler angles, which misbehave near the poles.
- The camera uses the same local `up` so it stays visually "upright" relative to the ground under the character rather than world space.

Any object placed on the surface (a plot marker, a house) should be oriented using its own position's surface normal the same way, so it sits flush rather than floating or clipping.

## 5. Data model

**users**
- `id`, `display_name`, `created_at`

**plots**
- `id`
- `position` (x, y, z on the sphere — or lat/long if you prefer generating xyz on read)
- `owner_id` (nullable, FK → users)
- `status` (`unclaimed` / `claimed`)
- `claimed_at`

**connections**
- `id`
- `plot_id` (FK → plots)
- `provider` (`stripe` / `polar`)
- `access_token` (encrypted at rest)
- `refresh_token` (encrypted at rest, if applicable)
- `is_mrr_public` (bool, default false)
- `connected_at`

**mrr_snapshots**
- `id`
- `connection_id` (FK → connections)
- `mrr_cents`
- `computed_at`

**house_tiers** (static reference data, not per-user)
- `tier_index`
- `label` (e.g. "shack", "small house", "mansion")
- `mrr_threshold_cents`
- `model_ref` (which 3D asset/model to use)

## 6. Payment integrations

### Connecting an account
- Stripe: use **Stripe Connect** OAuth so the player links their own Stripe account; request read-only scopes needed to list subscriptions/invoices.
- Polar: use Polar's OAuth flow similarly, requesting read access to subscriptions/orders.
- Store only what's needed to compute MRR later; encrypt tokens at rest; never log them.

### Computing MRR
Neither provider hands you a single "MRR" field you can trust blindly — compute it yourself from active subscriptions:
- Normalize every active subscription to a monthly value (annual ÷ 12, weekly × ~4.33, etc.) and sum across the account.
- Decide explicitly, and document the decision, on each of these edge cases (do not leave them implicit):
  - Trialing subscriptions — include or exclude?
  - Subscriptions canceled but still active until period end — include until expiry?
  - Past-due / failed-payment subscriptions — still counted?
  - Subscriptions mid-proration from a recent upgrade/downgrade — use the new value or wait for the next full period?
  - Multiple subscriptions per customer, and multi-currency accounts — sum in what currency, using what conversion?
- Run this logic on a schedule (hourly/daily background job), write the result to `mrr_snapshots`, and read from that table everywhere else in the app. Don't call the provider API live on page load.
- Write this as an isolated, independently testable module. Before wiring it to anything visual, feed it deliberately messy fixture data covering every edge case above and confirm the output matches hand-calculated expectations.

### Privacy
- `connections.is_mrr_public` controls whether other players see the exact MRR number. Default to **off** — house tier is visible to everyone, but the number itself is opt-in.

## 7. House tier system

- Tiers are a fixed, ordered list (see `house_tiers` above) — e.g. tent → shack → small house → two-story house → mansion → skyscraper. Use discrete swaps, not continuous procedural generation, for v1.
- On each scheduled MRR recompute, compare the new value against `house_tiers` thresholds to find the current tier; if it changed since the last snapshot, trigger a short construction animation client-side before showing the new model.
- Houses never appear ex nihilo — even the lowest tier should have *some* structure, so a newly connected account (even at $0 MRR) still gets a visible starter shack rather than an empty plot.

## 8. Multiplayer architecture

- **Persistent state** (plot ownership, connections, MRR snapshots, tiers) lives in the database and is read/written via normal authenticated REST calls.
- **Ephemeral state** (other players' live positions, momentary events like "player X just claimed a plot") is broadcast over WebSockets.
- The realtime layer should only ever broadcast the *result* of a database write, never be the source of truth for it — a dropped WebSocket connection should never be able to cause a lost or duplicated claim.
- Handle the race case explicitly: two players attempting to claim the same plot at nearly the same time should resolve to exactly one winner (e.g. a unique constraint on `plots.owner_id` for a given plot, with the losing request getting a clear "already claimed" response).

## 9. Suggested tech stack

- Frontend: Three.js (vanilla or via `react-three-fiber`).
- Backend: Node.js (Express/Fastify) + Postgres.
- Auth: a hosted provider (Clerk, Auth.js, or Supabase auth) rather than hand-rolled.
- Realtime: Socket.io or Colyseus.
- Background jobs (MRR refresh): a simple cron (node-cron, or a hosted scheduler if deploying serverless).

## 10. Core API surface (sketch)

- `POST /auth/...` — handled by chosen auth provider.
- `GET /plots` — list all plots and their current status/tier for rendering.
- `POST /plots/:id/claim` — claim an unclaimed plot (auth required; enforces the uniqueness race rule above).
- `GET /integrations/stripe/oauth/start` / `GET /integrations/stripe/oauth/callback` — Stripe Connect flow.
- `GET /integrations/polar/oauth/start` / `GET /integrations/polar/oauth/callback` — Polar OAuth flow.
- `POST /internal/mrr/refresh` — scheduled job entry point; recomputes MRR for all active connections and writes new `mrr_snapshots`.
- `PATCH /connections/:id` — toggle `is_mrr_public`.

## 11. Security & privacy considerations

- Encrypt OAuth tokens at rest; scope them read-only wherever the provider allows it.
- Never expose raw tokens to the client.
- Treat MRR numbers as sensitive by default (see §6 privacy).
- Rate-limit the claim endpoint to prevent plot-claiming bots.

## 12. Out of scope for v1

- Continuous/procedural house geometry (tiered swaps only).
- Multiple planets or an overworld map.
- In-game currency, trading, or plot resale between players.
- Native mobile apps (browser-only).
- Any write path for financial data — this app only ever reads billing data, never modifies it.

## 13. Open questions to resolve before or during build

- If a connected account's MRR *drops* below a tier threshold, does the house downgrade/shrink, or stay at its peak tier as a kind of high-water mark? (Affects whether tier logic is `max(tier reached)` or `current tier only`.)
- What happens to a plot if the owner disconnects their Stripe/Polar account — does the house revert to the starter tier, freeze at last-known tier, or does the plot become reclaimable?
- Is there a limit on plots per user (one each, to keep it fair, or unlimited)?

Inspiration: https://messenger.abeto.co/
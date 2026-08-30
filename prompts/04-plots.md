# PROMPT 04 — Land plots (client only)

You are a coding agent. Prompts 01–03 are done: planet + working sphere-walk character.

Add claimable plots **in memory only**. No database, no Clerk, no houses yet.

Also read `About.md` (plots, surface normals).

## Goal

~32 plots scattered evenly on the planet. Walk up to an empty one, press E, it becomes yours for this session. Refresh clears it (expected).

## Placement

- Count: **32**
- Algorithm: **Fibonacci sphere** (or equivalent even spherical distribution). Do **not** use independent `Math.random()` on x/y/z (clusters at poles).
- Each plot: `id`, `position` (on sphere, length == `PLANET_RADIUS`), `status: "unclaimed" | "claimed"`, `ownerId: string | null`
- Generate positions once at boot; they must be stable for a session (fixed seed is good so layout does not jump on HMR if easy)

## Visuals

- A marker on every plot, oriented with `orientOnSurface(position)` from Prompt 02 — flush, not floating, not stabbed through the crust
- Unclaimed: obvious (e.g. pale flag / ring / stake)
- Claimed: different color; still no house
- Keep markers small so they do not hide the planet

## Interaction

- If the character is within a small range (tune: roughly 1.5–2.5 units of surface arc or Euclidean — pick one and stick to it)
- Show a prompt: “Press E to claim” (HTML overlay is fine)
- E claims that plot
- v1 rule: **one plot per player**. If they already claimed, E on another plot does nothing (or shows “You already have a plot”)
- Claiming is a function you will later swap for `POST /plots/:id/claim`. Put it in `client/src/net/plots.ts` even if it only mutates a local array today.

## Do not

- Persist to localStorage unless it is clearly labeled temporary (prefer memory)
- Add house meshes
- Add auth
- Make plots walk-blocking collisions
- Allow claiming from across the planet (range check required)

## Gate

Walk up to a stake, press E, marker changes. You cannot claim a second. Refresh loses the claim. All 32 markers sit flush and look evenly spaced.

When finished, note in README: “Phase 04 done — local plots.”

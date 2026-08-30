# PROMPT 05 — Houses and construction

You are a coding agent. Prompts 01–04 are done: planet, walk, 32 local plots.

Add **discrete house tiers** built from primitives. Use **fake MRR**. No Stripe. No procedural architecture.

Also read `About.md` §7.

## Tiers (exact)

| tierIndex | label    | mrrThresholdCents | look (primitives, distinct silhouette) |
|-----------|----------|-------------------|----------------------------------------|
| 0 | tent     | 0                 | low triangle / A-frame, canvas color   |
| 1 | shack    | 10_000            | tiny box + lean-to roof                |
| 2 | cottage  | 100_000           | house box + pitched roof + chimney     |
| 3 | house    | 500_000           | two-story, wider, two windows          |
| 4 | mansion  | 2_000_000         | wide + wings or columns, taller        |
| 5 | tower    | 5_000_000         | tall stacked shaft, obvious skyline    |

Thresholds are **cents** ($0, $100, $1k, $5k, $20k, $50k).

Rules:

- A connected plot at $0 still gets a **tent**. Empty unclaimed plots stay empty (marker only).
- House follows **current** MRR (if stub MRR drops, tier can shrink).
- Orient every house with `orientOnSurface(plot.position)`. Sit on the surface, not in it.
- Discrete swap only. No continuous blend of geometry.

Put builders in `client/src/world/houses/` — one function per tier or a map of `modelRef` → factory. No GLB downloads required.

## Fake data (required)

Seed **several** plots as claimed with different stub MRR so the planet is not empty. Example: tent, shack, cottage, house, mansion, tower all visible at once.

Add a tiny debug hook (query `?debugMrr=1` or a function on `window`) to change one plot’s stub MRR so you can test upgrades without a database.

## Construction animation

When a plot’s tier **changes**:

1. Play ~1.2–1.8s “under construction” (scaffold boxes, or old house scales down / new scales up, or both)
2. Then show the new tier mesh
3. Do not instantly pop if a tier change was detected

If the tier is unchanged, no animation.

Houses never appear from nothing without this beat the first time a plot goes from “claimed, no house” → tent (short spawn is OK).

## Nameplates (3D or HTML)

Near each house with an owner:

- Always: display name (stub names fine) + tier label
- Exact dollar amount **only** if `isMrrPublic === true`
- Default `isMrrPublic` false on stubs except 1–2 examples so we can see both states

## Do not

- Generate houses with LLMs/geometry algorithms that are not the 6 presets
- Call any payment API
- Block walking with complex colliders (optional: ignore collision entirely)

## Gate

Walk the planet and see six different silhouettes. Flip stub MRR across a threshold → construction plays → new house. Public vs hidden $ works. Houses sit flush.

When finished, note in README: “Phase 05 done — stub houses.”

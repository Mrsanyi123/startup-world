# PROMPT 02 — The planet

You are a coding agent. The repo already has Prompt 01 done: Vite + Three.js client, a placeholder sphere, Fastify health check.

Build **only the planet as a place**. No character, no WASD, no plots, no houses.

Also read `About.md` if available.

## Goal

A small, fully visible planet in the middle of the screen — the kind you can imagine walking around in a minute or two. Feel target: https://messenger.abeto.co/ (watercolor toy-world, not a realistic Earth, not a sci-fi death star).

## Constants

Put these in one place (e.g. `client/src/world/constants.ts`) and reuse later:

- `PLANET_RADIUS = 20` (tune later; do not scatter magic numbers)
- Planet mesh centered at `(0,0,0)`
- Local “up” at any surface point is `normalize(point)` — document this in a code comment

## Do this

1. Replace the placeholder sphere with a proper planet mesh:
   - SphereGeometry with enough segments to look smooth (~64×64)
   - Material: stylized, not PBR-photoreal. Soft grass / dirt / shallow-ocean colors are fine. A simple canvas/procedural texture (continents as blobs, not NASA maps) is better than a flat color.
   - Slight vertex or texture variation so it does not look like a pool ball.

2. Lighting:
   - Hemisphere light (sky vs ground)
   - One directional “sun”
   - Soft shadows optional; if they hurt perf, skip
   - Background: dusk-ish or clear-sky gradient, not default black unless it looks intentional

3. Scale cue: the whole planet must fit in view at the start (camera pulled back so the sphere is fully visible). Later the game camera will sit on the surface; for **this prompt only**, a gentle auto-orbit around the planet is OK so we can inspect it. Isolate that orbit so Prompt 03 can delete it in one place.

4. Optional polish (only if cheap): faint atmosphere shell (slightly larger transparent sphere), a tiny moon or sun disc, very slow cloud layer. Skip if it fights the silhouette.

5. Orient-on-surface helper (required — houses and plots will use it):

```ts
// given a point on/near the sphere, return a Matrix4 or quaternion
// that sits an object flush on the surface:
//   up = normalize(position)
//   pick a stable tangent forward, then right = cross(forward, up)
//   never use Euler angles
```

Export this from `client/src/world/surface.ts` (or similar). Prompt 03+ will import it. Write a one-file comment with the basis math.

## Do not

- Add a character or keyboard movement
- Add a physics engine or raycast gravity
- Use a heightmap / displaced terrain that breaks `|p| == R` (the walkable surface must stay a perfect sphere of radius `PLANET_RADIUS`)
- Load huge GLB planets or photoreal Earth textures
- Add UI chrome

## Gate

Refresh the page: a pretty tiny planet, fully visible, lit, slowly inspectable. `PLANET_RADIUS` and `orientOnSurface()` exist and are imported from one module. No character yet.

When finished, note in README: “Phase 02 done — planet only.”

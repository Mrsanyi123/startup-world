# PROMPT 03 — Character and sphere movement

You are a coding agent. Prompts 01–02 are done: a styled planet of radius `PLANET_RADIUS` at the origin, plus `orientOnSurface()`.

This is the **load-bearing** client piece. Get it right. Do not add plots, houses, auth, or UI beyond a tiny “click to play” if you need pointer lock.

Also read `About.md` §4.

## Goal

A simple character walks on the planet in any direction, never falls off, never clips through, never flips at the poles. Third-person camera stays upright relative to the **local surface**, not world +Y. Feel: https://messenger.abeto.co/ — calm, readable, a full lap in about 60–90 seconds.

## Character (v1 primitive — no custom art)

Build a readable low-poly figure from Three.js primitives (capsule / spheres / boxes), not a downloaded humanoid unless it is tiny and already in-repo.

Must include:

- Distinct front (face / hood / scarf) so facing is obvious
- Shadow or contact cue so they look planted
- Height ~0.6–1.0 world units (planet radius is 20 — do not make a giant)
- Feet sit on the sphere, not inside it (`position` length == `PLANET_RADIUS`, then offset the mesh along local up by half-height)

Optional cheap walk bob. No jump. No animations library required.

Put character construction in `client/src/character/` so we can swap the mesh later without touching movement.

## Movement algorithm (mandatory — do not substitute)

Do **not** use a physics engine, Cannon, Rapier, or raycast-down gravity.

Implement exactly this, in `client/src/movement/` (one module, reused by nothing else yet):

1. `position` is a `Vector3` constrained to the sphere: `|position| == PLANET_RADIUS` at all times.
2. Each frame: `up = position.clone().normalize()`.
3. Track `facing` (unit vector). Every frame re-project onto the tangent plane:

   ```
   facing.sub(up.clone().multiplyScalar(facing.dot(up))).normalize()
   ```

   If `facing` is degenerate (near-zero), pick a new tangent and continue. Never let it NaN.

4. `right = cross(facing, up).normalize()` (if your cross order feels mirrored, fix it once and keep it consistent with the camera).
5. WASD / arrow keys:
   - W/S along `facing`
   - A/D along `right`
   - Scale by `speed * dt`
   - `position.add(move)` then `position.normalize().multiplyScalar(PLANET_RADIUS)`
6. Rebuild the character’s matrix every frame from the basis `(right, up, facing)` — a rotation matrix or quaternion from those axes. **No Euler angles. No naive `lookAt` the world origin** (that will twist at poles). `lookAt` toward `position + facing` with `up` as the up vector is acceptable if you pass local up.
7. Mouse / pointer: click-to-look or pointer lock. Horizontal mouse moves **yaw `facing` around `up`**. Do not yaw around world Y.
8. Camera (third person):
   - Sit behind and above the character in local space: `-facing * back + up * height`
   - Camera `up` = character `up` every frame
   - Look at a point slightly above the character along `up`
   - Remove the Prompt 02 auto-orbit; keep that code deleted or clearly unused
9. Tune `speed` so walking a great-circle lap takes **~60–90 seconds**. Expose speed and camera distances as named constants.

## Input

- Keyboard: WASD + arrows
- Ignore keys when an `<input>` is focused (future HUD)
- No fly mode, no noclip

## Do not

- Reimplement this math inside the camera file as a second system
- Use OrbitControls as the gameplay camera
- Add plots, claim, jump, collisions with houses
- Use Euler `rotation.x/y/z` for the character or camera

## Gate

You can walk full circles in every direction, including over both poles, with:

- no snap / flip
- no jitter
- no sinking into the planet
- camera never “rolling” to world-up

If anything feels wrong, fix it here. Do not start Prompt 04 until a human has walked it.

When finished, note in README: “Phase 03 done — movement. Playtest before plots.”

import * as THREE from "three";
import { PLANET_RADIUS } from "../world/constants";
import { createInput } from "./input";

/**
 * Sphere-walk movement — the load-bearing client module (About.md §4).
 *
 * The algorithm, exactly and only here (the camera reuses this basis, it
 * never recomputes its own):
 *
 * 1. `position` is constrained to the sphere: |position| == PLANET_RADIUS
 *    at all times (renormalized after every step).
 * 2. Every frame: up = normalize(position).
 * 3. `facing` (unit tangent) is re-projected onto the tangent plane every
 *    frame — facing -= up * dot(facing, up), then renormalize — so it never
 *    drifts off the surface. If it degenerates (near zero / NaN), it is
 *    rebuilt from a reference axis instead of propagating garbage.
 * 4. right = normalize(cross(facing, up)). With three.js's right-handed
 *    coords this is the character's screen-right when the camera sits
 *    behind it; D strafes along +right.
 * 5. WASD/arrows move along facing/right, scaled by WALK_SPEED * dt, then
 *    the position is renormalized back onto the sphere.
 * 6. Orientation is rebuilt every frame from the orthonormal basis
 *    (right, up, -facing) via makeBasis — X×Y = (facing×up)×up = -facing = Z,
 *    so the matrix is right-handed. Local -Z is the character's front,
 *    matching character.ts and orientOnSurface(). No Euler angles anywhere.
 * 7. Horizontal mouse drag yaws `facing` around the LOCAL up (never world Y).
 * 8. The third-person camera hangs behind/above in local space
 *    (-facing * CAMERA_BACK + up * CAMERA_HEIGHT), uses the character's up
 *    as its own up every frame, and looks slightly above the feet.
 */

/** Great-circle lap is 2π·R ≈ 125.7 units → ~74 s per lap at this speed. */
export const WALK_SPEED = 1.7;
export const CAMERA_BACK = 3.4;
export const CAMERA_HEIGHT = 1.7;
export const CAMERA_LOOK_UP = 0.8;
/** Radians of yaw per pixel of horizontal drag. */
export const LOOK_SENSITIVITY = 0.005;

const REF_Y = new THREE.Vector3(0, 1, 0);
const REF_X = new THREE.Vector3(1, 0, 0);

const _move = new THREE.Vector2();
const _step = new THREE.Vector3();
const _back = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _camPos = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

export interface Movement {
  /** Point on the sphere (|position| == PLANET_RADIUS). Feet go here. */
  readonly position: THREE.Vector3;
  /** Unit tangent; re-projected every frame. Sent as `player:move` facing. */
  readonly facing: THREE.Vector3;
  /** Orientation for the character group (from the movement basis). */
  readonly quaternion: THREE.Quaternion;
  isMoving(): boolean;
  update(dt: number): void;
  /** Place the third-person camera for the current frame. */
  syncCamera(camera: THREE.PerspectiveCamera): void;
  dispose(): void;
}

export function createMovement(lookSurface: HTMLElement): Movement {
  const input = createInput(lookSurface);

  const position = new THREE.Vector3(0, 0, PLANET_RADIUS);
  const facing = new THREE.Vector3(0, 1, 0); // tangent at the spawn point
  const up = new THREE.Vector3(0, 0, 1);
  const right = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  let moving = false;

  function rebuildTangentBasis(): void {
    up.copy(position).normalize();

    // Re-project facing onto the tangent plane (step 3).
    facing.addScaledVector(up, -facing.dot(up));
    if (facing.lengthSq() < 1e-8 || Number.isNaN(facing.lengthSq())) {
      const ref = Math.abs(up.y) < 0.99 ? REF_Y : REF_X;
      facing.copy(ref).addScaledVector(up, -ref.dot(up));
    }
    facing.normalize();

    right.crossVectors(facing, up).normalize();
  }

  rebuildTangentBasis();

  return {
    position,
    facing,
    quaternion,
    isMoving: () => moving,

    update(dt: number) {
      // Yaw from mouse drag, around LOCAL up (step 7). Dragging right turns
      // the character right.
      const yaw = -input.consumeLookDeltaX() * LOOK_SENSITIVITY;
      if (yaw !== 0) facing.applyAxisAngle(up, yaw);

      rebuildTangentBasis();

      input.moveVector(_move);
      moving = _move.x !== 0 || _move.y !== 0;
      if (moving) {
        _step
          .set(0, 0, 0)
          .addScaledVector(facing, _move.y)
          .addScaledVector(right, _move.x);
        if (_step.lengthSq() > 1) _step.normalize(); // diagonals aren't faster
        position.addScaledVector(_step, WALK_SPEED * dt);
        position.normalize().multiplyScalar(PLANET_RADIUS); // step 5: back onto the sphere

        // The surface normal changed under us; refresh the basis before
        // building this frame's orientation so there is zero lag.
        rebuildTangentBasis();
      }

      _basis.makeBasis(right, up, _back.copy(facing).negate());
      quaternion.setFromRotationMatrix(_basis);
    },

    syncCamera(camera: THREE.PerspectiveCamera) {
      camera.up.copy(up); // local surface up, never world +Y
      _camPos
        .copy(position)
        .addScaledVector(facing, -CAMERA_BACK)
        .addScaledVector(up, CAMERA_HEIGHT);
      camera.position.copy(_camPos);
      _lookAt.copy(position).addScaledVector(up, CAMERA_LOOK_UP);
      camera.lookAt(_lookAt);
    },

    dispose() {
      input.dispose();
    },
  };
}

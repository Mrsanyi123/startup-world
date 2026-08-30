import * as THREE from "three";
import { PLANET_RADIUS } from "./constants";

/**
 * Surface-orientation helpers for the tiny planet.
 *
 * Basis math (used by everything that sits on the surface — characters,
 * plot markers, houses):
 *
 *   up      = normalize(position)
 *             Radially out from the planet center. This is the only "up"
 *             that exists in this game; never use world +Y as up.
 *
 *   forward = a stable tangent direction. We take a fixed reference axis
 *             (world +Y, or world +X when the point is near a pole and +Y
 *             is almost parallel to `up`) and project it onto the tangent
 *             plane:  forward = normalize(ref - up * dot(ref, up))
 *
 *   right   = cross(forward, up)
 *             Already unit length because forward ⊥ up and both are unit.
 *
 * The rotation is built directly from this orthonormal basis with
 * Matrix4.makeBasis(right, up, -forward), which is right-handed and matches
 * three.js's convention of objects facing local -Z. Never use Euler angles
 * for this — they misbehave near the poles.
 *
 * NOTE: these helpers share scratch objects to avoid per-frame allocation,
 * so they are not re-entrant. Fine for single-threaded frame code.
 */

const REF_Y = new THREE.Vector3(0, 1, 0);
const REF_X = new THREE.Vector3(1, 0, 0);

const _up = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _back = new THREE.Vector3();
const _basis = new THREE.Matrix4();

/** Local "up" at a point on/near the sphere: normalize(position). */
export function surfaceUp(
  position: THREE.Vector3,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  return out.copy(position).normalize();
}

/**
 * Clamp a point on/near the sphere back onto the exact walkable surface
 * (`|p| == PLANET_RADIUS`). Movement code should call this after every step.
 */
export function snapToSurface(
  position: THREE.Vector3,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  return out.copy(position).normalize().multiplyScalar(PLANET_RADIUS);
}

/**
 * Walk a tangent offset from `origin`, then snap back onto the sphere.
 * Safe to call in a loop — uses its own vectors.
 */
export function offsetOnSurface(
  origin: THREE.Vector3,
  rightAmt: number,
  forwardAmt: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const up = origin.clone().normalize();
  const ref = Math.abs(up.y) < 0.99 ? REF_Y : REF_X;
  const forward = ref.clone().addScaledVector(up, -up.dot(ref)).normalize();
  const right = new THREE.Vector3().crossVectors(forward, up);
  return out
    .copy(origin)
    .addScaledVector(right, rightAmt)
    .addScaledVector(forward, forwardAmt)
    .normalize()
    .multiplyScalar(PLANET_RADIUS);
}

/** Shortest-arc point between two surface positions. `t` in 0..1. */
export function slerpOnSurface(
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const na = a.clone().normalize();
  const nb = b.clone().normalize();
  const dot = Math.min(1, Math.max(-1, na.dot(nb)));
  const omega = Math.acos(dot);
  if (omega < 1e-4) return snapToSurface(a, out);
  const s = Math.sin(omega);
  return out
    .copy(na)
    .multiplyScalar(Math.sin((1 - t) * omega) / s)
    .addScaledVector(nb, Math.sin(t * omega) / s)
    .multiplyScalar(PLANET_RADIUS);
}

/**
 * Quaternion that sits an object flush on the surface at `position`:
 * local +Y points along the surface normal, local -Z faces the stable
 * tangent "forward" described in the file comment above.
 */
export function orientOnSurface(
  position: THREE.Vector3,
  out = new THREE.Quaternion(),
): THREE.Quaternion {
  _up.copy(position).normalize();

  // Reference axis for the tangent projection; swap to +X near the poles
  // where +Y is nearly parallel to `up` and the projection degenerates.
  const ref = Math.abs(_up.y) < 0.99 ? REF_Y : REF_X;
  _forward.copy(ref).addScaledVector(_up, -_up.dot(ref)).normalize();

  _right.crossVectors(_forward, _up);
  _basis.makeBasis(_right, _up, _back.copy(_forward).negate());
  return out.setFromRotationMatrix(_basis);
}

/**
 * Same basis as the movement controller: local +Y = surface up, local -Z =
 * `facing` (projected onto the tangent plane). Used for other players.
 */
export function orientWithFacing(
  position: THREE.Vector3,
  facing: THREE.Vector3,
  out = new THREE.Quaternion(),
): THREE.Quaternion {
  _up.copy(position).normalize();
  _forward.copy(facing).addScaledVector(_up, -facing.dot(_up));
  if (_forward.lengthSq() < 1e-8 || Number.isNaN(_forward.lengthSq())) {
    const ref = Math.abs(_up.y) < 0.99 ? REF_Y : REF_X;
    _forward.copy(ref).addScaledVector(_up, -_up.dot(ref));
  }
  _forward.normalize();
  _right.crossVectors(_forward, _up);
  _basis.makeBasis(_right, _up, _back.copy(_forward).negate());
  return out.setFromRotationMatrix(_basis);
}

const _quat = new THREE.Quaternion();
const _unitScale = new THREE.Vector3(1, 1, 1);

/**
 * Full transform (rotation + translation, unit scale) that places an object
 * flush on the surface at `position`. Convenience wrapper over
 * `orientOnSurface` for code that wants a Matrix4.
 */
export function surfaceTransform(
  position: THREE.Vector3,
  out = new THREE.Matrix4(),
): THREE.Matrix4 {
  orientOnSurface(position, _quat);
  return out.compose(position, _quat, _unitScale);
}

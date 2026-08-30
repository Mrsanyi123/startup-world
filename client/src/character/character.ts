import * as THREE from "three";

/**
 * The player character, built entirely from three.js primitives so it can be
 * swapped for real art later without touching movement code.
 *
 * Conventions (must match client/src/movement/):
 * - The group's local origin is at the FEET. Movement places the group at a
 *   point with `|position| == PLANET_RADIUS`, so the feet sit exactly on the
 *   sphere and every body part is offset upward (local +Y) inside the group.
 * - The front of the character (face, scarf knot) is on local -Z, matching
 *   the basis built by the movement controller and by orientOnSurface().
 */

export const CHARACTER_HEIGHT = 0.85;

export interface Character {
  group: THREE.Group;
  /** Cosmetic walk bob. Safe to call every frame. */
  update(dt: number, moving: boolean): void;
}

export type CharacterOptions = {
  /** Gold on the local walker; remotes use another color so they read apart. */
  scarfColor?: number;
};

export function createCharacter(options: CharacterOptions = {}): Character {
  const group = new THREE.Group();

  // Bobbing subgroup: the body bobs, the contact shadow does not.
  const bob = new THREE.Group();
  group.add(bob);

  const cloak = new THREE.MeshLambertMaterial({ color: 0xc1614e });
  const cream = new THREE.MeshLambertMaterial({ color: 0xf6e7cd });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3a3129 });
  const scarfMat = new THREE.MeshLambertMaterial({
    color: options.scarfColor ?? 0xe3b23c,
  });

  // Body: a small hooded cloak (capsule).
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 6, 16), cloak);
  body.position.y = 0.32;
  bob.add(body);

  // Head/hood: sphere; top lands at CHARACTER_HEIGHT.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), cloak);
  head.position.y = 0.7;
  bob.add(head);

  // Face: a flattened cream sphere sunk into the front (-Z) of the hood, so
  // which way the character points is obvious at a glance.
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 16), cream);
  face.scale.set(1, 1, 0.55);
  face.position.set(0, 0.7, -0.075);
  bob.add(face);

  const eyeGeometry = new THREE.SphereGeometry(0.02, 8, 8);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, dark);
    eye.position.set(0.045 * side, 0.72, -0.135);
    bob.add(eye);
  }

  // Scarf ring at the neck (front knot slightly bigger).
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 20), scarfMat);
  scarf.rotateX(Math.PI / 2);
  scarf.position.y = 0.58;
  bob.add(scarf);

  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), scarfMat);
  knot.position.set(0, 0.56, -0.13);
  bob.add(knot);

  // Feet stubs.
  const footGeometry = new THREE.SphereGeometry(0.055, 10, 8);
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(footGeometry, dark);
    foot.position.set(0.075 * side, 0.05, 0);
    bob.add(foot);
  }

  // Contact cue: a soft dark blob just above the surface, outside the bob
  // group so it stays planted while the body bobs.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 24),
    new THREE.MeshBasicMaterial({
      color: 0x1e2a26,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  shadow.rotateX(-Math.PI / 2);
  shadow.position.y = 0.02;
  group.add(shadow);

  let bobTime = 0;

  return {
    group,
    update(dt: number, moving: boolean) {
      if (moving) {
        bobTime += dt * 9;
        bob.position.y = Math.abs(Math.sin(bobTime)) * 0.035;
      } else {
        bob.position.y = Math.max(0, bob.position.y - dt * 0.3);
      }
    },
  };
}

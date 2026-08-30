import * as THREE from "three";
import { orientOnSurface } from "./surface";
import type { WorldPlot } from "../net/plots";
import { houseUrlForTier, loadModel, TIER_HOUSE_HEIGHT } from "./models";

/**
 * Plot houses. GLB buildings when loaded; primitive silhouettes until then
 * (and if a file fails). Feet sit on the sphere via orientOnSurface().
 */

const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

function tent(): THREE.Group {
  const g = new THREE.Group();
  const canvas = lambert(0xd4b896);
  const pole = lambert(0x6b5344);
  const cone = new THREE.ConeGeometry(0.42, 0.72, 4);
  cone.rotateY(Math.PI / 4);
  g.add(mesh(cone, canvas, 0, 0.36, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.78, 6), pole, 0, 0.39, 0));
  return g;
}

function shack(): THREE.Group {
  const g = new THREE.Group();
  const wood = lambert(0x8b6a4a);
  const roof = lambert(0x5c4030);
  g.add(mesh(new THREE.BoxGeometry(0.55, 0.38, 0.48), wood, 0, 0.19, 0));
  const lean = new THREE.BoxGeometry(0.6, 0.06, 0.56);
  const r = mesh(lean, roof, 0, 0.42, 0);
  r.rotation.z = -0.35;
  g.add(r);
  return g;
}

function cottage(): THREE.Group {
  const g = new THREE.Group();
  const wall = lambert(0xe8d5b5);
  const roof = lambert(0xb5523a);
  const brick = lambert(0x8a5a4a);
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.5, 0.58), wall, 0, 0.25, 0));
  const pitched = new THREE.ConeGeometry(0.52, 0.38, 4);
  pitched.rotateY(Math.PI / 4);
  g.add(mesh(pitched, roof, 0, 0.68, 0));
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.28, 0.1), brick, 0.22, 0.72, 0.08));
  return g;
}

function house(): THREE.Group {
  const g = new THREE.Group();
  const wall = lambert(0xf0e6d2);
  const roof = lambert(0x6b7c8a);
  const window = lambert(0x7ea0b8);
  g.add(mesh(new THREE.BoxGeometry(0.72, 0.55, 0.62), wall, 0, 0.28, 0));
  g.add(mesh(new THREE.BoxGeometry(0.72, 0.5, 0.62), wall, 0, 0.8, 0));
  const pitched = new THREE.ConeGeometry(0.55, 0.32, 4);
  pitched.rotateY(Math.PI / 4);
  g.add(mesh(pitched, roof, 0, 1.2, 0));
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.14, 0.02), window, -0.18, 0.82, -0.32));
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.14, 0.02), window, 0.18, 0.82, -0.32));
  return g;
}

function mansion(): THREE.Group {
  const g = new THREE.Group();
  const stone = lambert(0xece4d4);
  const roof = lambert(0x4a5d4e);
  const column = lambert(0xf7f1e4);
  g.add(mesh(new THREE.BoxGeometry(1.15, 0.7, 0.7), stone, 0, 0.35, 0));
  g.add(mesh(new THREE.BoxGeometry(0.4, 0.55, 0.45), stone, -0.72, 0.28, 0));
  g.add(mesh(new THREE.BoxGeometry(0.4, 0.55, 0.45), stone, 0.72, 0.28, 0));
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.12, 0.78), roof, 0, 0.76, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), column, -0.28, 0.28, -0.4));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), column, 0.28, 0.28, -0.4));
  return g;
}

function tower(): THREE.Group {
  const g = new THREE.Group();
  const stone = lambert(0xc9c2b2);
  const cap = lambert(0x5c4a3a);
  g.add(mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.7, 8), stone, 0, 0.35, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.85, 8), stone, 0, 1.1, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.9, 8), stone, 0, 1.95, 0));
  const spire = new THREE.ConeGeometry(0.28, 0.55, 8);
  g.add(mesh(spire, cap, 0, 2.65, 0));
  return g;
}

const BUILDERS: Record<number, () => THREE.Group> = {
  0: tent,
  1: shack,
  2: cottage,
  3: house,
  4: mansion,
  5: tower,
};

const CONSTRUCT_SEC = 1.4;

export interface Houses {
  group: THREE.Group;
  sync(plots: readonly WorldPlot[]): void;
  update(dt: number): void;
}

type Slot = {
  wrapper: THREE.Group;
  house: THREE.Group | null;
  tierIndex: number | null;
  construct: number | null;
  gen: number;
};

function plotSalt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function createHouses(): Houses {
  const group = new THREE.Group();
  const slots = new Map<string, Slot>();
  let primed = false;

  function place(wrapper: THREE.Group, plot: WorldPlot): void {
    wrapper.position.copy(plot.position);
    wrapper.quaternion.copy(orientOnSurface(plot.position));
  }

  function attach(slot: Slot, mesh: THREE.Group, plot: WorldPlot, animate: boolean): void {
    if (slot.house) slot.wrapper.remove(slot.house);
    slot.house = mesh;
    slot.wrapper.add(mesh);
    slot.wrapper.visible = true;
    place(slot.wrapper, plot);
    if (animate) {
      slot.construct = 0;
      slot.wrapper.scale.setScalar(0.08);
    } else {
      slot.construct = null;
      slot.wrapper.scale.setScalar(1);
    }
  }

  function setTier(slot: Slot, plot: WorldPlot, animate: boolean): void {
    const gen = ++slot.gen;
    slot.tierIndex = plot.tierIndex;
    if (plot.tierIndex === null) {
      if (slot.house) {
        slot.wrapper.remove(slot.house);
        slot.house = null;
      }
      slot.wrapper.visible = false;
      slot.construct = null;
      return;
    }
    const build = BUILDERS[plot.tierIndex] ?? tent;
    attach(slot, build(), plot, animate);
    const url = houseUrlForTier(plot.tierIndex, plotSalt(plot.id));
    const height = TIER_HOUSE_HEIGHT[plot.tierIndex] ?? 1.2;
    void loadModel(url, height)
      .then((mesh) => {
        if (slot.gen !== gen || slot.tierIndex !== plot.tierIndex) return;
        attach(slot, mesh, plot, false);
      })
      .catch(() => {
        /* keep the primitive */
      });
  }

  return {
    group,
    sync(plots: readonly WorldPlot[]) {
      const seen = new Set<string>();
      for (const plot of plots) {
        seen.add(plot.id);
        let slot = slots.get(plot.id);
        if (!slot) {
          slot = {
            wrapper: new THREE.Group(),
            house: null,
            tierIndex: null,
            construct: null,
            gen: 0,
          };
          group.add(slot.wrapper);
          slots.set(plot.id, slot);
        }
        place(slot.wrapper, plot);
        if (slot.tierIndex !== plot.tierIndex) {
          setTier(slot, plot, primed);
        }
      }
      for (const [id, slot] of slots) {
        if (!seen.has(id)) {
          group.remove(slot.wrapper);
          slots.delete(id);
        }
      }
      primed = true;
    },
    update(dt: number) {
      for (const slot of slots.values()) {
        if (slot.construct === null) continue;
        slot.construct += dt;
        const t = Math.min(1, slot.construct / CONSTRUCT_SEC);
        const s = t * t * (3 - 2 * t);
        slot.wrapper.scale.setScalar(0.08 + 0.92 * s);
        if (t >= 1) {
          slot.construct = null;
          slot.wrapper.scale.setScalar(1);
        }
      }
    },
  };
}

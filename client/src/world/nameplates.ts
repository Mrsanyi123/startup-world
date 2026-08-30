import * as THREE from "three";
import type { WorldPlot } from "../net/plots";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export interface Nameplates {
  sync(plots: readonly WorldPlot[]): void;
  update(camera: THREE.Camera): void;
  dispose(): void;
}

type Plate = {
  el: HTMLDivElement;
  position: THREE.Vector3;
  height: number;
};

const TIER_HEIGHT: Record<number, number> = {
  0: 0.9,
  1: 1.1,
  2: 1.4,
  3: 1.8,
  4: 2.05,
  5: 2.9,
};

export function createNameplates(): Nameplates {
  const root = document.createElement("div");
  root.id = "nameplates";
  document.body.appendChild(root);

  const plates = new Map<string, Plate>();
  const _world = new THREE.Vector3();
  const _ndc = new THREE.Vector3();
  const _toCam = new THREE.Vector3();

  return {
    sync(plots: readonly WorldPlot[]) {
      const seen = new Set<string>();
      for (const plot of plots) {
        if (!plot.ownerDisplayName || plot.status !== "claimed") continue;
        seen.add(plot.id);
        let plate = plates.get(plot.id);
        if (!plate) {
          const el = document.createElement("div");
          el.className = "plot-nameplate";
          root.appendChild(el);
          plate = {
            el,
            position: plot.position.clone(),
            height: 0.9,
          };
          plates.set(plot.id, plate);
        }
        plate.position.copy(plot.position);
        plate.height = TIER_HEIGHT[plot.tierIndex ?? 0] ?? 0.9;
        plate.el.replaceChildren();
        const line1 = document.createElement("span");
        const bits = [plot.ownerDisplayName];
        if (plot.tierLabel) bits.push(plot.tierLabel);
        line1.textContent = bits.join(" · ");
        plate.el.append(line1);
        if (plot.mrrCents !== null) {
          const line2 = document.createElement("span");
          line2.className = "mrr";
          line2.textContent = formatUsd(plot.mrrCents);
          plate.el.append(line2);
        }
        if (plot.connectionStatus === "broken") {
          const disc = document.createElement("span");
          disc.className = "disconnected";
          disc.textContent = "Disconnected";
          plate.el.append(disc);
        }
      }
      for (const [id, plate] of plates) {
        if (!seen.has(id)) {
          plate.el.remove();
          plates.delete(id);
        }
      }
    },
    update(camera: THREE.Camera) {
      for (const plate of plates.values()) {
        _world.copy(plate.position).normalize();
        _toCam.copy(camera.position).sub(plate.position).normalize();
        const facing = _world.dot(_toCam) > 0.08;
        _ndc.copy(plate.position).addScaledVector(_world, plate.height);
        _ndc.project(camera);
        const onScreen =
          facing &&
          _ndc.z < 1 &&
          _ndc.x > -1.15 &&
          _ndc.x < 1.15 &&
          _ndc.y > -1.15 &&
          _ndc.y < 1.15;
        if (!onScreen) {
          plate.el.style.opacity = "0";
          continue;
        }
        const x = (_ndc.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-_ndc.y * 0.5 + 0.5) * window.innerHeight;
        plate.el.style.opacity = "1";
        plate.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    },
    dispose() {
      root.remove();
      plates.clear();
    },
  };
}

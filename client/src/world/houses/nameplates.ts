import * as THREE from "three";
import { listPlots, type WorldPlot } from "../../net/plots";
import { HOUSE_TIERS, tierForMrr } from "./tiers";

/**
 * HTML nameplates floating above owned, billing-connected houses:
 * owner name + tier label always; the exact dollar amount ONLY when the
 * owner opted in (isMrrPublic) — MRR is private by default (About.md §6).
 *
 * Plates are plain divs projected to screen space each frame, hidden when
 * the house is behind the planet's horizon, off-screen, or far away.
 */

const MAX_DISTANCE = 26;

function formatMrr(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}/mo`;
}

function plateText(plot: WorldPlot): string {
  const tier = tierForMrr(plot.mrrCents ?? 0);
  let text = `${plot.ownerDisplayName ?? "?"} · ${tier.label}`;
  if (plot.isMrrPublic && plot.mrrCents !== null) {
    text += ` · ${formatMrr(plot.mrrCents)}`;
  }
  return text;
}

export interface Nameplates {
  update(camera: THREE.PerspectiveCamera): void;
  dispose(): void;
}

export function createNameplates(): Nameplates {
  const container = document.createElement("div");
  container.id = "nameplates";
  document.body.appendChild(container);

  const plates = new Map<string, { el: HTMLDivElement; lastText: string }>();
  const _pos = new THREE.Vector3();
  const _toCamera = new THREE.Vector3();
  const _up = new THREE.Vector3();

  return {
    update(camera: THREE.PerspectiveCamera) {
      for (const plot of listPlots()) {
        const hasPlate = plot.status === "claimed" && plot.mrrCents !== null;
        let plate = plates.get(plot.id);

        if (!hasPlate) {
          if (plate) {
            plate.el.remove();
            plates.delete(plot.id);
          }
          continue;
        }

        if (!plate) {
          const el = document.createElement("div");
          el.className = "nameplate";
          container.appendChild(el);
          plate = { el, lastText: "" };
          plates.set(plot.id, plate);
        }

        const text = plateText(plot);
        if (text !== plate.lastText) {
          plate.el.textContent = text;
          plate.lastText = text;
        }

        // Anchor above the house roof, along the local surface normal.
        const tier = tierForMrr(plot.mrrCents ?? 0);
        const height = HOUSE_TIERS[tier.tierIndex].height + 0.4;
        _up.copy(plot.position).normalize();
        _pos.copy(plot.position).addScaledVector(_up, height);

        // Hidden when beyond the horizon (surface normal facing away from
        // the camera), too far, or outside the view frustum.
        _toCamera.copy(camera.position).sub(_pos);
        const distance = _toCamera.length();
        const facingCamera = _up.dot(_toCamera.normalize()) > 0.02;

        _pos.project(camera);
        const onScreen =
          _pos.z < 1 && Math.abs(_pos.x) < 1.05 && Math.abs(_pos.y) < 1.05;

        if (!facingCamera || !onScreen || distance > MAX_DISTANCE) {
          plate.el.style.display = "none";
          continue;
        }

        const x = (_pos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-_pos.y * 0.5 + 0.5) * window.innerHeight;
        plate.el.style.display = "block";
        plate.el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        // Fade slightly with distance so far plates don't shout.
        plate.el.style.opacity = distance > 16 ? "0.55" : "1";
      }
    },

    dispose() {
      container.remove();
      plates.clear();
    },
  };
}

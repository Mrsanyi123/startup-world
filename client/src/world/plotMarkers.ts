import * as THREE from "three";
import { orientOnSurface } from "./surface";
import type { WorldPlot } from "../net/plots";

/**
 * Small stake-and-flag markers for plots that do not yet have a house.
 * Hidden when a house is present. Oriented with orientOnSurface().
 */

const POST_COLOR = 0x8a6f52;
const UNCLAIMED_COLOR = 0xf2ead2;
const CLAIMED_COLOR = 0xe0584f;

const postGeometry = new THREE.CylinderGeometry(0.025, 0.035, 0.5, 8);
const flagGeometry = new THREE.BoxGeometry(0.3, 0.18, 0.02);
const ringGeometry = new THREE.RingGeometry(0.45, 0.58, 24);

const postMaterial = new THREE.MeshLambertMaterial({ color: POST_COLOR });
const unclaimedFlag = new THREE.MeshLambertMaterial({ color: UNCLAIMED_COLOR });
const claimedFlag = new THREE.MeshLambertMaterial({ color: CLAIMED_COLOR });
const unclaimedRing = new THREE.MeshBasicMaterial({
  color: UNCLAIMED_COLOR,
  transparent: true,
  opacity: 0.5,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const claimedRing = unclaimedRing.clone();
claimedRing.color.set(CLAIMED_COLOR);

export interface PlotMarkers {
  group: THREE.Group;
  sync(plots: readonly WorldPlot[]): void;
  updatePlot(plot: WorldPlot): void;
  setFlagVisible(plotId: string, visible: boolean): void;
}

export function createPlotMarkers(): PlotMarkers {
  const group = new THREE.Group();
  const styled = new Map<
    string,
    { root: THREE.Group; flag: THREE.Mesh; ring: THREE.Mesh }
  >();

  function ensure(plot: WorldPlot) {
    let parts = styled.get(plot.id);
    if (!parts) {
      const root = new THREE.Group();
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.y = 0.25;
      root.add(post);

      const flag = new THREE.Mesh(flagGeometry, unclaimedFlag);
      flag.position.set(0.16, 0.4, 0);
      root.add(flag);

      const ring = new THREE.Mesh(ringGeometry, unclaimedRing);
      ring.rotateX(-Math.PI / 2);
      ring.position.y = 0.02;
      root.add(ring);

      group.add(root);
      parts = { root, flag, ring };
      styled.set(plot.id, parts);
    }
    parts.root.position.copy(plot.position);
    parts.root.quaternion.copy(orientOnSurface(plot.position));
    const claimed = plot.status === "claimed";
    parts.flag.material = claimed ? claimedFlag : unclaimedFlag;
    parts.ring.material = claimed ? claimedRing : unclaimedRing;
    parts.root.visible = plot.tierIndex === null;
    return parts;
  }

  return {
    group,
    sync(plots: readonly WorldPlot[]) {
      const seen = new Set<string>();
      for (const plot of plots) {
        seen.add(plot.id);
        ensure(plot);
      }
      for (const [id, parts] of styled) {
        if (!seen.has(id)) {
          group.remove(parts.root);
          styled.delete(id);
        }
      }
    },
    updatePlot(plot: WorldPlot) {
      ensure(plot);
    },
    setFlagVisible(plotId: string, visible: boolean) {
      const parts = styled.get(plotId);
      if (parts) parts.root.visible = visible;
    },
  };
}

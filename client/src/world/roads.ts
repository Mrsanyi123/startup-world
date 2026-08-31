import * as THREE from "three";
import { ROAD_SEGMENTS } from "@startup-village/shared";
import { orientWithFacing } from "./surface";
import { PATH_ROAD_URL, loadModelScaled, manifestForUrl } from "./models";

/**
 * Straight road pieces laid along the fixed, authored ROAD_SEGMENTS
 * (Prompt 04b, step 5). Each modular path piece is scaled to a uniform length
 * and oriented so its length runs along the segment tangent, flush on the
 * sphere via the same surface-normal technique as houses and the character.
 * Straights only — no curves/intersections this pass.
 */
const ROAD_PIECE_LENGTH = 1.95; // slight overlap between the 1.8-spaced pieces

export function createRoads(): THREE.Group {
  const group = new THREE.Group();
  const depth = manifestForUrl(PATH_ROAD_URL)?.dimensions.depth ?? 0.4;
  const scale = ROAD_PIECE_LENGTH / depth; // path model runs along local Z

  for (const seg of ROAD_SEGMENTS) {
    const pos = new THREE.Vector3(seg.position.x, seg.position.y, seg.position.z);
    const tan = new THREE.Vector3(seg.tangent.x, seg.tangent.y, seg.tangent.z);
    void loadModelScaled(PATH_ROAD_URL, scale)
      .then((piece) => {
        piece.position.copy(pos);
        piece.quaternion.copy(orientWithFacing(pos, tan));
        group.add(piece);
      })
      .catch(() => {
        /* skip a missing piece rather than blank the road */
      });
  }
  return group;
}

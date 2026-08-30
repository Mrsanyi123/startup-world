import * as THREE from "three";
import type { RemotePlayerState } from "@startup-village/shared";
import { PLANET_RADIUS } from "./constants";
import { createCharacter, type Character } from "../character/character";
import { orientWithFacing } from "./surface";

const SCARVES = [0x4aa3df, 0x7ec47a, 0xd46bb3, 0xe07a3d, 0x8b7ce0];
const LERP = 12;
const MOVE_EPS = 0.04;

function scarfForId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SCARVES[h % SCARVES.length];
}

type Remote = {
  character: Character;
  displayName: string;
  pos: THREE.Vector3;
  facing: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetFacing: THREE.Vector3;
  snapped: boolean;
  nameEl: HTMLDivElement;
};

export interface Remotes {
  group: THREE.Group;
  upsert(state: RemotePlayerState, snap: boolean): void;
  remove(id: string): void;
  clear(): void;
  update(dt: number, camera: THREE.Camera): void;
  dispose(): void;
}

export function createRemotes(): Remotes {
  const group = new THREE.Group();
  const root = document.createElement("div");
  root.id = "player-nameplates";
  document.body.appendChild(root);

  const remotes = new Map<string, Remote>();
  const _up = new THREE.Vector3();
  const _ndc = new THREE.Vector3();
  const _toCam = new THREE.Vector3();
  const _quat = new THREE.Quaternion();

  function upsert(state: RemotePlayerState, snap: boolean): void {
    let remote = remotes.get(state.id);
    if (!remote) {
      const character = createCharacter({ scarfColor: scarfForId(state.id) });
      group.add(character.group);
      const nameEl = document.createElement("div");
      nameEl.className = "player-nameplate";
      root.appendChild(nameEl);
      remote = {
        character,
        displayName: state.displayName,
        pos: new THREE.Vector3(state.x, state.y, state.z),
        facing: new THREE.Vector3(state.facingX, state.facingY, state.facingZ),
        targetPos: new THREE.Vector3(state.x, state.y, state.z),
        targetFacing: new THREE.Vector3(
          state.facingX,
          state.facingY,
          state.facingZ,
        ),
        snapped: false,
        nameEl,
      };
      remotes.set(state.id, remote);
    }
    remote.displayName = state.displayName;
    remote.nameEl.textContent = state.displayName;
    remote.targetPos.set(state.x, state.y, state.z);
    remote.targetFacing.set(state.facingX, state.facingY, state.facingZ);
    if (snap || !remote.snapped) {
      remote.pos.copy(remote.targetPos);
      remote.facing.copy(remote.targetFacing);
      remote.snapped = true;
    }
  }

  function remove(id: string): void {
    const remote = remotes.get(id);
    if (!remote) return;
    group.remove(remote.character.group);
    remote.nameEl.remove();
    remotes.delete(id);
  }

  return {
    group,
    upsert,
    remove,
    clear() {
      for (const id of [...remotes.keys()]) remove(id);
    },
    update(dt: number, camera: THREE.Camera) {
      const k = 1 - Math.exp(-LERP * dt);
      for (const remote of remotes.values()) {
        remote.pos.lerp(remote.targetPos, k);
        remote.pos.normalize().multiplyScalar(PLANET_RADIUS);
        remote.facing.lerp(remote.targetFacing, k);
        const moving = remote.pos.distanceTo(remote.targetPos) > MOVE_EPS;
        remote.character.group.position.copy(remote.pos);
        remote.character.group.quaternion.copy(
          orientWithFacing(remote.pos, remote.facing, _quat),
        );
        remote.character.update(dt, moving);

        _up.copy(remote.pos).normalize();
        _toCam.copy(camera.position).sub(remote.pos).normalize();
        const visible = _up.dot(_toCam) > 0.08;
        _ndc.copy(remote.pos).addScaledVector(_up, 1.05);
        _ndc.project(camera);
        const onScreen =
          visible &&
          _ndc.z < 1 &&
          _ndc.x > -1.15 &&
          _ndc.x < 1.15 &&
          _ndc.y > -1.15 &&
          _ndc.y < 1.15;
        if (!onScreen) {
          remote.nameEl.style.opacity = "0";
          continue;
        }
        const x = (_ndc.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-_ndc.y * 0.5 + 0.5) * window.innerHeight;
        remote.nameEl.style.opacity = "1";
        remote.nameEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    },
    dispose() {
      this.clear();
      root.remove();
    },
  };
}

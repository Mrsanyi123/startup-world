import * as THREE from "three";
import "./style.css";
import { createPlanet } from "./world/planet";
import { createSkyTexture } from "./world/sky";
import { createCharacter } from "./character/character";
import { createMovement } from "./movement/controller";
import {
  applyPlotView,
  applyTierChange,
  refreshPlots,
  listPlots,
  setStubMrr,
} from "./net/plots";
import { loadIntegrationsStatus } from "./net/integrations";
import { initAuth, onAuthChange } from "./net/auth";
import {
  connectRealtime,
  sendMove,
  MOVE_INTERVAL,
} from "./net/socket";
import { createPlotMarkers } from "./world/plotMarkers";
import { createHouses } from "./world/houses";
import { createCity } from "./world/city";
import { createNameplates } from "./world/nameplates";
import { createRemotes } from "./world/remotes";
import { createPlotInteraction } from "./interaction/plots";
import { createHud } from "./ui/hud";

const PLOT_POLL_MS = 45_000;

function consumeOAuthReturn(): {
  oauth: string | null;
  provider: string | null;
  reason: string | null;
} {
  const params = new URLSearchParams(location.search);
  const oauth = params.get("oauth");
  const provider = params.get("provider");
  const reason = params.get("reason");
  if (oauth) {
    params.delete("oauth");
    params.delete("provider");
    params.delete("reason");
    const q = params.toString();
    history.replaceState(
      {},
      "",
      `${location.pathname}${q ? `?${q}` : ""}${location.hash}`,
    );
  }
  return { oauth, provider, reason };
}

const canvas = document.querySelector("#game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing #game canvas");
}

const scene = new THREE.Scene();
scene.background = createSkyTexture();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  500,
);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const hemisphere = new THREE.HemisphereLight(0xbdd4ff, 0x6b563f, 1.1);
scene.add(hemisphere);

const sun = new THREE.DirectionalLight(0xfff0d5, 2.2);
sun.position.set(35, 25, 20);
scene.add(sun);

const planet = createPlanet();
scene.add(planet.group);

const character = createCharacter();
scene.add(character.group);

const movement = createMovement(canvas);

const plotMarkers = createPlotMarkers();
scene.add(plotMarkers.group);
const houses = createHouses();
scene.add(houses.group);
scene.add(createCity());
const nameplates = createNameplates();
const remotes = createRemotes();
scene.add(remotes.group);

let hud: ReturnType<typeof createHud>;

function syncWorld(): void {
  const plots = listPlots();
  plotMarkers.sync(plots);
  houses.sync(plots);
  nameplates.sync(plots);
  hud.sync();
}

hud = createHud(syncWorld);
const plotInteraction = createPlotInteraction(syncWorld);

syncWorld();

void (async () => {
  await initAuth();
  attachRealtime();
  await Promise.all([refreshPlots(), loadIntegrationsStatus()]);
  const returned = consumeOAuthReturn();
  syncWorld();
  if (returned.oauth === "ok") {
    hud.flash(
      `Connected ${returned.provider ?? "billing"}. House uses the new MRR snapshot.`,
      "ok",
    );
  } else if (returned.oauth === "error") {
    hud.flash(
      returned.reason === "invalid_state"
        ? "Billing connect expired — try again."
        : `Could not connect billing (${returned.reason ?? "error"}).`,
      "err",
    );
  }
})();

function attachRealtime(): void {
  void connectRealtime({
    onWelcome(_selfId, players) {
      remotes.clear();
      for (const player of players) remotes.upsert(player, true);
    },
    onPlayerJoined(player) {
      remotes.upsert(player, true);
    },
    onPlayerMoved(player) {
      remotes.upsert(player, false);
    },
    onPlayerLeft(id) {
      remotes.remove(id);
    },
    onPlotClaimed(plot) {
      applyPlotView(plot);
      syncWorld();
    },
    onHouseTierChanged(change) {
      if (!applyTierChange(change.plotId, change.tierIndex)) {
        void refreshPlots().then(syncWorld);
        return;
      }
      syncWorld();
    },
    onPresence() {
      hud.sync();
    },
  });
}

onAuthChange(() => {
  attachRealtime();
  void refreshPlots().then(syncWorld);
});

window.setInterval(() => {
  void refreshPlots().then(syncWorld);
}, PLOT_POLL_MS);

if (new URLSearchParams(location.search).has("debugMrr")) {
  (
    window as unknown as Window & {
      setStubMrr: (plotId: string, mrrCents: number) => boolean;
    }
  ).setStubMrr = (plotId, mrrCents) => {
    const ok = setStubMrr(plotId, mrrCents);
    if (ok) syncWorld();
    return ok;
  };
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener("resize", onResize);

const clock = new THREE.Clock();
let moveAccum = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);

  movement.update(dt);
  character.group.position.copy(movement.position);
  character.group.quaternion.copy(movement.quaternion);
  character.update(dt, movement.isMoving());
  movement.syncCamera(camera);
  plotInteraction.update(movement.position);
  houses.update(dt);
  nameplates.update(camera);
  remotes.update(dt, camera);

  moveAccum += dt;
  if (moveAccum >= MOVE_INTERVAL) {
    moveAccum = 0;
    sendMove(movement.position, movement.facing);
  }

  planet.update(dt);
  renderer.render(scene, camera);
});

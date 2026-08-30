import * as THREE from "three";
import { listPlots, type WorldPlot } from "../../net/plots";
import { orientOnSurface } from "../surface";
import { buildHouseForTier, buildScaffold } from "./builders";
import { tierForMrr } from "./tiers";
import type { PlotMarkers } from "../plotMarkers";

/**
 * Keeps one house (or nothing) standing on every plot, driven by CURRENT
 * stub MRR, with a construction beat on every tier change — houses never
 * pop, including the very first "claimed, no house" → tent transition.
 *
 * The layer polls the plot store each frame (32 plots — trivial) instead of
 * requiring change events, so the debug MRR hook and future server pushes
 * both "just work".
 */

const TEAR_DOWN_S = 0.35;
const SCAFFOLD_S = 0.85;
const RAISE_S = 0.4;

/** Ease-out with a small overshoot, for the raise. */
function easeOutBack(t: number): number {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

type Phase = "tear-down" | "scaffold" | "raise";

interface Construction {
  targetTier: number | null;
  phase: Phase;
  t: number;
  scaffold: THREE.Group | null;
}

interface Entry {
  root: THREE.Group;
  houseMesh: THREE.Group | null;
  shownTier: number | null;
  construction: Construction | null;
}

/** Tier the plot SHOULD show: claimed + connected → tier, otherwise none. */
function desiredTier(plot: WorldPlot): number | null {
  if (plot.status !== "claimed" || plot.mrrCents === null) return null;
  return tierForMrr(plot.mrrCents).tierIndex;
}

export interface HouseLayer {
  group: THREE.Group;
  update(dt: number): void;
  /** Tier currently standing on a plot (null while empty/under construction). */
  shownTier(plotId: string): number | null;
}

export function createHouseLayer(markers: PlotMarkers): HouseLayer {
  const group = new THREE.Group();
  const entries = new Map<string, Entry>();

  for (const plot of listPlots()) {
    const root = new THREE.Group();
    root.position.copy(plot.position);
    root.quaternion.copy(orientOnSurface(plot.position));
    group.add(root);
    entries.set(plot.id, {
      root,
      houseMesh: null,
      shownTier: null,
      construction: null,
    });
  }

  function setHouse(entry: Entry, tierIndex: number | null): void {
    if (entry.houseMesh) {
      entry.root.remove(entry.houseMesh);
      entry.houseMesh = null;
    }
    if (tierIndex !== null) {
      entry.houseMesh = buildHouseForTier(tierIndex);
      entry.root.add(entry.houseMesh);
    }
    entry.shownTier = tierIndex;
  }

  function stepConstruction(entry: Entry, plot: WorldPlot, dt: number): void {
    const c = entry.construction;
    if (!c) return;
    c.t += dt;

    if (c.phase === "tear-down") {
      const k = Math.max(0.001, 1 - c.t / TEAR_DOWN_S);
      entry.houseMesh?.scale.setScalar(k);
      if (c.t >= TEAR_DOWN_S) {
        setHouse(entry, null);
        if (c.targetTier === null) {
          entry.construction = null; // disconnect: plot goes back to marker only
          markers.setFlagVisible(plot.id, true);
          return;
        }
        c.phase = "scaffold";
        c.t = 0;
        c.scaffold = buildScaffold(c.targetTier);
        entry.root.add(c.scaffold);
      }
      return;
    }

    if (c.phase === "scaffold") {
      c.scaffold?.scale.setScalar(1 + Math.sin(c.t * 14) * 0.03);
      if (c.t >= SCAFFOLD_S) {
        if (c.scaffold) entry.root.remove(c.scaffold);
        c.scaffold = null;
        c.phase = "raise";
        c.t = 0;
        setHouse(entry, c.targetTier);
        entry.houseMesh?.scale.setScalar(0.001);
      }
      return;
    }

    // raise
    const k = Math.max(0.001, easeOutBack(Math.min(1, c.t / RAISE_S)));
    entry.houseMesh?.scale.setScalar(k);
    if (c.t >= RAISE_S) {
      entry.houseMesh?.scale.setScalar(1);
      entry.construction = null;
    }
  }

  return {
    group,

    update(dt: number) {
      for (const plot of listPlots()) {
        const entry = entries.get(plot.id);
        if (!entry) continue;

        if (entry.construction) {
          stepConstruction(entry, plot, dt);
          continue; // retargets are picked up after the current beat finishes
        }

        const target = desiredTier(plot);
        if (target === entry.shownTier) continue;

        // Tier changed → start the construction beat. Skip tear-down when
        // the plot had no house yet (first tent).
        markers.setFlagVisible(plot.id, false);
        if (entry.houseMesh) {
          entry.construction = {
            targetTier: target,
            phase: "tear-down",
            t: 0,
            scaffold: null,
          };
        } else if (target !== null) {
          const scaffold = buildScaffold(target);
          entry.root.add(scaffold);
          entry.construction = {
            targetTier: target,
            phase: "scaffold",
            t: 0,
            scaffold,
          };
        }
      }
    },

    shownTier(plotId: string): number | null {
      return entries.get(plotId)?.shownTier ?? null;
    },
  };
}

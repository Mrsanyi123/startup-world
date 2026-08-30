import * as THREE from "three";
import {
  claimPlot,
  listPlots,
  playerPlot,
  type WorldPlot,
} from "../net/plots";
import { getUserId } from "../net/auth";
import { isTyping } from "../movement/input";

/**
 * Walk-up-and-press-E claiming. Unsigned players can walk and look but
 * cannot claim. Persistence is POST /plots/:id/claim.
 */

export const CLAIM_RANGE = 2.2;
const FLASH_MS = 1600;

export interface PlotInteraction {
  update(characterPosition: THREE.Vector3): void;
  dispose(): void;
}

export function createPlotInteraction(onWorldChanged: () => void): PlotInteraction {
  const hint = document.createElement("div");
  hint.id = "plot-hint";
  document.body.appendChild(hint);

  let nearbyPlot: WorldPlot | null = null;
  let flashText: string | null = null;
  let flashUntil = 0;
  let claiming = false;

  function flash(text: string): void {
    flashText = text;
    flashUntil = performance.now() + FLASH_MS;
  }

  function setHint(text: string | null): void {
    if (text) {
      hint.textContent = text;
      hint.classList.add("visible");
    } else {
      hint.classList.remove("visible");
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== "KeyE" || isTyping() || !nearbyPlot || claiming) return;
    if (nearbyPlot.status === "claimed") return;
    const userId = getUserId();
    if (!userId) {
      flash("Sign in to claim this plot");
      return;
    }
    if (playerPlot(userId)) {
      flash("You already have a plot");
      return;
    }
    const target = nearbyPlot;
    claiming = true;
    void claimPlot(target.id)
      .then((result) => {
        if (result.ok) {
          onWorldChanged();
          flash("Plot claimed!");
        } else if (result.reason === "unauthorized") {
          flash("Sign in to claim this plot");
        } else if (result.reason === "player-has-plot") {
          onWorldChanged();
          flash("You already have a plot");
        } else if (result.reason === "already-claimed") {
          onWorldChanged();
          flash("Someone beat you to it");
        } else if (result.reason === "rate-limited") {
          flash("Too many tries — wait a moment");
        } else if (result.reason === "unconfigured") {
          flash(result.message ?? "Server is not configured for claims");
        } else {
          flash(result.message ?? "Could not claim this plot");
        }
      })
      .finally(() => {
        claiming = false;
      });
  };
  window.addEventListener("keydown", onKeyDown);

  return {
    update(characterPosition: THREE.Vector3) {
      nearbyPlot = null;
      let best = CLAIM_RANGE * CLAIM_RANGE;
      for (const plot of listPlots()) {
        const d2 = plot.position.distanceToSquared(characterPosition);
        if (d2 < best) {
          best = d2;
          nearbyPlot = plot;
        }
      }

      if (flashText && performance.now() < flashUntil) {
        setHint(flashText);
        return;
      }
      flashText = null;

      const userId = getUserId();
      if (!nearbyPlot) {
        setHint(null);
      } else if (userId && nearbyPlot.ownerId === userId) {
        setHint("Your plot");
      } else if (nearbyPlot.status === "claimed") {
        const who = nearbyPlot.ownerDisplayName ?? "someone else";
        const tier = nearbyPlot.tierLabel ? ` · ${nearbyPlot.tierLabel}` : "";
        setHint(`Claimed by ${who}${tier}`);
      } else if (userId && playerPlot(userId)) {
        setHint("You already have a plot");
      } else if (!userId) {
        setHint("Sign in to claim this plot");
      } else {
        setHint("Press E to claim this plot");
      }
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      hint.remove();
    },
  };
}

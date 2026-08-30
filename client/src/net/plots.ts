import * as THREE from "three";
import {
  DEMO_PLOTS,
  HOUSE_TIERS,
  plotLayout,
  tierForMrr,
  type PlotView,
} from "@startup-village/shared";
import { api } from "./api";

/**
 * Plot data from GET /plots. Local Fibonacci fallback is used only when the
 * API is down so walking still works; claims then cannot persist.
 */

export type WorldPlot = Omit<PlotView, "position"> & {
  position: THREE.Vector3;
};

let plots: WorldPlot[] = fallbackPlots();
let lastError: string | null = null;

function toWorld(dto: PlotView): WorldPlot {
  return {
    ...dto,
    position: new THREE.Vector3(dto.position.x, dto.position.y, dto.position.z),
  };
}

function fallbackPlots(): WorldPlot[] {
  const demos = new Map(DEMO_PLOTS.map((d) => [d.plotId, d]));
  return plotLayout().map((p) => {
    const demo = demos.get(p.id);
    if (!demo) {
      return {
        id: p.id,
        position: new THREE.Vector3(p.position.x, p.position.y, p.position.z),
        ownerId: null,
        ownerDisplayName: null,
        status: "unclaimed" as const,
        claimedAt: null,
        tierIndex: null,
        tierLabel: null,
        isMrrPublic: false,
        mrrCents: null,
        connectionId: null,
        connectionStatus: null,
        provider: null,
      };
    }
    const tier = tierForMrr(demo.mrrCents);
    return {
      id: p.id,
      position: new THREE.Vector3(p.position.x, p.position.y, p.position.z),
      ownerId: demo.userId,
      ownerDisplayName: demo.displayName,
      status: "claimed" as const,
      claimedAt: new Date(0).toISOString(),
      tierIndex: tier?.tierIndex ?? 0,
      tierLabel: tier?.label ?? "tent",
      isMrrPublic: demo.isMrrPublic,
      mrrCents: demo.isMrrPublic ? demo.mrrCents : null,
      connectionId: null,
      connectionStatus: null,
      provider: null,
    };
  });
}

export function listPlots(): readonly WorldPlot[] {
  return plots;
}

export function worldError(): string | null {
  return lastError;
}

export function playerPlot(playerId: string | null): WorldPlot | null {
  if (!playerId) return null;
  return plots.find((p) => p.ownerId === playerId) ?? null;
}

export async function refreshPlots(): Promise<readonly WorldPlot[]> {
  try {
    const res = await api("/plots");
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      lastError =
        typeof body.error === "string"
          ? body.error
          : `GET /plots failed (${res.status})`;
      return plots;
    }
    const data = (await res.json()) as PlotView[];
    plots = data.map(toWorld);
    lastError = null;
    return plots;
  } catch {
    lastError =
      "Cannot reach the server. Walking still works; claims will not persist.";
    return plots;
  }
}

export type ClaimResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not-found"
        | "already-claimed"
        | "player-has-plot"
        | "unauthorized"
        | "unconfigured"
        | "rate-limited"
        | "error";
      message?: string;
    };

export async function claimPlot(plotId: string): Promise<ClaimResult> {
  try {
    const res = await api(`/plots/${encodeURIComponent(plotId)}/claim`, {
      method: "POST",
    });
    if (res.status === 401) return { ok: false, reason: "unauthorized" };
    if (res.status === 429) return { ok: false, reason: "rate-limited" };
    if (res.status === 503) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: "unconfigured", message: body.error };
    }
    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as { code?: string };
      await refreshPlots();
      if (body.code === "already_owned") {
        return { ok: false, reason: "player-has-plot" };
      }
      return { ok: false, reason: "already-claimed" };
    }
    if (res.status === 404) return { ok: false, reason: "not-found" };
    if (!res.ok) return { ok: false, reason: "error" };
    await refreshPlots();
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "Cannot reach the server.",
    };
  }
}

export async function setMrrPublic(
  connectionId: string,
  isMrrPublic: boolean,
): Promise<boolean> {
  try {
    const res = await api(`/connections/${encodeURIComponent(connectionId)}`, {
      method: "PATCH",
      body: JSON.stringify({ isMrrPublic }),
    });
    if (!res.ok) return false;
    await refreshPlots();
    return true;
  } catch {
    return false;
  }
}

export function applyPlotView(dto: PlotView): void {
  const world = toWorld(dto);
  const i = plots.findIndex((p) => p.id === world.id);
  if (i >= 0) plots[i] = world;
  else plots.push(world);
}

export function applyTierChange(plotId: string, tierIndex: number): boolean {
  const plot = plots.find((p) => p.id === plotId);
  if (!plot) return false;
  const tier = HOUSE_TIERS.find((t) => t.tierIndex === tierIndex);
  plot.tierIndex = tierIndex;
  plot.tierLabel = tier?.label ?? plot.tierLabel;
  return true;
}

/** Local MRR change for `?debugMrr=1`, then tell the server so others see it. */
export function setStubMrr(plotId: string, mrrCents: number): boolean {
  const plot = plots.find((p) => p.id === plotId);
  if (!plot || plot.status !== "claimed") return false;
  const tier = tierForMrr(mrrCents);
  plot.mrrCents = mrrCents;
  plot.tierIndex = tier?.tierIndex ?? 0;
  plot.tierLabel = tier?.label ?? "tent";
  void api(`/plots/${encodeURIComponent(plotId)}/debug-mrr`, {
    method: "POST",
    body: JSON.stringify({ mrrCents }),
  });
  return true;
}

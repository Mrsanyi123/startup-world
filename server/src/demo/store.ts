import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  DEMO_PLOTS,
  plotLayout,
  tierForMrr,
  type PlotView,
  type Provider,
} from "@startup-village/shared";
import type { SessionUser } from "../auth/session";
import { db } from "../db";

const STORE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.demo-world.json",
);

type PlotRec = {
  id: string;
  position: { x: number; y: number; z: number };
  ownerId: string | null;
  ownerDisplayName: string | null;
  status: "unclaimed" | "claimed";
  claimedAt: string | null;
};

type ConnRec = {
  id: string;
  plotId: string;
  provider: Provider;
  isMrrPublic: boolean;
  status: "ok" | "broken";
  mrrCents: number;
};

type DiskState = {
  plots: PlotRec[];
  connections: ConnRec[];
};

const plots = new Map<string, PlotRec>();
const conns = new Map<string, ConnRec>();

export function usesMemoryStore(): boolean {
  return !db;
}

function connForPlot(plotId: string): ConnRec | undefined {
  for (const c of conns.values()) {
    if (c.plotId === plotId) return c;
  }
  return undefined;
}

function toView(plot: PlotRec, user: SessionUser | null): PlotView {
  const conn = connForPlot(plot.id);
  const isOwner = user !== null && plot.ownerId === user.id;
  const mrr = conn ? conn.mrrCents : null;
  const showMrr = mrr !== null && (conn?.isMrrPublic === true || isOwner);
  const tier = tierForMrr(mrr);
  return {
    id: plot.id,
    position: plot.position,
    ownerId: plot.ownerId,
    ownerDisplayName: plot.ownerDisplayName,
    status: plot.status,
    claimedAt: plot.claimedAt,
    tierIndex: tier?.tierIndex ?? null,
    tierLabel: tier?.label ?? null,
    isMrrPublic: conn?.isMrrPublic === true,
    mrrCents: showMrr ? mrr : null,
    connectionId: isOwner ? (conn?.id ?? null) : null,
    connectionStatus: conn ? conn.status : null,
    provider: conn?.provider ?? null,
  };
}

function persist(): void {
  const state: DiskState = {
    plots: [...plots.values()],
    connections: [...conns.values()],
  };
  writeFileSync(STORE_PATH, JSON.stringify(state), "utf8");
}

function seedFresh(): void {
  plots.clear();
  conns.clear();
  const demos = new Map(DEMO_PLOTS.map((d) => [d.plotId, d]));
  for (const p of plotLayout()) {
    const demo = demos.get(p.id);
    plots.set(p.id, {
      id: p.id,
      position: p.position,
      ownerId: demo?.userId ?? null,
      ownerDisplayName: demo?.displayName ?? null,
      status: demo ? "claimed" : "unclaimed",
      claimedAt: demo ? new Date(0).toISOString() : null,
    });
    if (!demo) continue;
    const conn: ConnRec = {
      id: `demo-conn-${p.id}`,
      plotId: p.id,
      provider: "stripe",
      isMrrPublic: demo.isMrrPublic,
      status: "ok",
      mrrCents: demo.mrrCents,
    };
    conns.set(conn.id, conn);
  }
}

function applyReserved(demo: (typeof DEMO_PLOTS)[number]): void {
  const plot = plots.get(demo.plotId);
  if (!plot) return;
  const takenByPlayer =
    plot.status === "claimed" &&
    plot.ownerId !== null &&
    !plot.ownerId.startsWith("demo-");
  if (takenByPlayer) return;
  plot.ownerId = demo.userId;
  plot.ownerDisplayName = demo.displayName;
  plot.status = "claimed";
  if (!plot.claimedAt) plot.claimedAt = new Date(0).toISOString();
  const existing = connForPlot(demo.plotId);
  if (existing) {
    existing.mrrCents = demo.mrrCents;
    existing.isMrrPublic = demo.isMrrPublic;
    return;
  }
  const conn: ConnRec = {
    id: `demo-conn-${demo.plotId}`,
    plotId: demo.plotId,
    provider: "stripe",
    isMrrPublic: demo.isMrrPublic,
    status: "ok",
    mrrCents: demo.mrrCents,
  };
  conns.set(conn.id, conn);
}

function load(): void {
  if (existsSync(STORE_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(STORE_PATH, "utf8")) as DiskState;
      if (Array.isArray(raw.plots) && raw.plots.length > 0) {
        plots.clear();
        conns.clear();
        for (const p of raw.plots) plots.set(p.id, p);
        for (const c of raw.connections ?? []) conns.set(c.id, c);
        for (const demo of DEMO_PLOTS) applyReserved(demo);
        persist();
        return;
      }
    } catch {
      /* reseed */
    }
  }
  seedFresh();
  persist();
}

if (usesMemoryStore()) load();

export function listMemoryPlotViews(user: SessionUser | null): PlotView[] {
  return [...plots.values()].map((p) => toView(p, user));
}

export function getMemoryPlotView(
  plotId: string,
  user: SessionUser | null,
): PlotView | null {
  const plot = plots.get(plotId);
  return plot ? toView(plot, user) : null;
}

export type MemoryClaimResult =
  | { ok: true; plot: PlotView }
  | { ok: false; code: "not_found" | "already_claimed" | "already_owned" };

export function claimMemoryPlot(
  plotId: string,
  user: SessionUser,
): MemoryClaimResult {
  if ([...plots.values()].some((p) => p.ownerId === user.id)) {
    return { ok: false, code: "already_owned" };
  }
  const plot = plots.get(plotId);
  if (!plot) return { ok: false, code: "not_found" };
  if (plot.status === "claimed") return { ok: false, code: "already_claimed" };
  plot.ownerId = user.id;
  plot.ownerDisplayName = user.displayName;
  plot.status = "claimed";
  plot.claimedAt = new Date().toISOString();
  persist();
  return { ok: true, plot: toView(plot, null) };
}

export function setMemoryMrrPublic(
  connectionId: string,
  user: SessionUser,
  isMrrPublic: boolean,
): { ok: true } | { ok: false; code: "not_found" | "forbidden" } {
  const conn = conns.get(connectionId);
  if (!conn) return { ok: false, code: "not_found" };
  const plot = plots.get(conn.plotId);
  if (!plot || plot.ownerId !== user.id) return { ok: false, code: "forbidden" };
  conn.isMrrPublic = isMrrPublic;
  persist();
  return { ok: true };
}

export function connectMemoryBilling(
  user: SessionUser,
  provider: Provider,
  mrrCents: number,
): { ok: true; plot: PlotView } | { ok: false; code: "no_plot" } {
  const plot = [...plots.values()].find((p) => p.ownerId === user.id);
  if (!plot) return { ok: false, code: "no_plot" };
  let conn = connForPlot(plot.id);
  if (!conn) {
    conn = {
      id: `demo-conn-${randomUUID()}`,
      plotId: plot.id,
      provider,
      isMrrPublic: false,
      status: "ok",
      mrrCents,
    };
    conns.set(conn.id, conn);
  } else {
    conn.provider = provider;
    conn.mrrCents = mrrCents;
    conn.status = "ok";
  }
  persist();
  return { ok: true, plot: toView(plot, user) };
}

export function setMemoryMrr(plotId: string, mrrCents: number): PlotView | null {
  const plot = plots.get(plotId);
  if (!plot) return null;
  let conn = connForPlot(plotId);
  if (!conn) {
    conn = {
      id: `demo-conn-${plotId}`,
      plotId,
      provider: "stripe",
      isMrrPublic: false,
      status: "ok",
      mrrCents,
    };
    conns.set(conn.id, conn);
  } else {
    conn.mrrCents = mrrCents;
  }
  persist();
  return toView(plot, null);
}


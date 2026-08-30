import { desc, eq } from "drizzle-orm";
import type { PlotView, Provider } from "@startup-village/shared";
import { tierForMrr } from "@startup-village/shared";
import type { SessionUser } from "../auth/session";
import { db } from "../db";
import { connections, mrrSnapshots, plots, users } from "../db/schema";

type PlotRow = {
  id: string;
  posX: number;
  posY: number;
  posZ: number;
  ownerId: string | null;
  status: string;
  claimedAt: Date | null;
  ownerDisplayName: string | null;
  connectionId: string | null;
  isMrrPublic: boolean | null;
  connectionStatus: string | null;
  provider: string | null;
};

async function latestMrrByConnection(): Promise<Map<string, number>> {
  if (!db) return new Map();
  const rows = await db
    .select({
      connectionId: mrrSnapshots.connectionId,
      mrrCents: mrrSnapshots.mrrCents,
    })
    .from(mrrSnapshots)
    .orderBy(desc(mrrSnapshots.computedAt));
  const latest = new Map<string, number>();
  for (const row of rows) {
    if (!latest.has(row.connectionId)) {
      latest.set(row.connectionId, row.mrrCents);
    }
  }
  return latest;
}

function toView(
  row: PlotRow,
  latestMrr: Map<string, number>,
  user: SessionUser | null,
): PlotView {
  const isOwner = user !== null && row.ownerId === user.id;
  const mrr =
    row.connectionId !== null ? (latestMrr.get(row.connectionId) ?? null) : null;
  const showMrr = mrr !== null && (row.isMrrPublic === true || isOwner);
  const tier = tierForMrr(mrr);
  const provider: Provider | null =
    row.provider === "stripe" || row.provider === "polar" ? row.provider : null;
  const connectionStatus: PlotView["connectionStatus"] = row.connectionId
    ? row.connectionStatus === "broken"
      ? "broken"
      : "ok"
    : null;
  return {
    id: row.id,
    position: { x: row.posX, y: row.posY, z: row.posZ },
    ownerId: row.ownerId,
    ownerDisplayName: row.ownerDisplayName,
    status: row.status === "claimed" ? "claimed" : "unclaimed",
    claimedAt: row.claimedAt ? row.claimedAt.toISOString() : null,
    tierIndex: tier?.tierIndex ?? null,
    tierLabel: tier?.label ?? null,
    isMrrPublic: row.isMrrPublic === true,
    mrrCents: showMrr ? mrr : null,
    connectionId: isOwner ? row.connectionId : null,
    connectionStatus,
    provider,
  };
}

const plotSelect = {
  id: plots.id,
  posX: plots.posX,
  posY: plots.posY,
  posZ: plots.posZ,
  ownerId: plots.ownerId,
  status: plots.status,
  claimedAt: plots.claimedAt,
  ownerDisplayName: users.displayName,
  connectionId: connections.id,
  isMrrPublic: connections.isMrrPublic,
  connectionStatus: connections.status,
  provider: connections.provider,
};

export async function loadAllPlotViews(
  user: SessionUser | null,
): Promise<PlotView[]> {
  if (!db) throw new Error("database unavailable");
  const [plotRows, latestMrr] = await Promise.all([
    db
      .select(plotSelect)
      .from(plots)
      .leftJoin(users, eq(users.id, plots.ownerId))
      .leftJoin(connections, eq(connections.plotId, plots.id)),
    latestMrrByConnection(),
  ]);
  return plotRows.map((row) => toView(row, latestMrr, user));
}

/** Public view (as GET /plots for a spectator) — safe to broadcast. */
export async function loadPlotView(
  plotId: string,
  user: SessionUser | null,
): Promise<PlotView | null> {
  if (!db) return null;
  const [row] = await db
    .select(plotSelect)
    .from(plots)
    .leftJoin(users, eq(users.id, plots.ownerId))
    .leftJoin(connections, eq(connections.plotId, plots.id))
    .where(eq(plots.id, plotId))
    .limit(1);
  if (!row) return null;
  const latestMrr = await latestMrrByConnection();
  return toView(row, latestMrr, user);
}

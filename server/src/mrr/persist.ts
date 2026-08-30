import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { connections, mrrSnapshots } from "../db/schema";
import { encryptToken } from "../crypto/tokens";

export type ProviderName = "stripe" | "polar";

export async function upsertConnection(input: {
  plotId: string;
  provider: ProviderName;
  accessToken: string;
  refreshToken: string | null;
  providerAccountId: string | null;
}): Promise<string> {
  if (!db) throw new Error("database unavailable");

  const accessToken = encryptToken(input.accessToken);
  const refreshToken = input.refreshToken
    ? encryptToken(input.refreshToken)
    : null;

  const [existing] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(eq(connections.plotId, input.plotId))
    .limit(1);

  if (existing) {
    await db
      .update(connections)
      .set({
        provider: input.provider,
        accessToken,
        refreshToken,
        providerAccountId: input.providerAccountId,
        status: "ok",
        lastError: null,
        connectedAt: new Date(),
      })
      .where(eq(connections.id, existing.id));
    return existing.id;
  }

  const id = randomUUID();
  await db.insert(connections).values({
    id,
    plotId: input.plotId,
    provider: input.provider,
    accessToken,
    refreshToken,
    providerAccountId: input.providerAccountId,
    status: "ok",
    lastError: null,
  });
  return id;
}

export async function insertSnapshot(
  connectionId: string,
  mrrCents: number,
): Promise<void> {
  if (!db) throw new Error("database unavailable");
  await db.insert(mrrSnapshots).values({
    id: randomUUID(),
    connectionId,
    mrrCents,
  });
}

export async function markConnectionBroken(
  connectionId: string,
  lastError: string,
): Promise<void> {
  if (!db) return;
  await db
    .update(connections)
    .set({ status: "broken", lastError: lastError.slice(0, 500) })
    .where(eq(connections.id, connectionId));
}

export async function updateConnectionTokens(
  connectionId: string,
  accessToken: string,
  refreshToken: string | null,
): Promise<void> {
  if (!db) return;
  await db
    .update(connections)
    .set({
      accessToken: encryptToken(accessToken),
      refreshToken: refreshToken ? encryptToken(refreshToken) : null,
      status: "ok",
      lastError: null,
    })
    .where(eq(connections.id, connectionId));
}

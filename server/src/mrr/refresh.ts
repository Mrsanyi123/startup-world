import { desc, eq } from "drizzle-orm";
import { tierForMrr } from "@startup-village/shared";
import { db } from "../db";
import { connections, mrrSnapshots } from "../db/schema";
import { TokenCryptoError, decryptToken, isTokenCiphertext } from "../crypto/tokens";
import { ProviderHttpError } from "../providers/errors";
import {
  listStripeSubscriptions,
  refreshStripeAccessToken,
} from "../providers/stripe";
import {
  listPolarSubscriptions,
  refreshPolarAccessToken,
} from "../providers/polar";
import { broadcastHouseTierChanged } from "../realtime";
import { computeMrr } from "./computeMrr";
import { subscriptionsFromStripe } from "./fromStripe";
import { subscriptionsFromPolar } from "./fromPolar";
import {
  insertSnapshot,
  markConnectionBroken,
  updateConnectionTokens,
} from "./persist";

const CONCURRENCY = 3;

export type RefreshResult = {
  connectionsRefreshed: number;
  failed: number;
  skipped: number;
  tierChangedPlotIds: string[];
};

type ConnRow = {
  id: string;
  plotId: string;
  provider: string;
  accessToken: string;
  refreshToken: string | null;
  providerAccountId: string | null;
};

export async function refreshAllConnections(): Promise<RefreshResult> {
  const empty: RefreshResult = {
    connectionsRefreshed: 0,
    failed: 0,
    skipped: 0,
    tierChangedPlotIds: [],
  };
  if (!db) return empty;

  const rows = await db
    .select({
      id: connections.id,
      plotId: connections.plotId,
      provider: connections.provider,
      accessToken: connections.accessToken,
      refreshToken: connections.refreshToken,
      providerAccountId: connections.providerAccountId,
    })
    .from(connections);

  const results = await mapPool(rows, CONCURRENCY, refreshOneConnection);

  for (const r of results) {
    if (r === "skipped") empty.skipped += 1;
    else if (r.ok) {
      empty.connectionsRefreshed += 1;
      if (r.tierChanged) {
        empty.tierChangedPlotIds.push(r.plotId);
        broadcastHouseTierChanged({
          plotId: r.plotId,
          tierIndex: r.tierIndex,
        });
      }
    } else {
      empty.failed += 1;
    }
  }
  return empty;
}

export async function refreshOneConnection(
  conn: ConnRow,
): Promise<
  | "skipped"
  | { ok: true; plotId: string; tierChanged: boolean; tierIndex: number }
  | { ok: false; plotId: string }
> {
  if (!isTokenCiphertext(conn.accessToken)) return "skipped";

  try {
    const tokens = await decryptAndMaybeRefresh(conn);
    const payload = await fetchSubscriptions(conn.provider, tokens, conn);
    const mapped =
      conn.provider === "polar"
        ? subscriptionsFromPolar(payload)
        : subscriptionsFromStripe(payload);
    const { mrrCents } = computeMrr(mapped.subscriptions);

    const previous = await latestMrr(conn.id);
    await insertSnapshot(conn.id, mrrCents);

    const prevTier = tierForMrr(previous);
    const nextTier = tierForMrr(mrrCents);
    const tierChanged = (prevTier?.tierIndex ?? null) !== (nextTier?.tierIndex ?? null);

    return {
      ok: true,
      plotId: conn.plotId,
      tierChanged,
      tierIndex: nextTier?.tierIndex ?? 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "refresh failed";
    const expired =
      (err instanceof ProviderHttpError && err.isUnauthorized) ||
      err instanceof TokenCryptoError;
    if (expired) await markConnectionBroken(conn.id, message);
    return { ok: false, plotId: conn.plotId };
  }
}

async function decryptAndMaybeRefresh(conn: ConnRow): Promise<{
  accessToken: string;
  refreshToken: string | null;
}> {
  const accessToken = decryptToken(conn.accessToken);
  const refreshToken = conn.refreshToken
    ? decryptToken(conn.refreshToken)
    : null;
  return { accessToken, refreshToken };
}

async function fetchSubscriptions(
  provider: string,
  tokens: { accessToken: string; refreshToken: string | null },
  conn: ConnRow,
): Promise<unknown> {
  try {
    return await listForProvider(provider, tokens.accessToken, conn);
  } catch (err) {
    if (
      !(err instanceof ProviderHttpError) ||
      !err.isUnauthorized ||
      !tokens.refreshToken
    ) {
      throw err;
    }
    const refreshed = await refreshTokens(provider, tokens.refreshToken);
    await updateConnectionTokens(
      conn.id,
      refreshed.accessToken,
      refreshed.refreshToken ?? tokens.refreshToken,
    );
    return listForProvider(provider, refreshed.accessToken, conn);
  }
}

async function listForProvider(
  provider: string,
  accessToken: string,
  conn: ConnRow,
): Promise<unknown> {
  if (provider === "polar") return listPolarSubscriptions(accessToken);
  return listStripeSubscriptions({
    accessToken,
    accountId: conn.providerAccountId,
  });
}

async function refreshTokens(
  provider: string,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string | null }> {
  if (provider === "polar") {
    const next = await refreshPolarAccessToken(refreshToken);
    return {
      accessToken: next.access_token,
      refreshToken: next.refresh_token ?? refreshToken,
    };
  }
  const next = await refreshStripeAccessToken(refreshToken);
  if (!next.access_token) {
    throw new ProviderHttpError(401, "Stripe refresh returned no access token");
  }
  return {
    accessToken: next.access_token,
    refreshToken: next.refresh_token ?? refreshToken,
  };
}

async function latestMrr(connectionId: string): Promise<number | null> {
  if (!db) return null;
  const [row] = await db
    .select({ mrrCents: mrrSnapshots.mrrCents })
    .from(mrrSnapshots)
    .where(eq(mrrSnapshots.connectionId, connectionId))
    .orderBy(desc(mrrSnapshots.computedAt))
    .limit(1);
  return row?.mrrCents ?? null;
}

async function mapPool<T, R>(
  items: T[],
  n: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  const workers = Array.from(
    { length: Math.min(n, Math.max(items.length, 1)) },
    () => worker(),
  );
  if (items.length === 0) return [];
  await Promise.all(workers);
  return out;
}

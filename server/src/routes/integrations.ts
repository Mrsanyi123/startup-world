import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Provider } from "@startup-village/shared";
import { tierForMrr } from "@startup-village/shared";
import {
  CLERK_SECRET_KEY,
  TOKEN_ENCRYPTION_KEY,
  VITE_ORIGIN,
  polarConfigured,
  stripeConfigured,
} from "../env";
import { db } from "../db";
import { connections, mrrSnapshots, plots } from "../db/schema";
import { getSessionUser, upsertUser } from "../auth/session";
import {
  connectMemoryBilling,
  getMemoryPlotView,
  usesMemoryStore,
} from "../demo/store";
import { loadPlotView } from "../plots/view";
import { broadcastHouseTierChanged, broadcastPlotClaimed } from "../realtime";
import { decodeOAuthState, encodeOAuthState } from "../oauth/state";
import { parseEncryptionKey } from "../crypto/tokens";
import { computeMrr } from "../mrr/computeMrr";
import { subscriptionsFromStripe } from "../mrr/fromStripe";
import { subscriptionsFromPolar } from "../mrr/fromPolar";
import { insertSnapshot, upsertConnection } from "../mrr/persist";
import {
  exchangeStripeCode,
  listStripeSubscriptions,
  stripeAuthorizeUrl,
} from "../providers/stripe";
import {
  exchangePolarCode,
  listPolarSubscriptions,
  polarAuthorizeUrl,
} from "../providers/polar";

function gameRedirect(
  reply: FastifyReply,
  params: Record<string, string>,
): FastifyReply {
  const url = new URL(VITE_ORIGIN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return reply.redirect(url.toString());
}

function dbMissing() {
  return {
    error:
      "DATABASE_URL is not set or the database is unavailable. Add it to .env and run pnpm db:migrate.",
  };
}

async function ownerPlotId(userId: string): Promise<string | null> {
  if (!db) return null;
  const [row] = await db
    .select({ id: plots.id })
    .from(plots)
    .where(and(eq(plots.ownerId, userId), eq(plots.status, "claimed")))
    .limit(1);
  return row?.id ?? null;
}

function encryptionReady(): string | null {
  try {
    parseEncryptionKey(TOKEN_ENCRYPTION_KEY);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "TOKEN_ENCRYPTION_KEY invalid";
  }
}

async function requireOwner(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<{ userId: string; plotId: string } | null> {
  if (!db) {
    await reply.code(503).send(dbMissing());
    return null;
  }
  if (!CLERK_SECRET_KEY) {
    await reply.code(503).send({
      error: "CLERK_SECRET_KEY is not set. Add it to .env to connect billing.",
    });
    return null;
  }
  const cryptoErr = encryptionReady();
  if (cryptoErr) {
    await reply.code(503).send({ error: cryptoErr });
    return null;
  }

  const user = await getSessionUser(req);
  if (!user) {
    await reply.code(401).send({ error: "Sign in required." });
    return null;
  }
  await upsertUser(user);

  const plotId = await ownerPlotId(user.id);
  if (!plotId) {
    await reply
      .code(400)
      .send({ error: "Claim a plot before connecting billing." });
    return null;
  }
  return { userId: user.id, plotId };
}

export async function registerIntegrationRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/integrations/status", async () => {
    const missingPolar: string[] = [];
    if (!process.env.POLAR_CLIENT_ID) missingPolar.push("POLAR_CLIENT_ID");
    if (!process.env.POLAR_CLIENT_SECRET) missingPolar.push("POLAR_CLIENT_SECRET");
    if (!TOKEN_ENCRYPTION_KEY) missingPolar.push("TOKEN_ENCRYPTION_KEY");
    return {
      stripe: { configured: stripeConfigured(), demo: !stripeConfigured() },
      polar: {
        configured: polarConfigured(),
        demo: !polarConfigured(),
        missing: missingPolar,
      },
    };
  });

  app.post<{ Body: { provider?: unknown; mrrCents?: unknown } }>(
    "/integrations/demo/connect",
    async (req, reply) => {
      const user = await getSessionUser(req);
      if (!user) {
        return reply.code(401).send({ error: "Sign in required." });
      }
      const provider = req.body?.provider;
      if (provider !== "stripe" && provider !== "polar") {
        return reply
          .code(400)
          .send({ error: "Body must be { provider: \"stripe\" | \"polar\" }." });
      }
      const requested = req.body?.mrrCents;
      const mrrCents =
        typeof requested === "number" && Number.isFinite(requested)
          ? Math.max(0, Math.round(requested))
          : provider === "polar"
            ? 10_000
            : 120_000;

      if (usesMemoryStore()) {
        const result = connectMemoryBilling(user, provider, mrrCents);
        if (!result.ok) {
          return reply
            .code(400)
            .send({ error: "Claim a plot before connecting billing." });
        }
        const tier = tierForMrr(mrrCents);
        if (tier) {
          broadcastHouseTierChanged({
            plotId: result.plot.id,
            tierIndex: tier.tierIndex,
          });
        }
        const publicView = getMemoryPlotView(result.plot.id, null);
        if (publicView) broadcastPlotClaimed(publicView);
        return { ok: true, plot: result.plot, demo: true };
      }

      if (!db) {
        return reply.code(503).send(dbMissing());
      }
      await upsertUser(user);
      const plotId = await ownerPlotId(user.id);
      if (!plotId) {
        return reply
          .code(400)
          .send({ error: "Claim a plot before connecting billing." });
      }
      await upsertStubConnection(plotId, provider, mrrCents);
      const plot = await loadPlotView(plotId, user);
      const publicView = await loadPlotView(plotId, null);
      if (publicView) {
        const tier = tierForMrr(mrrCents);
        if (tier) {
          broadcastHouseTierChanged({
            plotId: publicView.id,
            tierIndex: tier.tierIndex,
          });
        }
        broadcastPlotClaimed(publicView);
      }
      return { ok: true, plot, demo: true };
    },
  );

  app.get(
    "/integrations/stripe/oauth/start",
    {
      config: { rateLimit: { max: 8, timeWindow: "10 minutes" } },
    },
    async (req, reply) => {
      if (!stripeConfigured()) {
        return reply.code(503).send({
          error:
            "Stripe is not configured. Add STRIPE_CLIENT_ID, STRIPE_SECRET_KEY, and TOKEN_ENCRYPTION_KEY.",
        });
      }
      const owner = await requireOwner(req, reply);
      if (!owner) return;

      const state = encodeOAuthState({
        userId: owner.userId,
        plotId: owner.plotId,
        provider: "stripe",
      });
      const authorizeUrl = stripeAuthorizeUrl(state);
      if (wantsJson(req)) return { authorizeUrl };
      return reply.redirect(authorizeUrl);
    },
  );

  app.get("/integrations/stripe/oauth/callback", async (req, reply) => {
    const q = req.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
    if (q.error) {
      return gameRedirect(reply, {
        oauth: "error",
        reason: q.error_description ?? q.error,
      });
    }
    const state = decodeOAuthState(q.state);
    if (!state || state.provider !== "stripe" || !q.code) {
      return gameRedirect(reply, {
        oauth: "error",
        reason: "invalid_state",
      });
    }
    if (!db) return reply.code(503).send(dbMissing());

    try {
      const tokens = await exchangeStripeCode(q.code);
      const access =
        tokens.access_token ??
        (tokens.stripe_user_id ? `stripe-account:${tokens.stripe_user_id}` : "");
      if (!access) {
        return gameRedirect(reply, {
          oauth: "error",
          reason: "no_access_token",
        });
      }
      const connectionId = await upsertConnection({
        plotId: state.plotId,
        provider: "stripe",
        accessToken: access,
        refreshToken: tokens.refresh_token ?? null,
        providerAccountId: tokens.stripe_user_id ?? null,
      });
      const payload = await listStripeSubscriptions({
        accessToken: access,
        accountId: tokens.stripe_user_id ?? null,
      });
      const mapped = subscriptionsFromStripe(payload);
      const { mrrCents } = computeMrr(mapped.subscriptions);
      await insertSnapshot(connectionId, mrrCents);
      return gameRedirect(reply, { oauth: "ok", provider: "stripe" });
    } catch (err) {
      req.log.error(
        { err: err instanceof Error ? err.message : "stripe callback" },
        "stripe oauth callback failed",
      );
      return gameRedirect(reply, { oauth: "error", reason: "stripe_failed" });
    }
  });

  app.get(
    "/integrations/polar/oauth/start",
    {
      config: { rateLimit: { max: 8, timeWindow: "10 minutes" } },
    },
    async (req, reply) => {
      if (!polarConfigured()) {
        return reply.code(503).send({
          error:
            "Polar is not configured. Add POLAR_CLIENT_ID, POLAR_CLIENT_SECRET, and TOKEN_ENCRYPTION_KEY.",
          comingSoon: true,
        });
      }
      const owner = await requireOwner(req, reply);
      if (!owner) return;

      const state = encodeOAuthState({
        userId: owner.userId,
        plotId: owner.plotId,
        provider: "polar",
      });
      const authorizeUrl = polarAuthorizeUrl(state);
      if (wantsJson(req)) return { authorizeUrl };
      return reply.redirect(authorizeUrl);
    },
  );

  app.get("/integrations/polar/oauth/callback", async (req, reply) => {
    const q = req.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
    if (q.error) {
      return gameRedirect(reply, {
        oauth: "error",
        reason: q.error_description ?? q.error,
      });
    }
    const state = decodeOAuthState(q.state);
    if (!state || state.provider !== "polar" || !q.code) {
      return gameRedirect(reply, {
        oauth: "error",
        reason: "invalid_state",
      });
    }
    if (!db) return reply.code(503).send(dbMissing());

    try {
      const tokens = await exchangePolarCode(q.code);
      const connectionId = await upsertConnection({
        plotId: state.plotId,
        provider: "polar",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        providerAccountId: null,
      });
      const payload = await listPolarSubscriptions(tokens.access_token);
      const mapped = subscriptionsFromPolar(payload);
      const { mrrCents } = computeMrr(mapped.subscriptions);
      await insertSnapshot(connectionId, mrrCents);
      return gameRedirect(reply, { oauth: "ok", provider: "polar" });
    } catch (err) {
      req.log.error(
        { err: err instanceof Error ? err.message : "polar callback" },
        "polar oauth callback failed",
      );
      return gameRedirect(reply, { oauth: "error", reason: "polar_failed" });
    }
  });
}

async function upsertStubConnection(
  plotId: string,
  provider: Provider,
  mrrCents: number,
): Promise<void> {
  if (!db) return;
  const [existing] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(eq(connections.plotId, plotId))
    .limit(1);
  const connectionId = existing?.id ?? randomUUID();
  if (existing) {
    await db
      .update(connections)
      .set({
        provider,
        accessToken: "stub",
        refreshToken: null,
        status: "ok",
        lastError: null,
        connectedAt: new Date(),
      })
      .where(eq(connections.id, existing.id));
  } else {
    await db.insert(connections).values({
      id: connectionId,
      plotId,
      provider,
      accessToken: "stub",
      refreshToken: null,
      status: "ok",
      lastError: null,
    });
  }
  await db.insert(mrrSnapshots).values({
    id: randomUUID(),
    connectionId,
    mrrCents,
  });
}

function wantsJson(req: FastifyRequest): boolean {
  const accept = req.headers.accept ?? "";
  return (
    Boolean(req.headers.authorization) || accept.includes("application/json")
  );
}

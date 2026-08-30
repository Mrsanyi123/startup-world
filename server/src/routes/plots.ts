import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { tierForMrr } from "@startup-village/shared";
import { db, isUniqueViolation } from "../db";
import { plots, users } from "../db/schema";
import { getSessionUser, upsertUser } from "../auth/session";
import { loadAllPlotViews, loadPlotView } from "../plots/view";
import {
  broadcastHouseTierChanged,
  broadcastPlotClaimed,
} from "../realtime";
import {
  claimMemoryPlot,
  getMemoryPlotView,
  listMemoryPlotViews,
  setMemoryMrr,
  usesMemoryStore,
} from "../demo/store";

function dbMissing() {
  return {
    error:
      "DATABASE_URL is not set or the database is unavailable. Add it to .env and run pnpm db:migrate.",
  };
}

export async function registerPlotRoutes(app: FastifyInstance): Promise<void> {
  app.get("/plots", async (req, reply) => {
    const user = await getSessionUser(req);
    if (usesMemoryStore()) {
      return listMemoryPlotViews(user);
    }
    if (!db) return reply.code(503).send(dbMissing());
    try {
      if (user) await upsertUser(user);
      return await loadAllPlotViews(user);
    } catch (err) {
      req.log.error(err);
      return reply.code(503).send(dbMissing());
    }
  });

  app.post<{ Params: { id: string } }>(
    "/plots/:id/claim",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const user = await getSessionUser(req);
      if (!user) {
        return reply.code(401).send({ error: "Sign in required to claim a plot." });
      }

      const plotId = req.params.id;

      if (usesMemoryStore()) {
        const result = claimMemoryPlot(plotId, user);
        if (!result.ok && result.code === "not_found") {
          return reply.code(404).send({ error: "Plot not found.", code: "not_found" });
        }
        if (!result.ok && result.code === "already_owned") {
          return reply.code(409).send({
            error: "you already have a plot",
            code: "already_owned",
          });
        }
        if (!result.ok) {
          return reply.code(409).send({
            error: "already claimed",
            code: "already_claimed",
          });
        }
        broadcastPlotClaimed(result.plot);
        return { ok: true, plotId, plot: result.plot };
      }

      if (!db) return reply.code(503).send(dbMissing());

      try {
        const result = await db.transaction(async (tx) => {
          await tx
            .insert(users)
            .values({ id: user.id, displayName: user.displayName })
            .onConflictDoUpdate({
              target: users.id,
              set: { displayName: user.displayName },
            });

          const updated = await tx
            .update(plots)
            .set({
              ownerId: user.id,
              status: "claimed",
              claimedAt: new Date(),
            })
            .where(and(eq(plots.id, plotId), eq(plots.status, "unclaimed")))
            .returning({ id: plots.id });

          if (updated.length === 0) {
            const [existing] = await tx
              .select({ id: plots.id, status: plots.status })
              .from(plots)
              .where(eq(plots.id, plotId))
              .limit(1);
            if (!existing) return { ok: false as const, code: "not_found" };
            return { ok: false as const, code: "already_claimed" };
          }
          return { ok: true as const };
        });

        if (!result.ok && result.code === "not_found") {
          return reply.code(404).send({ error: "Plot not found.", code: "not_found" });
        }
        if (!result.ok) {
          return reply.code(409).send({
            error: "already claimed",
            code: "already_claimed",
          });
        }

        const plot = await loadPlotView(plotId, null);
        if (plot) broadcastPlotClaimed(plot);
        return { ok: true, plotId, plot };
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({
            error: "you already have a plot",
            code: "already_owned",
          });
        }
        req.log.error(err);
        return reply.code(503).send(dbMissing());
      }
    },
  );

  if (process.env.NODE_ENV !== "production") {
    app.post<{ Params: { id: string }; Body: { mrrCents?: unknown } }>(
      "/plots/:id/debug-mrr",
      async (req, reply) => {
        const mrrCents = req.body?.mrrCents;
        if (typeof mrrCents !== "number" || !Number.isFinite(mrrCents)) {
          return reply.code(400).send({ error: "Body must be { mrrCents: number }." });
        }
        const plotId = req.params.id;
        const tier = tierForMrr(mrrCents);
        if (!tier) {
          return reply.code(400).send({ error: "No tier for that MRR." });
        }
        if (usesMemoryStore()) {
          const plot = setMemoryMrr(plotId, mrrCents);
          if (!plot) {
            return reply.code(404).send({ error: "Plot not found." });
          }
          broadcastHouseTierChanged({ plotId, tierIndex: tier.tierIndex });
          return { ok: true, plotId, tierIndex: tier.tierIndex };
        }
        if (db) {
          const [existing] = await db
            .select({ id: plots.id })
            .from(plots)
            .where(eq(plots.id, plotId))
            .limit(1);
          if (!existing) {
            return reply.code(404).send({ error: "Plot not found." });
          }
        } else if (!getMemoryPlotView(plotId, null)) {
          return reply.code(404).send({ error: "Plot not found." });
        }
        broadcastHouseTierChanged({ plotId, tierIndex: tier.tierIndex });
        return { ok: true, plotId, tierIndex: tier.tierIndex };
      },
    );
  }
}

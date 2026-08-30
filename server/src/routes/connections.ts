import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db";
import { connections, plots } from "../db/schema";
import { getSessionUser, upsertUser } from "../auth/session";
import { setMemoryMrrPublic, usesMemoryStore } from "../demo/store";

export async function registerConnectionRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.patch<{ Params: { id: string } }>(
    "/connections/:id",
    async (req, reply) => {
      const user = await getSessionUser(req);
      if (!user) {
        return reply.code(401).send({ error: "Sign in required." });
      }

      const body = req.body as { isMrrPublic?: unknown } | null;
      if (!body || typeof body.isMrrPublic !== "boolean") {
        return reply
          .code(400)
          .send({ error: "Body must be { isMrrPublic: boolean }." });
      }

      if (usesMemoryStore()) {
        const result = setMemoryMrrPublic(req.params.id, user, body.isMrrPublic);
        if (!result.ok && result.code === "not_found") {
          return reply.code(404).send({ error: "Connection not found." });
        }
        if (!result.ok) {
          return reply.code(403).send({ error: "Not the plot owner." });
        }
        return { ok: true, isMrrPublic: body.isMrrPublic };
      }

      if (!db) {
        return reply.code(503).send({
          error:
            "DATABASE_URL is not set or the database is unavailable. Add it to .env and run pnpm db:migrate.",
        });
      }

      await upsertUser(user);

      try {
        const [row] = await db
          .select({
            connectionId: connections.id,
            ownerId: plots.ownerId,
          })
          .from(connections)
          .innerJoin(plots, eq(plots.id, connections.plotId))
          .where(eq(connections.id, req.params.id))
          .limit(1);

        if (!row) {
          return reply.code(404).send({ error: "Connection not found." });
        }
        if (row.ownerId !== user.id) {
          return reply.code(403).send({ error: "Not the plot owner." });
        }

        await db
          .update(connections)
          .set({ isMrrPublic: body.isMrrPublic })
          .where(eq(connections.id, req.params.id));

        return { ok: true, isMrrPublic: body.isMrrPublic };
      } catch (err) {
        req.log.error(err);
        return reply.code(503).send({
          error:
            "Database unavailable. Check DATABASE_URL and run pnpm db:migrate.",
        });
      }
    },
  );
}

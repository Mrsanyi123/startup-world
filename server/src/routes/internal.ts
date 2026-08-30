import type { FastifyInstance } from "fastify";
import { INTERNAL_JOB_SECRET } from "../env";
import { refreshAllConnections } from "../mrr/refresh";

export async function registerInternalRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post("/internal/mrr/refresh", async (req, reply) => {
    if (!INTERNAL_JOB_SECRET) {
      return reply.code(503).send({
        error:
          "INTERNAL_JOB_SECRET is not set. Add it to .env to enable this route.",
      });
    }
    const header = req.headers["x-internal-secret"];
    if (header !== INTERNAL_JOB_SECRET) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const result = await refreshAllConnections();
    return { ok: true, ...result };
  });
}

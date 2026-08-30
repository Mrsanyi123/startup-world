import "./env";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import cron from "node-cron";
import {
  CLERK_SECRET_KEY,
  DATABASE_URL,
  PORT,
  VITE_ORIGIN,
} from "./env";
import { sql } from "./db";
import { applyMigrations } from "./db/applyMigrations";
import { seed } from "./db/seed";
import { registerPlotRoutes } from "./routes/plots";
import { registerConnectionRoutes } from "./routes/connections";
import { registerInternalRoutes } from "./routes/internal";
import { registerIntegrationRoutes } from "./routes/integrations";
import { refreshAllConnections } from "./mrr/refresh";
import { attachRealtime } from "./realtime";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: [VITE_ORIGIN, "http://127.0.0.1:5173"],
  allowedHeaders: ["Authorization", "Content-Type", "x-internal-secret"],
});

await app.register(rateLimit, { global: false });

app.get("/health", async () => {
  return {
    ok: true,
    database: Boolean(DATABASE_URL),
    clerk: Boolean(CLERK_SECRET_KEY),
    demo: {
      auth: !CLERK_SECRET_KEY,
      store: !DATABASE_URL,
    },
  };
});

await registerPlotRoutes(app);
await registerConnectionRoutes(app);
await registerInternalRoutes(app);
await registerIntegrationRoutes(app);

async function ensureDatabase(): Promise<void> {
  if (!DATABASE_URL || !sql) {
    app.log.warn(
      "DATABASE_URL missing — serving the in-memory demo world.",
    );
    return;
  }
  try {
    await applyMigrations(sql);
    await seed();
    app.log.info("database ready (migrated + seeded)");
  } catch (err) {
    app.log.error(
      { err },
      "database setup failed — plot API will 503. Check DATABASE_URL and run pnpm db:migrate.",
    );
  }
}

if (!CLERK_SECRET_KEY) {
  app.log.warn(
    "CLERK_SECRET_KEY missing — demo sign-in is on (no Clerk).",
  );
}

await ensureDatabase();
await app.ready();
attachRealtime(app.server);

if (DATABASE_URL) {
  cron.schedule("0 * * * *", () => {
    app.log.info("hourly MRR refresh starting");
    void refreshAllConnections()
      .then((result) => app.log.info(result, "hourly MRR refresh done"))
      .catch((err: unknown) => {
        app.log.error({ err }, "hourly MRR refresh failed");
      });
  });
}

await app.listen({ port: PORT, host: "0.0.0.0" });

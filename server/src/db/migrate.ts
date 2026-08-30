import postgres from "postgres";
import { DATABASE_URL } from "../env";
import { applyMigrations } from "./applyMigrations";
import { seed } from "./seed";

async function migrate(): Promise<void> {
  if (!DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Add it to .env (Neon connection string).",
    );
    process.exit(1);
  }

  const client = postgres(DATABASE_URL, { max: 1 });
  try {
    const files = await applyMigrations(client);
    for (const file of files) console.log("Applied", file);
  } finally {
    await client.end({ timeout: 5 });
  }

  await seed();
  console.log("Seeded house tiers, 32 plots, and demo houses.");
}

try {
  await migrate();
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  const { sql } = await import("./index");
  await sql?.end({ timeout: 2 });
}

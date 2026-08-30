import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { MIGRATIONS_DIR } from "../env";

type SqlClient = {
  unsafe: (query: string) => Promise<unknown>;
};

export async function applyMigrations(client: SqlClient): Promise<string[]> {
  const names = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const name of names) {
    const body = await readFile(resolve(MIGRATIONS_DIR, name), "utf8");
    await client.unsafe(body);
  }
  return names;
}

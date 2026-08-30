import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DATABASE_URL } from "../env";
import * as schema from "./schema";

export const sql =
  DATABASE_URL.length > 0
    ? postgres(DATABASE_URL, { max: 10, idle_timeout: 20 })
    : null;

export const db = sql ? drizzle(sql, { schema }) : null;

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}

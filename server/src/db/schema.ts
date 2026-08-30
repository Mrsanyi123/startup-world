import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const plots = pgTable(
  "plots",
  {
    id: text("id").primaryKey(),
    posX: doublePrecision("pos_x").notNull(),
    posY: doublePrecision("pos_y").notNull(),
    posZ: doublePrecision("pos_z").notNull(),
    ownerId: text("owner_id").references(() => users.id),
    status: text("status").notNull().default("unclaimed"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (table) => [
    // One claimed plot per user. NULL owner_id on unclaimed plots is allowed many times.
    uniqueIndex("plots_one_claimed_per_owner")
      .on(table.ownerId)
      .where(sql`${table.status} = 'claimed' AND ${table.ownerId} IS NOT NULL`),
  ],
);

export const connections = pgTable("connections", {
  id: text("id").primaryKey(),
  plotId: text("plot_id")
    .notNull()
    .unique()
    .references(() => plots.id),
  provider: text("provider").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  providerAccountId: text("provider_account_id"),
  status: text("status").notNull().default("ok"),
  lastError: text("last_error"),
  isMrrPublic: boolean("is_mrr_public").notNull().default(false),
  connectedAt: timestamp("connected_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const mrrSnapshots = pgTable("mrr_snapshots", {
  id: text("id").primaryKey(),
  connectionId: text("connection_id")
    .notNull()
    .references(() => connections.id),
  mrrCents: integer("mrr_cents").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const houseTiers = pgTable("house_tiers", {
  tierIndex: integer("tier_index").primaryKey(),
  label: text("label").notNull(),
  mrrThresholdCents: integer("mrr_threshold_cents").notNull(),
  modelRef: text("model_ref").notNull(),
});

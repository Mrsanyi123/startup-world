import { eq } from "drizzle-orm";
import { HOUSE_TIERS, plotLayout, DEMO_PLOTS } from "@startup-village/shared";
import { db } from "./index";
import {
  connections,
  houseTiers,
  mrrSnapshots,
  plots,
  users,
} from "./schema";

/**
 * Demo houses live in `@startup-village/shared` so the client fallback
 * and this seed cannot drift.
 */

export async function seed(): Promise<void> {
  if (!db) return;

  for (const tier of HOUSE_TIERS) {
    await db
      .insert(houseTiers)
      .values({
        tierIndex: tier.tierIndex,
        label: tier.label,
        mrrThresholdCents: tier.mrrThresholdCents,
        modelRef: tier.modelRef,
      })
      .onConflictDoUpdate({
        target: houseTiers.tierIndex,
        set: {
          label: tier.label,
          mrrThresholdCents: tier.mrrThresholdCents,
          modelRef: tier.modelRef,
        },
      });
  }

  for (const plot of plotLayout()) {
    await db
      .insert(plots)
      .values({
        id: plot.id,
        posX: plot.position.x,
        posY: plot.position.y,
        posZ: plot.position.z,
        ownerId: null,
        status: "unclaimed",
        claimedAt: null,
      })
      .onConflictDoUpdate({
        target: plots.id,
        set: {
          posX: plot.position.x,
          posY: plot.position.y,
          posZ: plot.position.z,
        },
      });
  }

  for (const demo of DEMO_PLOTS) {
    await db
      .insert(users)
      .values({ id: demo.userId, displayName: demo.displayName })
      .onConflictDoUpdate({
        target: users.id,
        set: { displayName: demo.displayName },
      });

    const [existing] = await db
      .select({ status: plots.status, ownerId: plots.ownerId })
      .from(plots)
      .where(eq(plots.id, demo.plotId))
      .limit(1);

    if (!existing) continue;
    const ownedBySomeoneElse =
      existing.status === "claimed" && existing.ownerId !== demo.userId;
    if (ownedBySomeoneElse) continue;

    await db
      .update(plots)
      .set({
        ownerId: demo.userId,
        status: "claimed",
        claimedAt: new Date(),
      })
      .where(eq(plots.id, demo.plotId));

    const connId = `demo-conn-${demo.plotId}`;
    await db
      .insert(connections)
      .values({
        id: connId,
        plotId: demo.plotId,
        provider: "stripe",
        accessToken: "stub",
        refreshToken: null,
        isMrrPublic: demo.isMrrPublic,
      })
      .onConflictDoUpdate({
        target: connections.plotId,
        set: { isMrrPublic: demo.isMrrPublic },
      });

    const [latest] = await db
      .select({ id: mrrSnapshots.id })
      .from(mrrSnapshots)
      .where(eq(mrrSnapshots.connectionId, connId))
      .limit(1);

    if (!latest) {
      await db.insert(mrrSnapshots).values({
        id: `demo-snap-${demo.plotId}`,
        connectionId: connId,
        mrrCents: demo.mrrCents,
      });
    }
  }
}

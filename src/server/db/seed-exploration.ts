import type { Db, Transaction } from "./client";
import * as s from "./schema";
import { explorationSeed as c } from "./seed-data";
// Incremental deployment: preserves existing balance and player state.
export async function seedExploration(db: Db | Transaction) {
  for (const row of c.items) await db.insert(s.items).values(row).onConflictDoNothing();
  for (const row of c.recipes) await db.insert(s.recipes).values(row).onConflictDoNothing();
  await db.insert(s.actionPolicies).values(c.policy).onConflictDoNothing();
  for (const definition of c.events)
    await db
      .insert(s.explorationEvents)
      .values({ id: definition.id, areaId: definition.areaId, definition })
      .onConflictDoUpdate({ target: s.explorationEvents.id, set: { definition } });
  for (const definition of c.routes)
    await db
      .insert(s.explorationRoutes)
      .values({ id: definition.id, areaId: definition.areaId, definition })
      .onConflictDoUpdate({ target: s.explorationRoutes.id, set: { definition } });
}

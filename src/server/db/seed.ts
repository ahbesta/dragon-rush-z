import type { Db, Transaction } from "./client";
import * as s from "./schema";
import { seedCatalog as c } from "./seed-data";

export async function seedDatabase(db: Db | Transaction) {
  // Catálogos são dados administrativos. Reexecutar o seed nunca altera personagens.
  for (const row of c.races)
    await db.insert(s.races).values(row).onConflictDoUpdate({ target: s.races.id, set: row });
  for (const row of c.masters)
    await db.insert(s.masters).values(row).onConflictDoUpdate({ target: s.masters.id, set: row });
  for (const row of c.policies)
    await db
      .insert(s.actionPolicies)
      .values(row)
      .onConflictDoUpdate({ target: s.actionPolicies.id, set: row });
  for (const row of c.techniques)
    await db
      .insert(s.techniques)
      .values(row)
      .onConflictDoUpdate({ target: s.techniques.id, set: row });
  for (const row of c.items)
    await db.insert(s.items).values(row).onConflictDoUpdate({ target: s.items.id, set: row });
  for (const row of c.areas)
    await db.insert(s.areas).values(row).onConflictDoUpdate({ target: s.areas.id, set: row });
  for (const row of c.enemies)
    await db.insert(s.enemies).values(row).onConflictDoUpdate({ target: s.enemies.id, set: row });
  for (const row of c.transformations)
    await db
      .insert(s.transformations)
      .values(row)
      .onConflictDoUpdate({ target: s.transformations.id, set: row });
  for (const row of c.encounters)
    await db
      .insert(s.encounters)
      .values(row)
      .onConflictDoUpdate({ target: [s.encounters.areaId, s.encounters.enemyId], set: row });
  for (const row of c.drops)
    await db
      .insert(s.drops)
      .values(row)
      .onConflictDoUpdate({ target: [s.drops.enemyId, s.drops.itemId], set: row });
}

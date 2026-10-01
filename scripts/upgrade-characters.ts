import { databaseUrl } from "./environment";
import { createDatabase } from "../src/server/db/client";
import { readCatalog } from "../src/server/catalog";
import { statsFor, upgradeCharacter } from "../src/server/character-rules";
import * as s from "../src/server/db/schema";
import { eq } from "drizzle-orm";

const { db, pool } = createDatabase(databaseUrl(true));
try {
  const result = await db.transaction(async (tx) => {
    const catalog = await readCatalog(tx),
      characters = await tx.select().from(s.characters).for("update"),
      active = await tx.select().from(s.activeBattles);
    let upgraded = 0,
      pending = 0;
    for (const c of characters) {
      if (c.rulesVersion === 2) continue;
      if (active.some((b) => b.characterId === c.id)) {
        pending++;
        continue;
      }
      const race = catalog.races.find((r) => r.id === c.raceId);
      if (!race) throw new Error("Personagem com raça ausente do catálogo.");
      upgradeCharacter(c, race);
      const stats = statsFor(c, catalog);
      await tx
        .update(s.characters)
        .set({
          rulesVersion: 2,
          allocation: c.allocation,
          base: c.base,
          respecCount: 0,
          hp: Math.min(c.hp, stats.maxHp),
          ki: Math.min(c.ki, stats.maxKi),
          ratedPower: stats.powerLevel,
        })
        .where(eq(s.characters.id, c.id));
      upgraded++;
    }
    return { upgraded, pendingLegacyBattles: pending };
  });
  console.log(JSON.stringify(result));
} finally {
  await pool.end();
}

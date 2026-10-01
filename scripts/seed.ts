import { databaseUrl } from "./environment";
import { createDatabase } from "../src/server/db/client";
import { seedDatabase } from "../src/server/db/seed";
import { seedCatalog } from "../src/server/db/seed-data";
const { db, pool } = createDatabase(databaseUrl(true));
try {
  await db.transaction(async (tx) => seedDatabase(tx));
  console.log(
    `Seed concluído: ${seedCatalog.races.length} raças, ${seedCatalog.areas.length} áreas, ${seedCatalog.enemies.length} inimigos, ${seedCatalog.items.length} itens, ${seedCatalog.techniques.length} técnicas e ${seedCatalog.quests.length} missões.`,
  );
} finally {
  await pool.end();
}

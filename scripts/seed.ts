import { databaseUrl } from "./environment";
import { createDatabase } from "../src/server/db/client";
import { seedDatabase } from "../src/server/db/seed";
const { db, pool } = createDatabase(databaseUrl(true));
try {
  await db.transaction(async (tx) => seedDatabase(tx));
  console.log(
    "Seed concluído: 5 raças, 4 áreas, 6 inimigos (incluindo boss), 6 técnicas e itens iniciais.",
  );
} finally {
  await pool.end();
}

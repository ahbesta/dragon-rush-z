import { databaseUrl } from "./environment";
import { createDatabase } from "../src/server/db/client";
import { seedExploration } from "../src/server/db/seed-exploration";
const { db, pool } = createDatabase(databaseUrl(true));
try {
  await db.transaction(seedExploration);
  console.log(
    "Exploração instalada: 96 encontros, 16 rotas, 33 itens e 17 receitas. Personagens e catálogos anteriores preservados.",
  );
} finally {
  await pool.end();
}

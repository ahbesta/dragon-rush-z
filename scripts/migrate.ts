import { databaseUrl } from "./environment";
import { createDatabase } from "../src/server/db/client";
import { migrate } from "drizzle-orm/node-postgres/migrator";
const { db, pool } = createDatabase(databaseUrl(true));
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations aplicadas.");
} finally {
  await pool.end();
}

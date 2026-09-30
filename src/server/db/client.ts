import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;
export function createDatabase(url: string) {
  const connection = new URL(url);
  if (connection.hostname.endsWith(".neon.tech"))
    connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({
    connectionString: connection.toString(),
    max: 5,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 15000,
  });
  pool.on("error", () =>
    console.error("Uma conexão PostgreSQL inativa foi interrompida; novas conexões serão abertas."),
  );
  if (process.env.VERCEL) attachDatabasePool(pool);
  return { db: drizzle(pool, { schema }), pool };
}
const taskGlobal = globalThis as typeof globalThis & { dragonDatabase?: Database };
export function getDatabase(): Database {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");
  return (taskGlobal.dragonDatabase ??= createDatabase(process.env.DATABASE_URL));
}
export type Db = Database["db"];
export type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

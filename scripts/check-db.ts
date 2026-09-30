import { databaseUrl } from "./environment";
import { Client } from "pg";
const client = new Client({ connectionString: databaseUrl(), connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  const result = await client.query(
    "SELECT current_database() AS database, version() AS version; SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  const sets = Array.isArray(result) ? result : [result];
  console.log("Conexão PostgreSQL OK.");
  console.log(
    "Tabelas existentes:",
    sets[1]?.rows.map((r: { table_name: string }) => r.table_name).join(", ") || "nenhuma",
  );
} catch (error) {
  console.error(
    "Falha na conexão:",
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[URL omitida]")
      : "erro desconhecido",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}

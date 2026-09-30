import { getTableColumns, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

// Agrupa linhas em uma consulta preservando os nomes TypeScript do schema.
// Datas em JSON são strings; os consumidores convertem quando necessário.
export function rowsAsJson(
  table: PgTable,
  options: { where?: SQL; orderBy?: SQL; limit?: number } = {},
) {
  const entries = Object.entries(getTableColumns(table)).map(
    ([key, column]) => sql`${key}::text, ${column}`,
  );
  return sql`coalesce((SELECT jsonb_agg(row) FROM (
    SELECT jsonb_build_object(${sql.join(entries, sql`, `)}) AS row FROM ${table}
    ${options.where ? sql`WHERE ${options.where}` : sql``}
    ${options.orderBy ? sql`ORDER BY ${options.orderBy}` : sql``}
    ${options.limit ? sql`LIMIT ${options.limit}` : sql``}
  ) AS grouped_rows), '[]'::jsonb)`;
}

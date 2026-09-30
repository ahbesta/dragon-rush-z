import { sql } from "drizzle-orm";
import type { Db, Transaction } from "./db/client";

export async function consumeLimit(
  db: Db | Transaction,
  key: string,
  max: number,
  seconds: number,
) {
  const result = await db.execute<{ count: number; remaining: number }>(sql`
    INSERT INTO rate_limit (key, count, expires_at)
    VALUES (${key}, 1, clock_timestamp() + (${seconds} * interval '1 second'))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit.expires_at <= clock_timestamp() THEN 1 ELSE rate_limit.count + 1 END,
      expires_at = CASE WHEN rate_limit.expires_at <= clock_timestamp() THEN clock_timestamp() + (${seconds} * interval '1 second') ELSE rate_limit.expires_at END
    RETURNING count, greatest(1, ceil(extract(epoch FROM expires_at - clock_timestamp())))::integer AS remaining
  `);
  const row = result.rows[0];
  return { allowed: row.count <= max, retryAfter: row.count > max ? row.remaining : null };
}

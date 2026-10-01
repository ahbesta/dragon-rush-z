import { test as base, expect } from "@playwright/test";
import { sql } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";

// Disposable accounts share one browser IP. Respect the application's real signup limit
// instead of weakening authentication or deleting its request counters for the test suite.
export const test = base.extend({
  page: [
    async ({ page }, use) => {
      const database = createDatabase(process.env.DATABASE_URL!);
      try {
        const result = await database.db.execute<{ seconds: number }>(sql`
        SELECT COALESCE(max(greatest(0, ceil(extract(epoch FROM expires_at - clock_timestamp())))), 0)::int AS seconds
        FROM rate_limit WHERE key LIKE 'auth:%/sign-up/email%' AND count >= 5
      `);
        const seconds = result.rows[0]?.seconds ?? 0;
        if (seconds > 0) await new Promise((resolve) => setTimeout(resolve, (seconds + 1) * 1000));
      } finally {
        await database.pool.end();
      }
      await use(page);
    },
    { scope: "test", timeout: 90000 },
  ],
});
export { expect };

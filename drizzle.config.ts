import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
config({ path: ".env.local" });
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "" },
  strict: true,
});

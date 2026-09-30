import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
export function databaseUrl(admin = false): string {
  const direct = process.env.DIRECT_DATABASE_URL;
  const url =
    admin && direct && !direct.includes("USER:PASSWORD") ? direct : process.env.DATABASE_URL;
  if (!url || url.includes("USER:PASSWORD"))
    throw new Error("Configure DATABASE_URL em .env.local");
  return url;
}

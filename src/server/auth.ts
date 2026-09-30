import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { headers } from "next/headers";
import { getDatabase } from "./db/client";
import { consumeLimit } from "./rate-limit";
import * as schema from "./db/schema";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || secret.includes("SUBSTITUA"))
    throw new Error("BETTER_AUTH_SECRET deve ser configurado");
  if (!baseURL) throw new Error("BETTER_AUTH_URL deve ser configurada");
  const { db } = getDatabase();
  return betterAuth({
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    trustedOrigins: [baseURL],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
      },
      customStorage: {
        consume: async (key, rule) => consumeLimit(db, `auth:${key}`, rule.max, rule.window),
      },
    },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
export async function currentSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

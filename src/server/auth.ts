import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { headers } from "next/headers";
import { getDatabase } from "./db/client";
import { consumeLimit } from "./rate-limit";
import * as schema from "./db/schema";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  profileNameSchema,
} from "@/lib/account-validation";

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
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    trustedOrigins: [baseURL],
    databaseHooks: {
      user: {
        update: {
          before: async (user) => {
            if (user.name === undefined) return;
            const name = profileNameSchema.safeParse(user.name);
            if (!name.success) {
              throw new APIError("BAD_REQUEST", {
                code: "INVALID_PROFILE_NAME",
                message: name.error.issues[0].message,
              });
            }
            return { data: { ...user, name: name.data } };
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/change-password": { window: 60, max: 10 },
        "/update-user": { window: 60, max: 20 },
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

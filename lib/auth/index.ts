/**
 * lib/auth/index.ts
 *
 * BetterAuth configuration.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";

const DEV_AUTH_SECRET = "dev-only-better-auth-secret-change-before-production";
const configuredSecret = process.env.BETTER_AUTH_SECRET;

if (process.env.NODE_ENV === "production" && !configuredSecret) {
  throw new Error("BETTER_AUTH_SECRET must be configured in production.");
}

export const auth = betterAuth({
  secret: configuredSecret || DEV_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg", // or "postgres"
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "student",
        input: false,
      },
      studentId: {
        type: "string",
        required: false,
      },
      languagePreference: {
        type: "string",
        required: false,
        defaultValue: "en",
      },
    },
  },
});

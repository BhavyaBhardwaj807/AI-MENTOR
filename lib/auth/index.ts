/**
 * lib/auth/index.ts
 *
 * BetterAuth configuration.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // or "postgres"
  }),
  emailAndPassword: {
    enabled: true,
  },
});

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://knotic:changeme@localhost:5432/knotic",
});

export const db = drizzle(pool, { schema });

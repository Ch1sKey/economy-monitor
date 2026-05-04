import type { DbPool } from "./db/pool.js";

export type ApiEnv = { Variables: { pool: DbPool } };

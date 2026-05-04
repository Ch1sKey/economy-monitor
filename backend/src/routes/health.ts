import type { Hono } from "hono";
import type { ApiEnv } from "../appEnv.js";
import { queryHealth, countEvents } from "../db/queries.js";

export function registerHealthRoutes(app: Hono<ApiEnv>) {
  app.get("/api/health", async (c) => {
    const pool = c.get("pool");
    const db = await queryHealth(pool);
    let eventCount = 0;
    if (db.ok) {
      try {
        eventCount = await countEvents(pool);
      } catch {
        eventCount = 0;
      }
    }
    return c.json({
      status: "ok",
      db: { connected: db.ok, message: db.message },
      eventCount,
    });
  });
}

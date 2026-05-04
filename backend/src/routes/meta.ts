import type { Hono } from "hono";
import type { ApiEnv } from "../appEnv.js";
import { getMeta } from "../db/queries.js";

export function registerMetaRoutes(app: Hono<ApiEnv>) {
  app.get("/api/meta", async (c) => {
    const meta = await getMeta(c.get("pool"));
    return c.json(meta);
  });
}

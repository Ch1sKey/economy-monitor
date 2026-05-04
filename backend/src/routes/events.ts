import type { Hono } from "hono";
import type { ApiEnv } from "../appEnv.js";
import { loadConfig } from "../config.js";
import { resolveTimeframe } from "../domain/timeframes.js";
import { listEventsPaginated } from "../db/queries.js";
import { eventsQuerySchema } from "../validation/querySchemas.js";
import { serializeEvent } from "./players.js";

export function registerEventRoutes(app: Hono<ApiEnv>) {
  const config = loadConfig();

  app.get("/api/events", async (c) => {
    const pool = c.get("pool");
    const q = eventsQuerySchema.parse(c.req.query());
    const tf = resolveTimeframe({
      from: q.from,
      to: q.to,
      preset: q.preset ?? undefined,
      timezone: q.timezone ?? config.DEFAULT_TIMEZONE,
    });

    const { rows, total } = await listEventsPaginated(pool, {
      tf,
      source: q.source,
      action: q.action,
      player: q.player,
      confidence: q.confidence,
      item: q.item,
      transactionId: q.transaction_id,
      minDelta: q.min_delta,
      maxDelta: q.max_delta,
      limit: q.limit,
      offset: q.offset,
    });

    return c.json({
      total,
      limit: q.limit,
      offset: q.offset,
      events: rows.map(serializeEvent),
    });
  });
}

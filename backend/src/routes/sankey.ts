import type { Hono } from "hono";
import type { ApiEnv } from "../appEnv.js";
import { loadConfig } from "../config.js";
import { resolveTimeframe } from "../domain/timeframes.js";
import { getEventsInTimeframe, getPlayerDisplayName } from "../db/queries.js";
import { sankeyOverallQuerySchema, sankeyPlayerQuerySchema, playerUuidParamSchema } from "../validation/querySchemas.js";
import { buildOverallSankey, buildPlayerSankey } from "../domain/sankeyBuilder.js";

export function registerSankeyRoutes(app: Hono<ApiEnv>) {
  const config = loadConfig();

  app.get("/api/sankey/overall", async (c) => {
    const pool = c.get("pool");
    const q = sankeyOverallQuerySchema.parse(c.req.query());
    const tf = resolveTimeframe({
      from: q.from,
      to: q.to,
      preset: q.preset ?? undefined,
      timezone: q.timezone ?? config.DEFAULT_TIMEZONE,
    });
    const events = await getEventsInTimeframe(pool, tf);
    const { nodes, links } = buildOverallSankey(events, {
      mode: q.mode,
      topPlayers: q.topPlayers,
      includeInferred: q.includeInferred ?? true,
      includeAuctionPending: q.includeAuctionPending ?? false,
      minFlow: q.minFlow,
      groupBy: q.groupBy,
    });
    return c.json({
      timeframe: { from: tf.from?.toISOString() ?? null, to: tf.to?.toISOString() ?? null, preset: tf.preset, timezone: tf.timezone },
      nodes,
      links,
    });
  });

  app.get("/api/sankey/player/:uuid", async (c) => {
    const pool = c.get("pool");
    const { uuid } = playerUuidParamSchema.parse({ uuid: c.req.param("uuid") });
    const q = sankeyPlayerQuerySchema.parse(c.req.query());
    const tf = resolveTimeframe({
      from: q.from,
      to: q.to,
      preset: q.preset ?? undefined,
      timezone: q.timezone ?? config.DEFAULT_TIMEZONE,
    });
    const [events, displayName] = await Promise.all([getEventsInTimeframe(pool, tf), getPlayerDisplayName(pool, uuid)]);
    const { nodes, links } = buildPlayerSankey(events, uuid, {
      includeInferred: q.includeInferred ?? true,
      minFlow: q.minFlow,
      groupBy: q.groupBy,
      selectedDisplayName: displayName,
    });
    return c.json({
      timeframe: { from: tf.from?.toISOString() ?? null, to: tf.to?.toISOString() ?? null, preset: tf.preset, timezone: tf.timezone },
      nodes,
      links,
    });
  });
}

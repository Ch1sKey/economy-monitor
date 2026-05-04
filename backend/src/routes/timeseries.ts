import type { Hono } from "hono";
import type { ApiEnv } from "../appEnv.js";
import { loadConfig } from "../config.js";
import { resolveTimeframe } from "../domain/timeframes.js";
import { breakdownByAction, timeseriesMoneySupply, timeseriesPlayerBalance } from "../db/queries.js";
import { timeseriesQuerySchema, playerUuidParamSchema } from "../validation/querySchemas.js";

export function registerTimeseriesRoutes(app: Hono<ApiEnv>) {
  const config = loadConfig();

  app.get("/api/timeseries/money-supply", async (c) => {
    const pool = c.get("pool");
    const q = timeseriesQuerySchema.parse(c.req.query());
    const tf = resolveTimeframe({
      from: q.from,
      to: q.to,
      preset: q.preset ?? undefined,
      timezone: q.timezone ?? config.DEFAULT_TIMEZONE,
    });
    const points = await timeseriesMoneySupply(pool, tf, q.bucket);
    return c.json({
      timeframe: { from: tf.from?.toISOString() ?? null, to: tf.to?.toISOString() ?? null, preset: tf.preset, timezone: tf.timezone },
      bucket: q.bucket,
      points,
      note: "Totals sum snapshot rows in each bucket; multiple snapshots per player may inflate the series.",
    });
  });

  app.get("/api/timeseries/player-balance/:uuid", async (c) => {
    const pool = c.get("pool");
    const { uuid } = playerUuidParamSchema.parse({ uuid: c.req.param("uuid") });
    const q = timeseriesQuerySchema.parse(c.req.query());
    const tf = resolveTimeframe({
      from: q.from,
      to: q.to,
      preset: q.preset ?? undefined,
      timezone: q.timezone ?? config.DEFAULT_TIMEZONE,
    });
    const points = await timeseriesPlayerBalance(pool, uuid, tf, q.bucket);
    return c.json({
      timeframe: { from: tf.from?.toISOString() ?? null, to: tf.to?.toISOString() ?? null, preset: tf.preset, timezone: tf.timezone },
      bucket: q.bucket,
      points,
    });
  });

  app.get("/api/breakdown/actions", async (c) => {
    const pool = c.get("pool");
    const q = timeseriesQuerySchema.parse(c.req.query());
    const tf = resolveTimeframe({
      from: q.from,
      to: q.to,
      preset: q.preset ?? undefined,
      timezone: q.timezone ?? config.DEFAULT_TIMEZONE,
    });
    const rows = await breakdownByAction(pool, tf);
    return c.json({
      timeframe: { from: tf.from?.toISOString() ?? null, to: tf.to?.toISOString() ?? null, preset: tf.preset, timezone: tf.timezone },
      rows,
    });
  });
}

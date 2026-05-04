import type { Hono } from "hono";
import type { ApiEnv } from "../appEnv.js";
import { loadConfig } from "../config.js";
import { resolveTimeframe } from "../domain/timeframes.js";
import {
  countEvents,
  countMissingBalanceAfter,
  countPlayers,
  countSnapshots,
  diagnosticsCountsBySourceAction,
  duplicateTransactionCandidates,
  getEventTimeBounds,
  latestSnapshotTime,
  queryHealth,
  unknownDeltaVolume,
} from "../db/queries.js";
import { timeframeQuerySchema } from "../validation/querySchemas.js";

export function registerDiagnosticsRoutes(app: Hono<ApiEnv>) {
  const config = loadConfig();

  app.get("/api/diagnostics", async (c) => {
    const pool = c.get("pool");
    const q = timeframeQuerySchema.parse(c.req.query());
    const tf = resolveTimeframe({
      from: q.from,
      to: q.to,
      preset: q.preset ?? "last_7d",
      timezone: q.timezone ?? config.DEFAULT_TIMEZONE,
    });

    const [
      health,
      eventCount,
      snapshotCount,
      playersCount,
      bounds,
      byAction,
      lastSnap,
      unknownVol,
      missingBal,
      dupTx,
    ] = await Promise.all([
      queryHealth(pool),
      countEvents(pool),
      countSnapshots(pool),
      countPlayers(pool),
      getEventTimeBounds(pool),
      diagnosticsCountsBySourceAction(pool),
      latestSnapshotTime(pool),
      unknownDeltaVolume(pool, tf),
      countMissingBalanceAfter(pool),
      duplicateTransactionCandidates(pool),
    ]);

    const warnings: string[] = [];
    const now = Date.now();
    if (!lastSnap || now - lastSnap.getTime() > 7 * 24 * 60 * 60 * 1000) {
      warnings.push("No recent balance snapshots in the last 7 days.");
    }
    const unknownScaled = Number(unknownVol);
    if (unknownScaled > 1e9) {
      warnings.push("High unknown_delta volume in the selected timeframe.");
    }
    if (dupTx > 0) {
      warnings.push("Some transaction_id values appear unusually chatty; verify logging duplication.");
    }
    if (missingBal.total > 0 && missingBal.missing / missingBal.total > 0.3) {
      warnings.push("Many events are missing balance_after.");
    }
    if (!byAction.some((x) => x.source.toLowerCase().includes("zessentials"))) {
      warnings.push("No zEssentials events detected.");
    }
    if (!byAction.some((x) => x.source.toLowerCase().includes("zshop"))) {
      warnings.push("No zShop events detected.");
    }
    if (!byAction.some((x) => x.source.toLowerCase().includes("zauction"))) {
      warnings.push("No zAuctionHouse events detected.");
    }

    return c.json({
      db: health,
      databaseName: config.DB_NAME,
      eventCount,
      snapshotCount,
      playersCount,
      oldestEvent: bounds.min?.toISOString() ?? null,
      newestEvent: bounds.max?.toISOString() ?? null,
      lastSnapshot: lastSnap?.toISOString() ?? null,
      unknownDeltaVolume: unknownVol,
      eventsBySourceAction: byAction,
      warnings,
      duplicateTransactionPatternCount: dupTx,
      missingBalanceAfter: missingBal,
    });
  });
}

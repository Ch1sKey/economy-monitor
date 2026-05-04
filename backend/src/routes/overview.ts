import type { Hono } from "hono";
import type { ApiEnv } from "../appEnv.js";
import { loadConfig } from "../config.js";
import { resolveTimeframe } from "../domain/timeframes.js";
import { aggregateOverview } from "../domain/aggregates.js";
import { compareDecimal } from "../domain/decimals.js";
import {
  buildPlayerOverview,
  getAllPlayers,
  getEventTimeBounds,
  getEventsInTimeframe,
  getPlayerBalanceChangeMap,
  getTotalMoneyOnHands,
} from "../db/queries.js";
import { overviewQuerySchema } from "../validation/querySchemas.js";
import { effectiveRangeForSnapshots } from "../domain/timeframes.js";

export function registerOverviewRoutes(app: Hono<ApiEnv>) {
  const config = loadConfig();

  app.get("/api/overview", async (c) => {
    const pool = c.get("pool");
    const q = overviewQuerySchema.parse(c.req.query());
    const tf = resolveTimeframe({
      from: q.from,
      to: q.to,
      preset: q.preset ?? undefined,
      timezone: q.timezone ?? config.DEFAULT_TIMEZONE,
    });
    const includeInferred = q.includeInferred ?? true;

    const [events, totalOnHands, players, bounds] = await Promise.all([
      getEventsInTimeframe(pool, tf),
      getTotalMoneyOnHands(pool),
      getAllPlayers(pool),
      getEventTimeBounds(pool),
    ]);

    const agg = aggregateOverview(events, { includeInferred });

    const range = effectiveRangeForSnapshots(tf, bounds);
    const balanceChangeByPlayer = await getPlayerBalanceChangeMap(pool, range);
    const playerRows = buildPlayerOverview(players, events, { includeInferred, balanceChangeByPlayer });

    const topPlayersByBalance = [...playerRows]
      .sort((a, b) => compareDecimal(b.latest_balance, a.latest_balance))
      .slice(0, 10)
      .map((p) => ({
        player_uuid: p.player_uuid,
        player_name: p.player_name,
        balance: p.latest_balance,
      }));

    const topPlayersByNetChange = [...playerRows]
      .sort((a, b) => compareDecimal(b.balance_change, a.balance_change))
      .slice(0, 10)
      .map((p) => ({
        player_uuid: p.player_uuid,
        player_name: p.player_name,
        net_change: p.balance_change,
      }));

    return c.json({
      timeframe: { from: tf.from?.toISOString() ?? null, to: tf.to?.toISOString() ?? null, preset: tf.preset, timezone: tf.timezone },
      totalMoneyOnHands: totalOnHands,
      totalEmitted: agg.totalEmitted,
      totalBurned: agg.totalBurned,
      netSupplyChange: agg.netSupplyChange,
      transferVolume: agg.transferVolume,
      auctionVolume: agg.auctionVolume,
      unknownPositive: agg.unknownPositive,
      unknownNegative: agg.unknownNegative,
      eventCount: agg.eventCount,
      activePlayerCount: agg.activePlayerCount,
      topFaucets: agg.topFaucets,
      topSinks: agg.topSinks,
      topTransfers: agg.topTransfers,
      topPlayersByBalance,
      topPlayersByNetChange,
      suspicious: agg.suspicious.map((e) => ({
        id: String(e.id),
        created_at: e.created_at.toISOString(),
        source: e.source,
        action: e.action,
        player_name: e.player_name,
        money_delta: e.money_delta,
        confidence: e.confidence,
      })),
    });
  });
}

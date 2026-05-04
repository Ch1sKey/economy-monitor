import type { Hono } from "hono";
import type { ApiEnv } from "../appEnv.js";
import { loadConfig } from "../config.js";
import { resolveTimeframe, effectiveRangeForSnapshots } from "../domain/timeframes.js";
import { compareDecimal } from "../domain/decimals.js";
import {
  buildPlayerOverview,
  getAllPlayers,
  getEventTimeBounds,
  getEventsInTimeframe,
  getPlayerBalanceChangeMap,
  listPlayerEventsPaginated,
} from "../db/queries.js";
import { paginationSchema, playersQuerySchema, playerUuidParamSchema } from "../validation/querySchemas.js";
import { classifyEvent } from "../domain/moneyClassification.js";
import type { EconomyEventRow } from "../types/db.js";
import { addDecimalStrings, decimalToScaled, scaledToDecimalString } from "../domain/decimals.js";

function sortKey(
  row: Awaited<ReturnType<typeof buildPlayerOverview>>[number],
  sort: string | undefined,
): string {
  switch (sort) {
    case "net_change":
      return row.balance_change;
    case "faucet_received":
      return row.faucet_received;
    case "sink_spent":
      return row.sink_spent;
    case "transfer_volume":
      return row.transfer_volume;
    case "unknown_delta":
      return row.unknown_delta;
    case "balance":
    default:
      return row.latest_balance;
  }
}

export function registerPlayerRoutes(app: Hono<ApiEnv>) {
  const config = loadConfig();

  app.get("/api/players", async (c) => {
    const pool = c.get("pool");
    const q = playersQuerySchema.parse(c.req.query());
    const tf = resolveTimeframe({
      from: q.from,
      to: q.to,
      preset: q.preset ?? undefined,
      timezone: q.timezone ?? config.DEFAULT_TIMEZONE,
    });
    const includeInferred = q.includeInferred ?? true;

    const [players, events, bounds] = await Promise.all([
      getAllPlayers(pool),
      getEventsInTimeframe(pool, tf),
      getEventTimeBounds(pool),
    ]);
    const range = effectiveRangeForSnapshots(tf, bounds);
    const balanceChangeByPlayer = await getPlayerBalanceChangeMap(pool, range);
    let rows = buildPlayerOverview(players, events, { includeInferred, balanceChangeByPlayer });

    if (q.search?.trim()) {
      const s = q.search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.player_name?.toLowerCase().includes(s) ||
          r.player_uuid.toLowerCase().includes(s),
      );
    }

    const sort = q.sort ?? "balance";
    rows = [...rows].sort((a, b) => compareDecimal(sortKey(b, sort), sortKey(a, sort)));

    return c.json({
      timeframe: { from: tf.from?.toISOString() ?? null, to: tf.to?.toISOString() ?? null, preset: tf.preset, timezone: tf.timezone },
      players: rows,
    });
  });

  app.get("/api/players/:uuid/summary", async (c) => {
    const pool = c.get("pool");
    const { uuid } = playerUuidParamSchema.parse({ uuid: c.req.param("uuid") });
    const q = playersQuerySchema.parse(c.req.query());
    const tf = resolveTimeframe({
      from: q.from,
      to: q.to,
      preset: q.preset ?? undefined,
      timezone: q.timezone ?? config.DEFAULT_TIMEZONE,
    });
    const includeInferred = q.includeInferred ?? true;

    const [players, events, bounds] = await Promise.all([
      getAllPlayers(pool),
      getEventsInTimeframe(pool, tf),
      getEventTimeBounds(pool),
    ]);
    const range = effectiveRangeForSnapshots(tf, bounds);
    const balanceChangeByPlayer = await getPlayerBalanceChangeMap(pool, range);
    const overview = buildPlayerOverview(players, events, { includeInferred, balanceChangeByPlayer });
    const row = overview.find((p) => p.player_uuid === uuid);

    const playerEvents = events.filter(
      (e) => e.player_uuid === uuid || e.target_uuid === uuid || e.actor_uuid === uuid,
    );

    const income = { faucet: "0", transfers_in: "0", auction_in: "0", unknown_in: "0" };
    const expense = { sink: "0", transfers_out: "0", auction_out: "0", unknown_out: "0" };

    for (const e of playerEvents) {
      const cl = classifyEvent(e);
      if (cl.confidence === "inferred" && !includeInferred) continue;
      const md = e.money_delta ?? "0";
      const act = (e.action ?? "").toLowerCase();
      const pos = decimalToScaled(md) > 0n;
      const absv = scaledToDecimalString(decimalToScaled(md) < 0n ? -decimalToScaled(md) : decimalToScaled(md));

      if (cl.category === "faucet" && e.player_uuid === uuid) {
        income.faucet = addDecimalStrings(income.faucet, scaledToDecimalString(decimalToScaled(md) > 0n ? decimalToScaled(md) : 0n));
      }
      if (cl.category === "sink" && e.player_uuid === uuid) {
        expense.sink = addDecimalStrings(
          expense.sink,
          scaledToDecimalString(decimalToScaled(md) < 0n ? -decimalToScaled(md) : 0n),
        );
      }
      if (act === "pay_send" && e.player_uuid === uuid) {
        expense.transfers_out = addDecimalStrings(expense.transfers_out, absv);
      }
      if (act === "pay_receive" && e.player_uuid === uuid) {
        income.transfers_in = addDecimalStrings(income.transfers_in, absv);
      }
      if (act === "auction_buyer_pay" && e.player_uuid === uuid) {
        expense.auction_out = addDecimalStrings(expense.auction_out, absv);
      }
      if (act === "auction_seller_receive" && e.player_uuid === uuid) {
        income.auction_in = addDecimalStrings(income.auction_in, absv);
      }
      if (act === "unknown_delta" && e.player_uuid === uuid) {
        if (pos) income.unknown_in = addDecimalStrings(income.unknown_in, absv);
        else expense.unknown_out = addDecimalStrings(expense.unknown_out, absv);
      }
    }

    return c.json({
      timeframe: { from: tf.from?.toISOString() ?? null, to: tf.to?.toISOString() ?? null, preset: tf.preset, timezone: tf.timezone },
      player: row ?? {
        player_uuid: uuid,
        player_name: null,
        latest_balance: "0",
        balance_rank: 0,
        balance_change: balanceChangeByPlayer.get(uuid) ?? "0",
        faucet_received: "0",
        sink_spent: "0",
        sent_to_players: "0",
        received_from_players: "0",
        auction_sales: "0",
        auction_purchases: "0",
        unknown_delta: "0",
        transfer_volume: "0",
        last_seen: null,
      },
      income,
      expense,
    });
  });

  app.get("/api/players/:uuid/events", async (c) => {
    const pool = c.get("pool");
    const { uuid } = playerUuidParamSchema.parse({ uuid: c.req.param("uuid") });
    const q = playersQuerySchema.merge(paginationSchema).parse(c.req.query());
    const tf = resolveTimeframe({
      from: q.from,
      to: q.to,
      preset: q.preset ?? undefined,
      timezone: q.timezone ?? config.DEFAULT_TIMEZONE,
    });
    const { rows, total } = await listPlayerEventsPaginated(pool, uuid, tf, q.limit, q.offset);
    return c.json({
      total,
      limit: q.limit,
      offset: q.offset,
      events: rows.map(serializeEvent),
    });
  });
}

export function serializeEvent(e: EconomyEventRow) {
  return {
    id: String(e.id),
    transaction_id: e.transaction_id,
    created_at: e.created_at.toISOString(),
    source: e.source,
    action: e.action,
    actor_uuid: e.actor_uuid,
    actor_name: e.actor_name,
    player_uuid: e.player_uuid,
    player_name: e.player_name,
    target_uuid: e.target_uuid,
    target_name: e.target_name,
    money_delta: e.money_delta,
    balance_before: e.balance_before,
    balance_after: e.balance_after,
    item_material: e.item_material,
    item_amount: e.item_amount,
    confidence: e.confidence,
    context_json: e.context_json,
  };
}

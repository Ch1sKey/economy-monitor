import type { RowDataPacket } from "mysql2";
import type { DbPool } from "./pool.js";
import type { EconomyEventRow, EconomyPlayerRow } from "../types/db.js";
import type { ResolvedTimeframe } from "../domain/timeframes.js";
import { timeframeWhereClause } from "../domain/timeframes.js";
import { addDecimalStrings, compareDecimal, decimalToScaled, scaledToDecimalString } from "../domain/decimals.js";
import { classifyEvent, isTransferVolumePrimaryRow } from "../domain/moneyClassification.js";

function mapEvent(r: RowDataPacket): EconomyEventRow {
  return {
    id: r.id,
    transaction_id: r.transaction_id,
    created_at: r.created_at,
    source: r.source,
    action: r.action,
    actor_uuid: r.actor_uuid,
    actor_name: r.actor_name,
    player_uuid: r.player_uuid,
    player_name: r.player_name,
    target_uuid: r.target_uuid,
    target_name: r.target_name,
    money_delta: r.money_delta != null ? String(r.money_delta) : null,
    balance_before: r.balance_before != null ? String(r.balance_before) : null,
    balance_after: r.balance_after != null ? String(r.balance_after) : null,
    item_material: r.item_material,
    item_amount: r.item_amount,
    item_nbt_hash: r.item_nbt_hash,
    world: r.world,
    confidence: r.confidence,
    context_json: r.context_json,
  };
}

export async function queryHealth(pool: DbPool): Promise<{ ok: boolean; message?: string }> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT 1 as ok");
    return { ok: rows[0]?.ok === 1 };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function getMeta(pool: DbPool): Promise<{
  sources: string[];
  actions: string[];
  players: { uuid: string; name: string | null }[];
  minEventTime: string | null;
  maxEventTime: string | null;
}> {
  const [srcRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT source FROM economy_events WHERE source IS NOT NULL ORDER BY source LIMIT 5000",
  );
  const [actRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT action FROM economy_events WHERE action IS NOT NULL ORDER BY action LIMIT 5000",
  );
  const [plRows] = await pool.query<RowDataPacket[]>(
    "SELECT player_uuid, player_name FROM economy_players ORDER BY player_name LIMIT 10000",
  );
  const [range] = await pool.query<RowDataPacket[]>(
    "SELECT MIN(created_at) as mn, MAX(created_at) as mx FROM economy_events",
  );
  return {
    sources: srcRows.map((r) => String(r.source)),
    actions: actRows.map((r) => String(r.action)),
    players: plRows.map((r) => ({ uuid: String(r.player_uuid), name: r.player_name ? String(r.player_name) : null })),
    minEventTime: range[0]?.mn ? new Date(range[0].mn as Date).toISOString() : null,
    maxEventTime: range[0]?.mx ? new Date(range[0].mx as Date).toISOString() : null,
  };
}

export async function countEvents(pool: DbPool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as c FROM economy_events");
  return Number(rows[0]?.c ?? 0);
}

export async function countSnapshots(pool: DbPool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as c FROM economy_balance_snapshots");
  return Number(rows[0]?.c ?? 0);
}

export async function countPlayers(pool: DbPool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as c FROM economy_players");
  return Number(rows[0]?.c ?? 0);
}

export async function getEventTimeBounds(pool: DbPool): Promise<{ min: Date | null; max: Date | null }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT MIN(created_at) as mn, MAX(created_at) as mx FROM economy_events",
  );
  return {
    min: rows[0]?.mn ? new Date(rows[0].mn as Date) : null,
    max: rows[0]?.mx ? new Date(rows[0].mx as Date) : null,
  };
}

export async function getLastReconcileEvent(pool: DbPool): Promise<EconomyEventRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM economy_events WHERE source = 'reconcile' ORDER BY created_at DESC LIMIT 1",
  );
  return rows[0] ? mapEvent(rows[0]) : null;
}

export async function getEventsInTimeframe(pool: DbPool, tf: ResolvedTimeframe): Promise<EconomyEventRow[]> {
  const { sql, params } = timeframeWhereClause("created_at", tf);
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM economy_events WHERE ${sql} ORDER BY id ASC`, params);
  return rows.map(mapEvent);
}

export async function getTotalMoneyOnHands(pool: DbPool): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(CAST(coalesced AS DECIMAL(38,10))), 0) AS t
     FROM (
       SELECT p.player_uuid,
         COALESCE(
           p.last_known_balance,
           (SELECT s.balance FROM economy_balance_snapshots s
            WHERE s.player_uuid = p.player_uuid
            ORDER BY s.created_at DESC, s.id DESC LIMIT 1),
           (SELECT e.balance_after FROM economy_events e
            WHERE e.player_uuid = p.player_uuid AND e.balance_after IS NOT NULL
            ORDER BY e.created_at DESC, e.id DESC LIMIT 1),
           0
         ) AS coalesced
       FROM economy_players p
     ) x`,
  );
  return String(rows[0]?.t ?? "0");
}

export async function getPlayerDisplayName(pool: DbPool, playerUuid: string): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT player_name FROM economy_players WHERE player_uuid = ? LIMIT 1",
    [playerUuid],
  );
  const n = rows[0]?.player_name;
  return n != null && String(n).trim() ? String(n) : null;
}

export async function getAllPlayers(pool: DbPool): Promise<EconomyPlayerRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM economy_players ORDER BY player_name");
  return rows.map((r) => ({
    player_uuid: String(r.player_uuid),
    player_name: r.player_name ? String(r.player_name) : null,
    first_seen: r.first_seen ? new Date(r.first_seen) : null,
    last_seen: r.last_seen ? new Date(r.last_seen) : null,
    last_known_balance: r.last_known_balance != null ? String(r.last_known_balance) : null,
    updated_at: r.updated_at ? new Date(r.updated_at) : null,
  }));
}

/** Balance at end of window minus balance just before window start, using snapshots only. */
export async function getPlayerBalanceChangeMap(
  pool: DbPool,
  range: { from: Date; to: Date },
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.player_uuid,
       COALESCE(
         (SELECT CAST(balance AS DECIMAL(38,10)) FROM economy_balance_snapshots s
          WHERE s.player_uuid = p.player_uuid AND s.created_at <= ?
          ORDER BY s.created_at DESC, s.id DESC LIMIT 1), 0
       )
       -
       COALESCE(
         (SELECT CAST(balance AS DECIMAL(38,10)) FROM economy_balance_snapshots s
          WHERE s.player_uuid = p.player_uuid AND s.created_at < ?
          ORDER BY s.created_at DESC, s.id DESC LIMIT 1), 0
       ) AS delta
     FROM economy_players p`,
    [range.to, range.from],
  );
  for (const r of rows) {
    map.set(String(r.player_uuid), String(r.delta ?? "0"));
  }
  return map;
}

export interface PlayerOverviewRow {
  player_uuid: string;
  player_name: string | null;
  latest_balance: string;
  balance_rank: number;
  balance_change: string;
  faucet_received: string;
  sink_spent: string;
  sent_to_players: string;
  received_from_players: string;
  auction_sales: string;
  auction_purchases: string;
  unknown_delta: string;
  transfer_volume: string;
  last_seen: string | null;
}

function absStr(md: string): string {
  const sc = decimalToScaled(md);
  return scaledToDecimalString(sc < 0n ? -sc : sc);
}

export function buildPlayerOverview(
  players: EconomyPlayerRow[],
  events: EconomyEventRow[],
  opts: { includeInferred: boolean; balanceChangeByPlayer: Map<string, string> },
): PlayerOverviewRow[] {
  type Acc = {
    faucet: string;
    sink: string;
    sent: string;
    recv: string;
    auctionBuy: string;
    auctionSell: string;
    unknown: string;
    transferVol: string;
  };

  const byPlayer = new Map<string, Acc>();
  for (const p of players) {
    byPlayer.set(p.player_uuid, {
      faucet: "0",
      sink: "0",
      sent: "0",
      recv: "0",
      auctionBuy: "0",
      auctionSell: "0",
      unknown: "0",
      transferVol: "0",
    });
  }

  for (const row of events) {
    const c = classifyEvent(row);
    if (c.confidence === "inferred" && !opts.includeInferred) continue;
    const uuid = row.player_uuid;
    if (!uuid || !byPlayer.has(uuid)) continue;
    const acc = byPlayer.get(uuid)!;
    const md = row.money_delta ?? "0";
    const act = (row.action ?? "").toLowerCase();

    const action = act.toLowerCase();

    // economy_* is always server↔wallet and should only affect the wallet owner.
    if ((action === "economy_deposit" || action === "economy_withdraw") && row.player_uuid !== uuid) {
      continue;
    }

    if (c.category === "faucet" && row.player_uuid === uuid) {
      const amt = scaledToDecimalString(decimalToScaled(md) > 0n ? decimalToScaled(md) : 0n);
      acc.faucet = addDecimalStrings(acc.faucet, amt);
    }
    if (c.category === "sink" && row.player_uuid === uuid) {
      const burn = scaledToDecimalString(decimalToScaled(md) < 0n ? -decimalToScaled(md) : 0n);
      acc.sink = addDecimalStrings(acc.sink, burn);
    }
    if (act === "pay_send" && row.player_uuid === uuid) {
      acc.sent = addDecimalStrings(acc.sent, absStr(md));
      if (isTransferVolumePrimaryRow(row)) {
        acc.transferVol = addDecimalStrings(acc.transferVol, absStr(md));
      }
    }
    if (act === "pay_receive" && row.player_uuid === uuid) {
      acc.recv = addDecimalStrings(acc.recv, absStr(md));
    }
    if (act === "auction_buyer_pay" && row.player_uuid === uuid) {
      acc.auctionBuy = addDecimalStrings(acc.auctionBuy, absStr(md));
      if (isTransferVolumePrimaryRow(row)) {
        acc.transferVol = addDecimalStrings(acc.transferVol, absStr(md));
      }
    }
    if (act === "auction_seller_receive" && row.player_uuid === uuid) {
      acc.auctionSell = addDecimalStrings(acc.auctionSell, absStr(md));
    }
    if (act === "unknown_delta" && row.player_uuid === uuid) {
      acc.unknown = addDecimalStrings(acc.unknown, absStr(md));
    }
  }

  const sortedByBal = [...players].sort((a, b) =>
    compareDecimal(b.last_known_balance ?? "0", a.last_known_balance ?? "0"),
  );

  const rankMap = new Map<string, number>();
  sortedByBal.forEach((p, i) => rankMap.set(p.player_uuid, i + 1));

  return players.map((p) => {
    const acc = byPlayer.get(p.player_uuid)!;
    const latest = p.last_known_balance ?? "0";
    const balanceChange = opts.balanceChangeByPlayer.get(p.player_uuid) ?? "0";
    return {
      player_uuid: p.player_uuid,
      player_name: p.player_name,
      latest_balance: latest,
      balance_rank: rankMap.get(p.player_uuid) ?? 0,
      balance_change: balanceChange,
      faucet_received: acc.faucet,
      sink_spent: acc.sink,
      sent_to_players: acc.sent,
      received_from_players: acc.recv,
      auction_sales: acc.auctionSell,
      auction_purchases: acc.auctionBuy,
      unknown_delta: acc.unknown,
      transfer_volume: acc.transferVol,
      last_seen: p.last_seen ? p.last_seen.toISOString() : null,
    };
  });
}

export async function listEventsPaginated(
  pool: DbPool,
  opts: {
    tf: ResolvedTimeframe;
    source?: string;
    action?: string;
    player?: string;
    confidence?: string;
    item?: string;
    transactionId?: string;
    minDelta?: string;
    maxDelta?: string;
    limit: number;
    offset: number;
  },
): Promise<{ rows: EconomyEventRow[]; total: number }> {
  const { sql: tfSql, params: tfParams } = timeframeWhereClause("created_at", opts.tf);
  const where: string[] = [tfSql];
  const params: unknown[] = [...tfParams];

  if (opts.source) {
    where.push("source = ?");
    params.push(opts.source);
  }
  if (opts.action) {
    where.push("action = ?");
    params.push(opts.action);
  }
  if (opts.player) {
    where.push("(player_uuid = ? OR player_name LIKE ? OR target_uuid = ? OR target_name LIKE ?)");
    const like = `%${opts.player}%`;
    params.push(opts.player, like, opts.player, like);
  }
  if (opts.confidence) {
    where.push("confidence = ?");
    params.push(opts.confidence);
  }
  if (opts.item) {
    where.push("item_material = ?");
    params.push(opts.item);
  }
  if (opts.transactionId) {
    where.push("transaction_id = ?");
    params.push(opts.transactionId);
  }
  if (opts.minDelta) {
    where.push("CAST(money_delta AS DECIMAL(38,10)) >= CAST(? AS DECIMAL(38,10))");
    params.push(opts.minDelta);
  }
  if (opts.maxDelta) {
    where.push("CAST(money_delta AS DECIMAL(38,10)) <= CAST(? AS DECIMAL(38,10))");
    params.push(opts.maxDelta);
  }

  const whereSql = where.join(" AND ");
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as c FROM economy_events WHERE ${whereSql}`,
    params,
  );
  const total = Number(countRows[0]?.c ?? 0);

  const lim = Math.min(Math.max(opts.limit, 1), 500);
  const off = Math.max(opts.offset, 0);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM economy_events WHERE ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, lim, off],
  );
  return { rows: rows.map(mapEvent), total };
}

export async function listPlayerEventsPaginated(
  pool: DbPool,
  uuid: string,
  tf: ResolvedTimeframe,
  limit: number,
  offset: number,
): Promise<{ rows: EconomyEventRow[]; total: number }> {
  const { sql: tfSql, params: tfParams } = timeframeWhereClause("created_at", tf);
  const base = `(${tfSql}) AND (player_uuid = ? OR target_uuid = ? OR actor_uuid = ?)`;
  const params: unknown[] = [...tfParams, uuid, uuid, uuid];

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as c FROM economy_events WHERE ${base}`,
    params,
  );
  const total = Number(countRows[0]?.c ?? 0);
  const lim = Math.min(Math.max(limit, 1), 500);
  const off = Math.max(offset, 0);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM economy_events WHERE ${base} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, lim, off],
  );
  return { rows: rows.map(mapEvent), total };
}

export async function breakdownByAction(pool: DbPool, tf: ResolvedTimeframe): Promise<
  {
    source: string | null;
    action: string | null;
    count: number;
    sum_delta: string;
  }[]
> {
  const { sql, params } = timeframeWhereClause("created_at", tf);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT source, action, COUNT(*) as c,
            COALESCE(SUM(CAST(money_delta AS DECIMAL(38,10))),0) as s
     FROM economy_events WHERE ${sql}
     GROUP BY source, action
     ORDER BY ABS(SUM(CAST(money_delta AS DECIMAL(38,10)))) DESC
     LIMIT 500`,
    params,
  );
  return rows.map((r) => ({
    source: r.source ? String(r.source) : null,
    action: r.action ? String(r.action) : null,
    count: Number(r.c),
    sum_delta: String(r.s),
  }));
}

export async function timeseriesMoneySupply(
  pool: DbPool,
  tf: ResolvedTimeframe,
  bucket: "hour" | "day",
): Promise<{ t: string; total: string }[]> {
  const { sql, params } = timeframeWhereClause("created_at", tf);
  const fmt = bucket === "hour" ? "%Y-%m-%d %H:00:00" : "%Y-%m-%d 00:00:00";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(created_at, '${fmt}') as b,
            COALESCE(SUM(CAST(balance AS DECIMAL(38,10))),0) as total
     FROM economy_balance_snapshots
     WHERE ${sql}
     GROUP BY b
     ORDER BY b ASC`,
    params,
  );
  return rows.map((r) => ({ t: String(r.b), total: String(r.total) }));
}

export async function timeseriesPlayerBalance(
  pool: DbPool,
  uuid: string,
  tf: ResolvedTimeframe,
  bucket: "hour" | "day",
): Promise<{ t: string; balance: string }[]> {
  const { sql, params } = timeframeWhereClause("created_at", tf);
  const fmt = bucket === "hour" ? "%Y-%m-%d %H:00:00" : "%Y-%m-%d 00:00:00";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT bucket AS b, balance AS bal FROM (
       SELECT DATE_FORMAT(created_at, '${fmt}') AS bucket,
              CAST(balance AS DECIMAL(38,10)) AS balance,
              ROW_NUMBER() OVER (PARTITION BY DATE_FORMAT(created_at, '${fmt}') ORDER BY created_at DESC, id DESC) AS rn
       FROM economy_balance_snapshots
       WHERE player_uuid = ? AND (${sql})
     ) t
     WHERE rn = 1
     ORDER BY b ASC`,
    [uuid, ...params],
  );
  return rows.map((r) => ({ t: String(r.b), balance: String(r.bal) }));
}

export async function diagnosticsCountsBySourceAction(pool: DbPool): Promise<{ source: string; action: string; c: number }[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(source,'') as source, COALESCE(action,'') as action, COUNT(*) as c
     FROM economy_events GROUP BY source, action ORDER BY c DESC LIMIT 200`,
  );
  return rows.map((r) => ({ source: String(r.source), action: String(r.action), c: Number(r.c) }));
}

export async function latestSnapshotTime(pool: DbPool): Promise<Date | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT MAX(created_at) as m FROM economy_balance_snapshots",
  );
  return rows[0]?.m ? new Date(rows[0].m as Date) : null;
}

export async function unknownDeltaVolume(pool: DbPool, tf: ResolvedTimeframe): Promise<string> {
  const { sql, params } = timeframeWhereClause("created_at", tf);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(ABS(CAST(money_delta AS DECIMAL(38,10)))), 0) as t
     FROM economy_events WHERE ${sql} AND action = 'unknown_delta'`,
    params,
  );
  return String(rows[0]?.t ?? "0");
}

export async function countMissingBalanceAfter(pool: DbPool): Promise<{ missing: number; total: number }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT SUM(CASE WHEN balance_after IS NULL THEN 1 ELSE 0 END) as m, COUNT(*) as t FROM economy_events`,
  );
  return { missing: Number(rows[0]?.m ?? 0), total: Number(rows[0]?.t ?? 0) };
}

export async function duplicateTransactionCandidates(pool: DbPool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as c FROM (
       SELECT transaction_id FROM economy_events
       WHERE transaction_id IS NOT NULL AND transaction_id <> ''
       GROUP BY transaction_id HAVING COUNT(*) > 3
     ) x`,
  );
  return Number(rows[0]?.c ?? 0);
}

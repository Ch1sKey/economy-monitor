import type { EconomyEventRow } from "../types/db.js";
import {
  addDecimalStrings,
  compareDecimal,
  decimalToScaled,
  isZeroDecimal,
  scaledToDecimalString,
  subDecimalStrings,
} from "./decimals.js";
import {
  classifyEvent,
  isTransferVolumeDedupeRow,
  isTransferVolumePrimaryRow,
} from "./moneyClassification.js";

export interface OverviewMetrics {
  totalEmitted: string;
  totalBurned: string;
  netSupplyChange: string;
  transferVolume: string;
  auctionVolume: string;
  unknownPositive: string;
  unknownNegative: string;
  eventCount: number;
  activePlayerCount: number;
  topFaucets: { key: string; source: string; action: string; amount: string; count: number }[];
  topSinks: { key: string; source: string; action: string; amount: string; count: number }[];
  topTransfers: { key: string; source: string; action: string; amount: string; count: number }[];
  suspicious: EconomyEventRow[];
}

function absPositive(delta: string): string {
  const s = scaledToDecimalString(decimalToScaled(delta) < 0n ? -decimalToScaled(delta) : decimalToScaled(delta));
  return s;
}

function faucetAmount(delta: string): string {
  const scaled = decimalToScaled(delta);
  if (scaled <= 0n) return "0";
  return scaledToDecimalString(scaled);
}

function sinkBurnAmount(delta: string): string {
  const scaled = decimalToScaled(delta);
  if (scaled >= 0n) return "0";
  return scaledToDecimalString(-scaled);
}

export function aggregateOverview(
  rows: EconomyEventRow[],
  opts: { includeInferred: boolean },
): OverviewMetrics {
  let totalEmitted = "0";
  let totalBurned = "0";
  let transferVolume = "0";
  let auctionVolume = "0";
  const playersActive = new Set<string>();
  const faucetMap = new Map<string, { source: string; action: string; amount: string; count: number }>();
  const sinkMap = new Map<string, { source: string; action: string; amount: string; count: number }>();
  const transferMap = new Map<string, { source: string; action: string; amount: string; count: number }>();
  let unknownPositive = "0";
  let unknownNegative = "0";
  const suspicious: EconomyEventRow[] = [];

  for (const row of rows) {
    const pid = row.player_uuid;
    if (pid) playersActive.add(pid);

    const c = classifyEvent(row);
    if (c.confidence === "inferred" && !opts.includeInferred) {
      continue;
    }

    const src = row.source ?? "";
    const act = row.action ?? "";
    const key = `${src}::${act}`;
    const md = row.money_delta ?? "0";

    if (c.category === "faucet") {
      const amt = faucetAmount(md);
      if (!isZeroDecimal(amt)) {
        totalEmitted = addDecimalStrings(totalEmitted, amt);
        const cur = faucetMap.get(key) ?? { source: src, action: act, amount: "0", count: 0 };
        cur.amount = addDecimalStrings(cur.amount, amt);
        cur.count += 1;
        faucetMap.set(key, cur);
      }
      if (act === "unknown_delta" && compareDecimal(md, "0") > 0) {
        unknownPositive = addDecimalStrings(unknownPositive, md);
      }
    } else if (c.category === "sink") {
      const amt = sinkBurnAmount(md);
      if (!isZeroDecimal(amt)) {
        totalBurned = addDecimalStrings(totalBurned, amt);
        const cur = sinkMap.get(key) ?? { source: src, action: act, amount: "0", count: 0 };
        cur.amount = addDecimalStrings(cur.amount, amt);
        cur.count += 1;
        sinkMap.set(key, cur);
      }
      if (act === "unknown_delta" && compareDecimal(md, "0") < 0) {
        unknownNegative = addDecimalStrings(unknownNegative, absPositive(md));
      }
    } else if (c.category === "transfer") {
      if (isTransferVolumeDedupeRow(row)) {
        // skip aggregate transfer volume
      } else if (isTransferVolumePrimaryRow(row)) {
        const vol = absPositive(md);
        if (!isZeroDecimal(vol)) {
          transferVolume = addDecimalStrings(transferVolume, vol);
          const cur = transferMap.get(key) ?? { source: src, action: act, amount: "0", count: 0 };
          cur.amount = addDecimalStrings(cur.amount, vol);
          cur.count += 1;
          transferMap.set(key, cur);
        }
        if (act === "auction_buyer_pay") {
          auctionVolume = addDecimalStrings(auctionVolume, absPositive(md));
        }
      }
    } else if (c.category === "unknown" && act === "unknown_delta") {
      if (compareDecimal(md, "0") > 0) unknownPositive = addDecimalStrings(unknownPositive, md);
      else if (compareDecimal(md, "0") < 0)
        unknownNegative = addDecimalStrings(unknownNegative, absPositive(md));
    }

    if (c.category === "unknown" && act !== "unknown_delta" && !isZeroDecimal(md)) {
      suspicious.push(row);
    }
    if (c.confidence === "inferred" && act === "unknown_delta") {
      suspicious.push(row);
    }
  }

  const netSupplyChange = subDecimalStrings(totalEmitted, totalBurned);

  const topFaucets = [...faucetMap.values()]
    .sort((a, b) => compareDecimal(b.amount, a.amount))
    .slice(0, 10)
    .map((x) => ({ key: `${x.source}::${x.action}`, ...x }));

  const topSinks = [...sinkMap.values()]
    .sort((a, b) => compareDecimal(b.amount, a.amount))
    .slice(0, 10)
    .map((x) => ({ key: `${x.source}::${x.action}`, ...x }));

  const topTransfers = [...transferMap.values()]
    .sort((a, b) => compareDecimal(b.amount, a.amount))
    .slice(0, 10)
    .map((x) => ({ key: `${x.source}::${x.action}`, ...x }));

  return {
    totalEmitted,
    totalBurned,
    netSupplyChange,
    transferVolume,
    auctionVolume,
    unknownPositive,
    unknownNegative,
    eventCount: rows.length,
    activePlayerCount: playersActive.size,
    topFaucets,
    topSinks,
    topTransfers,
    suspicious: suspicious.slice(0, 50),
  };
}

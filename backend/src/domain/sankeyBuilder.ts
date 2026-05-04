import type { EconomyEventRow } from "../types/db.js";
import type { SankeyLinkDTO, SankeyNodeDTO } from "../types/api.js";
import { addDecimalStrings, compareDecimal, decimalToScaled, isZeroDecimal, scaledToDecimalString } from "./decimals.js";
import { classifyEvent } from "./moneyClassification.js";

export type SankeyMode = "collapsed" | "top_n" | "expanded";
export type SankeyGroupBy = "default" | "source" | "action" | "player" | "item";

const N = {
  EXTERNAL_NEW: "external_new_money",
  SHOP_SELL_FAUCET: "server_shop_sell_faucet",
  ADMIN_DEPOSIT: "admin_deposits",
  POSITIVE_SET: "positive_set_adjustments",
  UNKNOWN_POS: "unknown_positive_delta",
  PLAYERS: "players_collapsed",
  OTHER_PLAYERS: "other_players",
  SHOP_BUY_SINK: "server_shop_buy_sink",
  CONFIRM_SHOP_SINK: "confirm_shop_rank_sink",
  AUCTION_LISTING_TAX: "auction_listing_tax_burn",
  AUCTION_PURCHASE_TAX: "auction_purchase_tax_burn",
  ADMIN_WITHDRAW: "admin_withdrawals",
  NEGATIVE_SET: "negative_set_adjustments",
  UNKNOWN_NEG: "unknown_negative_delta",
  AUCTION_PENDING: "auction_pending_holding",
  UNKNOWN_SOURCE: "unknown_source",
  UNKNOWN_SINK: "unknown_sink",
} as const;

function playerLabel(uuid: string, name: string | null | undefined): string {
  return name?.trim() ? `Player: ${name}` : `Player: ${uuid.slice(0, 8)}…`;
}

function resolvePlayerNodeId(
  uuid: string | null | undefined,
  name: string | null | undefined,
  mode: SankeyMode,
  topSet: Set<string>,
): string {
  if (!uuid) return N.PLAYERS;
  if (mode === "collapsed") return N.PLAYERS;
  if (mode === "expanded") return `player:${uuid}`;
  if (mode === "top_n") {
    if (topSet.has(uuid)) return `player:${uuid}`;
    return N.OTHER_PLAYERS;
  }
  return N.PLAYERS;
}

function mapFaucetSource(row: EconomyEventRow, groupBy: SankeyGroupBy): { id: string; label: string } {
  const act = (row.action ?? "").toLowerCase();
  const src = row.source ?? "";
  const item = row.item_material ?? "";

  if (groupBy === "source") {
    return { id: `src:${src || "unknown"}`, label: `Source: ${src || "unknown"}` };
  }
  if (groupBy === "action") {
    return { id: `act:${act}`, label: `Action: ${act}` };
  }
  if (groupBy === "player") {
    return { id: `actor:${row.actor_uuid ?? "server"}`, label: `Actor: ${row.actor_name ?? row.actor_uuid ?? "server"}` };
  }
  if (groupBy === "item" && item) {
    return { id: `faucet_item:${item}`, label: `Shop Sell: ${item}` };
  }

  if (act === "shop_sell" || act === "shop_sell_all") {
    return item
      ? { id: `${N.SHOP_SELL_FAUCET}::${item}`, label: `Shop Sell: ${item}` }
      : { id: N.SHOP_SELL_FAUCET, label: "Server Shop Sell Faucet" };
  }
  /* economy_deposit: money from server/admin pool → receiver is always player_* only; actor_* is audit only (not a Sankey source node). */
  if (act === "economy_deposit") return { id: N.ADMIN_DEPOSIT, label: "Admin Deposits" };
  if (act === "economy_set") return { id: N.POSITIVE_SET, label: "Positive Set Adjustments" };
  if (act === "unknown_delta") return { id: N.UNKNOWN_POS, label: "Unknown Positive Delta" };
  return { id: N.EXTERNAL_NEW, label: "External / New Money" };
}

function mapSinkTarget(row: EconomyEventRow, groupBy: SankeyGroupBy): { id: string; label: string } {
  const act = (row.action ?? "").toLowerCase();
  const src = row.source ?? "";
  const item = row.item_material ?? "";

  if (groupBy === "source") {
    return { id: `sink_src:${src || "unknown"}`, label: `Sink Source: ${src || "unknown"}` };
  }
  if (groupBy === "action") {
    return { id: `sink_act:${act}`, label: `Sink Action: ${act}` };
  }
  if (groupBy === "player") {
    return { id: `sink_actor:${row.target_uuid ?? "server"}`, label: `Target: ${row.target_name ?? "server"}` };
  }
  if (groupBy === "item" && item && (act === "shop_buy" || act === "shop_confirm_buy")) {
    return { id: `sink_item:${item}`, label: `Shop Buy: ${item}` };
  }

  if (act === "shop_buy") {
    return item
      ? { id: `${N.SHOP_BUY_SINK}::${item}`, label: `Shop Buy: ${item}` }
      : { id: N.SHOP_BUY_SINK, label: "Server Shop Buy Sink" };
  }
  if (act === "shop_confirm_buy") return { id: N.CONFIRM_SHOP_SINK, label: "Confirm Shop / Rank Sink" };
  if (act === "auction_listing_tax_burn") return { id: N.AUCTION_LISTING_TAX, label: "Auction Listing Tax Burn" };
  if (act === "auction_tax_burn") return { id: N.AUCTION_PURCHASE_TAX, label: "Auction Purchase Tax Burn" };
  if (act === "economy_withdraw") return { id: N.ADMIN_WITHDRAW, label: "Admin Withdrawals" };
  if (act === "economy_set") return { id: N.NEGATIVE_SET, label: "Negative Set Adjustments" };
  if (act === "unknown_delta") return { id: N.UNKNOWN_NEG, label: "Unknown Negative Delta" };
  return { id: N.UNKNOWN_SINK, label: "Unknown Sink" };
}

interface LinkAcc {
  value: string;
  eventCount: number;
  action?: string;
  sourceType?: string;
  confidence?: string;
}

function addLink(
  m: Map<string, LinkAcc>,
  source: string,
  target: string,
  value: string,
  meta: { action?: string; sourceType?: string; confidence?: string },
) {
  if (source === target) return;
  if (isZeroDecimal(value)) return;
  const key = `${source}>>>${target}`;
  const cur = m.get(key) ?? { value: "0", eventCount: 0, ...meta };
  cur.value = addDecimalStrings(cur.value, value);
  cur.eventCount += 1;
  cur.action = meta.action ?? cur.action;
  cur.sourceType = meta.sourceType ?? cur.sourceType;
  cur.confidence = meta.confidence ?? cur.confidence;
  m.set(key, cur);
}

function absFlow(delta: string): string {
  const sc = decimalToScaled(delta);
  return scaledToDecimalString(sc < 0n ? -sc : sc);
}

function normName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function sameMinecraftName(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  return normName(a) === normName(b);
}

/** Match wallet column when zEssentials logs UUID empty but names present (e.g. pay, shop). */
function uuidOrNameMatchesSelected(
  uuid: string | null | undefined,
  name: string | null | undefined,
  selectedUuid: string,
  displayName: string | null,
): boolean {
  if (uuid?.trim() && uuid === selectedUuid) return true;
  if (displayName?.trim() && sameMinecraftName(name, displayName)) return true;
  return false;
}

function p2pCounterpartyId(prefix: string, uuid: string | null | undefined, name: string | null | undefined): string {
  if (uuid?.trim()) return `${prefix}:${uuid}`;
  if (name?.trim()) return `${prefix}:n:${normName(name)}`;
  return `${prefix}:unknown`;
}

function p2pCounterpartyLabel(uuid: string | null | undefined, name: string | null | undefined): string {
  const n = name?.trim();
  if (n) return `Player: ${n}`;
  if (uuid?.trim()) return `Player: ${uuid.slice(0, 8)}…`;
  return "Player: ?";
}

/**
 * Row belongs to this player by UUID or by display name (zShop often omits `player_uuid` but sets `player_name`).
 */
function rowInvolvesSelectedPlayer(row: EconomyEventRow, selectedUuid: string, displayName: string | null): boolean {
  if (row.player_uuid === selectedUuid || row.target_uuid === selectedUuid || row.actor_uuid === selectedUuid) {
    return true;
  }
  if (!displayName?.trim()) return false;
  return (
    sameMinecraftName(row.player_name, displayName) ||
    sameMinecraftName(row.target_name, displayName) ||
    sameMinecraftName(row.actor_name, displayName)
  );
}

export function computePlayerVolumes(rows: EconomyEventRow[], includeInferred: boolean): Map<string, string> {
  const vols = new Map<string, string>();
  for (const row of rows) {
    const c = classifyEvent(row);
    if (c.confidence === "inferred" && !includeInferred) continue;
    const uuid = row.player_uuid;
    if (!uuid) continue;
    const v = absFlow(row.money_delta ?? "0");
    if (isZeroDecimal(v)) continue;
    vols.set(uuid, addDecimalStrings(vols.get(uuid) ?? "0", v));
  }
  return vols;
}

export function buildOverallSankey(
  rows: EconomyEventRow[],
  opts: {
    mode: SankeyMode;
    topPlayers: number;
    includeInferred: boolean;
    includeAuctionPending: boolean;
    minFlow: string;
    groupBy: SankeyGroupBy;
  },
): { nodes: SankeyNodeDTO[]; links: SankeyLinkDTO[] } {
  const volumes = computePlayerVolumes(rows, opts.includeInferred);
  const sorted = [...volumes.entries()].sort((a, b) => compareDecimal(b[1], a[1]));
  const topSet = new Set(sorted.slice(0, Math.max(0, opts.topPlayers)).map(([u]) => u));

  const linkMap = new Map<string, LinkAcc>();
  const nodeSet = new Map<string, SankeyNodeDTO>();

  const ensure = (id: string, label: string, type: string) => {
    if (!nodeSet.has(id)) nodeSet.set(id, { id, label, type });
  };

  for (const row of rows) {
    const c = classifyEvent(row);
    if (c.confidence === "inferred" && !opts.includeInferred) continue;
    if (c.category === "pending" && !opts.includeAuctionPending) continue;

    const pid = row.player_uuid;
    const pname = row.player_name;
    const playerId = resolvePlayerNodeId(pid, pname, opts.mode, topSet);
    if (playerId.startsWith("player:")) {
      ensure(playerId, playerLabel(pid!, pname), "player");
    } else if (playerId === N.OTHER_PLAYERS) {
      ensure(N.OTHER_PLAYERS, "Other Players", "aggregate");
    } else {
      ensure(N.PLAYERS, "Players", "aggregate");
    }

    const md = row.money_delta ?? "0";
    const act = row.action ?? "";
    const src = row.source ?? "";
    const meta = { action: act, sourceType: src, confidence: c.confidence };

    if (c.category === "faucet") {
      const amt = scaledToDecimalString(decimalToScaled(md) > 0n ? decimalToScaled(md) : 0n);
      if (isZeroDecimal(amt)) continue;
      const left = mapFaucetSource(row, opts.groupBy);
      ensure(left.id, left.label, "faucet");
      addLink(linkMap, left.id, playerId, amt, meta);
    } else if (c.category === "sink") {
      const burn = scaledToDecimalString(decimalToScaled(md) < 0n ? -decimalToScaled(md) : 0n);
      if (isZeroDecimal(burn)) continue;
      const right = mapSinkTarget(row, opts.groupBy);
      ensure(right.id, right.label, "sink");
      addLink(linkMap, playerId, right.id, burn, meta);
    } else if (c.category === "transfer") {
      // Player↔player transfers (pay, auction) map both ends to the same node in collapsed
      // or both to "Other Players" in top_n mode — that is not a DAG edge in ECharts Sankey.
      if (opts.mode === "collapsed") {
        continue;
      }
      const flow = absFlow(md);
      if (isZeroDecimal(flow)) continue;
      const a = (row.action ?? "").toLowerCase();
      if (a === "pay_send") {
        const fromId = resolvePlayerNodeId(row.player_uuid, row.player_name, opts.mode, topSet);
        const toId = resolvePlayerNodeId(row.target_uuid, row.target_name, opts.mode, topSet);
        if (row.player_uuid && row.target_uuid && row.player_uuid !== row.target_uuid) {
          if (fromId === toId) continue;
          ensure(fromId, playerLabel(row.player_uuid, row.player_name), fromId.startsWith("player:") ? "player" : "aggregate");
          ensure(toId, playerLabel(row.target_uuid!, row.target_name), toId.startsWith("player:") ? "player" : "aggregate");
          addLink(linkMap, fromId, toId, flow, meta);
        }
      } else if (a === "auction_buyer_pay") {
        const buyer = resolvePlayerNodeId(row.player_uuid, row.player_name, opts.mode, topSet);
        const seller = resolvePlayerNodeId(row.target_uuid, row.target_name, opts.mode, topSet);
        if (row.player_uuid && row.target_uuid) {
          if (buyer === seller) continue;
          ensure(buyer, playerLabel(row.player_uuid, row.player_name), buyer.startsWith("player:") ? "player" : "aggregate");
          ensure(seller, playerLabel(row.target_uuid, row.target_name), seller.startsWith("player:") ? "player" : "aggregate");
          addLink(linkMap, buyer, seller, flow, { ...meta, action: "auction_buyer_pay" });
        }
      }
    } else if (c.category === "pending" && opts.includeAuctionPending) {
      ensure(N.AUCTION_PENDING, "Auction Pending Holding", "pending");
      const flow = absFlow(md);
      if (!isZeroDecimal(flow) && pid) {
        addLink(linkMap, playerId, N.AUCTION_PENDING, flow, meta);
      }
    }
  }

  const minSc = decimalToScaled(opts.minFlow);
  const links: SankeyLinkDTO[] = [];
  for (const [key, acc] of linkMap) {
    if (decimalToScaled(acc.value) < minSc) continue;
    const [source, target] = key.split(">>>");
    links.push({
      source,
      target,
      value: acc.value,
      action: acc.action,
      sourceType: acc.sourceType,
      confidence: acc.confidence,
      eventCount: acc.eventCount,
    });
  }

  const nodes = [...nodeSet.values()];
  return { nodes, links };
}

export function buildPlayerSankey(
  rows: EconomyEventRow[],
  selectedUuid: string,
  opts: {
    includeInferred: boolean;
    minFlow: string;
    groupBy: SankeyGroupBy;
    /** From `economy_players`; used when events only have `player_name` (e.g. zShop). */
    selectedDisplayName?: string | null;
  },
): { nodes: SankeyNodeDTO[]; links: SankeyLinkDTO[] } {
  const centerId = `player:${selectedUuid}`;
  const displayName =
    (opts.selectedDisplayName && opts.selectedDisplayName.trim()) ||
    rows.find((r) => r.player_uuid === selectedUuid)?.player_name?.trim() ||
    rows.find((r) => r.target_uuid === selectedUuid)?.target_name?.trim() ||
    rows.find((r) => r.actor_uuid === selectedUuid)?.actor_name?.trim() ||
    null;
  const centerName = displayName;
  const linkMap = new Map<string, LinkAcc>();
  const nodeSet = new Map<string, SankeyNodeDTO>();

  const ensure = (id: string, label: string, type: string) => {
    if (!nodeSet.has(id)) nodeSet.set(id, { id, label, type });
  };

  ensure(centerId, playerLabel(selectedUuid, centerName), "center");

  const paySendTxIds = new Set<string>();
  const auctionBuyerPayTxIds = new Set<string>();
  for (const r of rows) {
    const ta = (r.action ?? "").toLowerCase();
    if (ta === "pay_send" && r.transaction_id?.trim()) paySendTxIds.add(String(r.transaction_id).trim());
    if (ta === "auction_buyer_pay" && r.transaction_id?.trim()) {
      auctionBuyerPayTxIds.add(String(r.transaction_id).trim());
    }
  }

  /** Net money into center from each counterparty (positive = they paid you more than you paid them). */
  const p2pNetIntoCenter = new Map<string, bigint>();
  const p2pNodeLabel = new Map<string, string>();
  const bumpP2p = (uuid: string | null | undefined, name: string | null | undefined, netDeltaScaled: bigint) => {
    const id = p2pCounterpartyId("counterparty", uuid, name);
    p2pNodeLabel.set(id, p2pCounterpartyLabel(uuid, name));
    p2pNetIntoCenter.set(id, (p2pNetIntoCenter.get(id) ?? 0n) + netDeltaScaled);
  };

  for (const row of rows) {
    const c = classifyEvent(row);
    if (c.confidence === "inferred" && !opts.includeInferred) continue;
    const action = (row.action ?? "").toLowerCase();

    // Hard rule: economy_deposit is server faucet to receiver wallet only.
    // Never show it for actor/sender perspective in player Sankey.
    if (action === "economy_deposit") {
      const recvPlayer = uuidOrNameMatchesSelected(row.player_uuid, row.player_name, selectedUuid, displayName);
      if (!recvPlayer) continue;
    }
    if (action === "economy_withdraw") {
      const walletPlayer = uuidOrNameMatchesSelected(row.player_uuid, row.player_name, selectedUuid, displayName);
      if (!walletPlayer) continue;
    }

    const md = row.money_delta ?? "0";
    const act = row.action ?? "";
    const src = row.source ?? "";
    const meta = { action: act, sourceType: src, confidence: c.confidence };

    if (!rowInvolvesSelectedPlayer(row, selectedUuid, displayName)) continue;

    if (c.category === "faucet") {
      const amt = scaledToDecimalString(decimalToScaled(md) > 0n ? decimalToScaled(md) : 0n);
      if (isZeroDecimal(amt)) continue;
      const left = mapFaucetSource(row, opts.groupBy);
      ensure(left.id, left.label, "source");
      addLink(linkMap, left.id, centerId, amt, meta);
    }

    if (c.category === "sink") {
      const burn = scaledToDecimalString(decimalToScaled(md) < 0n ? -decimalToScaled(md) : 0n);
      if (isZeroDecimal(burn)) continue;
      const right = mapSinkTarget(row, opts.groupBy);
      ensure(right.id, right.label, "sink");
      addLink(linkMap, centerId, right.id, burn, meta);
    }

    if (c.category === "transfer") {
      const flow = absFlow(md);
      if (isZeroDecimal(flow)) continue;
      const scaledF = decimalToScaled(flow);
      const a = (row.action ?? "").toLowerCase();

      // pay_send: sender = player_* , receiver = target_* (UUIDs often empty; names from command log).
      if (a === "pay_send") {
        const sU = row.player_uuid?.trim();
        const sN = row.player_name?.trim();
        const rU = row.target_uuid?.trim();
        const rN = row.target_name?.trim();
        if (!(sU || sN) || !(rU || rN)) continue;
        if (normName(sN || "") === normName(rN || "") && !sU && !rU) continue;
        const senderSel = uuidOrNameMatchesSelected(sU, sN, selectedUuid, displayName);
        const recvSel = uuidOrNameMatchesSelected(rU, rN, selectedUuid, displayName);
        // Net per counterparty so we never emit both center→cp and cp→center (ECharts Sankey requires a DAG).
        if (senderSel && !recvSel) bumpP2p(rU, rN, -scaledF);
        if (recvSel && !senderSel) bumpP2p(sU, sN, scaledF);
      }

      // pay_receive: duplicate of pay_send for same transaction_id in many DBs — skip to avoid double edges.
      if (a === "pay_receive") {
        const tid = row.transaction_id?.trim();
        if (tid && paySendTxIds.has(tid)) continue;
        const recvSel = uuidOrNameMatchesSelected(row.player_uuid, row.player_name, selectedUuid, displayName);
        if (!recvSel) continue;
        const senderU = row.actor_uuid?.trim() || row.target_uuid?.trim();
        const senderN = row.actor_name?.trim() || row.target_name?.trim();
        if (!senderU && !senderN) continue;
        if (uuidOrNameMatchesSelected(senderU, senderN, selectedUuid, displayName)) continue;
        bumpP2p(senderU, senderN, scaledF);
      }

      // auction_buyer_pay: buyer = player_uuid, seller = target_uuid (one row for the transfer).
      if (a === "auction_buyer_pay" && row.player_uuid && row.target_uuid) {
        if (row.player_uuid === selectedUuid) bumpP2p(row.target_uuid, row.target_name, -scaledF);
        if (row.target_uuid === selectedUuid) bumpP2p(row.player_uuid, row.player_name, scaledF);
      }

      if (a === "auction_seller_receive" && row.player_uuid === selectedUuid) {
        const tx = row.transaction_id?.trim();
        if (tx && auctionBuyerPayTxIds.has(tx)) continue;
        const buyerUuid = row.actor_uuid ?? row.target_uuid;
        const buyerName = row.actor_name ?? row.target_name;
        if (buyerUuid && buyerUuid !== selectedUuid) bumpP2p(buyerUuid, buyerName, scaledF);
      }
    }
  }

  const netMeta = { action: "player_transfer_net", sourceType: "transfer", confidence: "high" };
  for (const [cpId, net] of p2pNetIntoCenter) {
    if (net === 0n) continue;
    const lbl = p2pNodeLabel.get(cpId) ?? cpId;
    ensure(cpId, lbl, "player");
    const mag = net > 0n ? net : -net;
    const amtStr = scaledToDecimalString(mag);
    if (isZeroDecimal(amtStr)) continue;
    if (net > 0n) addLink(linkMap, cpId, centerId, amtStr, netMeta);
    else addLink(linkMap, centerId, cpId, amtStr, netMeta);
  }

  const minSc = decimalToScaled(opts.minFlow);
  const links: SankeyLinkDTO[] = [];
  for (const [key, acc] of linkMap) {
    if (decimalToScaled(acc.value) < minSc) continue;
    const [source, target] = key.split(">>>");
    links.push({
      source,
      target,
      value: acc.value,
      action: acc.action,
      sourceType: acc.sourceType,
      confidence: acc.confidence,
      eventCount: acc.eventCount,
    });
  }

  return { nodes: [...nodeSet.values()], links };
}

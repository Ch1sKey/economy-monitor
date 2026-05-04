export type TimeframePreset =
  | "today"
  | "yesterday"
  | "last_24h"
  | "last_7d"
  | "last_30d"
  | "this_week"
  | "this_month"
  | "all_time";

export interface TimeframeQuery {
  preset?: TimeframePreset | null;
  from?: string | null;
  to?: string | null;
  timezone: string;
  includeInferred?: boolean;
}

export interface OverviewResponse {
  timeframe: { from: string | null; to: string | null; preset: string | null; timezone: string };
  totalMoneyOnHands: string;
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
  topPlayersByBalance: { player_uuid: string; player_name: string | null; balance: string }[];
  topPlayersByNetChange: { player_uuid: string; player_name: string | null; net_change: string }[];
  suspicious: {
    id: string;
    created_at: string;
    source?: string | null;
    action?: string | null;
    player_name?: string | null;
    money_delta?: string | null;
    confidence?: string | null;
  }[];
}

export interface PlayerRow {
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

export interface SankeyResponse {
  timeframe: { from: string | null; to: string | null; preset: string | null; timezone: string };
  nodes: { id: string; label: string; type: string }[];
  links: {
    source: string;
    target: string;
    value: string;
    action?: string;
    sourceType?: string;
    confidence?: string;
    eventCount?: number;
  }[];
}

export interface EventDTO {
  id: string;
  transaction_id: string | null;
  created_at: string;
  source: string | null;
  action: string | null;
  actor_uuid: string | null;
  actor_name: string | null;
  player_uuid: string | null;
  player_name: string | null;
  target_uuid: string | null;
  target_name: string | null;
  money_delta: string | null;
  balance_before: string | null;
  balance_after: string | null;
  item_material: string | null;
  item_amount: number | null;
  confidence: string | null;
  context_json: string | null;
}

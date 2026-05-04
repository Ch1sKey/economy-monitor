export interface EconomyEventRow {
  id: bigint | number;
  transaction_id: string | null;
  created_at: Date;
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
  item_nbt_hash: string | null;
  world: string | null;
  confidence: string | null;
  context_json: string | null;
}

export interface BalanceSnapshotRow {
  id: bigint | number;
  created_at: Date;
  player_uuid: string;
  player_name: string | null;
  balance: string;
  reason: string | null;
  event_id: bigint | number | null;
}

export interface EconomyPlayerRow {
  player_uuid: string;
  player_name: string | null;
  first_seen: Date | null;
  last_seen: Date | null;
  last_known_balance: string | null;
  updated_at: Date | null;
}

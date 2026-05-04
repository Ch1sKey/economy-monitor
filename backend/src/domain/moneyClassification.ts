import { isZeroDecimal } from "./decimals.js";

export type MoneyCategory =
  | "faucet"
  | "sink"
  | "transfer"
  | "pending"
  | "snapshot"
  | "unknown";

export type FlowDirection =
  | "external_to_player"
  | "player_to_external"
  | "player_to_player"
  | "buyer_to_seller"
  | "unknown";

export type ClassificationConfidence = "confirmed" | "inferred";

export interface ClassifiableEvent {
  source: string | null;
  action: string | null;
  money_delta: string | null;
  transaction_id?: string | null;
}

export interface ClassifyResult {
  category: MoneyCategory;
  supplyDelta: string;
  flowDirection: FlowDirection;
  confidence: ClassificationConfidence;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** True if this row should be ignored for global transfer volume (dedupe with counterpart). */
export function isTransferVolumeDedupeRow(event: ClassifiableEvent): boolean {
  const a = norm(event.action);
  if (a === "pay_receive") return true;
  if (a === "auction_seller_receive") return true;
  return false;
}

/** Prefer counting pay_send and auction_buyer_pay for aggregate transfer volume. */
export function isTransferVolumePrimaryRow(event: ClassifiableEvent): boolean {
  const a = norm(event.action);
  return a === "pay_send" || a === "auction_buyer_pay";
}

export function classifyEvent(event: ClassifiableEvent): ClassifyResult {
  const source = norm(event.source);
  const action = norm(event.action);
  const rawDelta = event.money_delta ?? "0";
  const deltaPositive = !rawDelta.trim().startsWith("-") && !isZeroDecimal(rawDelta);
  const deltaNegative = rawDelta.trim().startsWith("-");

  const inferred: ClassificationConfidence = action === "unknown_delta" ? "inferred" : "confirmed";

  if (action === "shop_sell" || action === "shop_sell_all") {
    return {
      category: "faucet",
      supplyDelta: rawDelta,
      flowDirection: "external_to_player",
      confidence: "confirmed",
    };
  }

  if (action === "shop_buy" || action === "shop_confirm_buy") {
    return {
      category: "sink",
      supplyDelta: rawDelta,
      flowDirection: "player_to_external",
      confidence: "confirmed",
    };
  }

  if (action === "economy_deposit") {
    return {
      category: "faucet",
      supplyDelta: rawDelta,
      flowDirection: "external_to_player",
      confidence: "confirmed",
    };
  }

  if (action === "economy_withdraw") {
    return {
      category: "sink",
      supplyDelta: rawDelta,
      flowDirection: "player_to_external",
      confidence: "confirmed",
    };
  }

  if (action === "economy_set") {
    if (deltaPositive) {
      return {
        category: "faucet",
        supplyDelta: rawDelta,
        flowDirection: "external_to_player",
        confidence: "confirmed",
      };
    }
    if (deltaNegative) {
      return {
        category: "sink",
        supplyDelta: rawDelta,
        flowDirection: "player_to_external",
        confidence: "confirmed",
      };
    }
    return {
      category: "unknown",
      supplyDelta: "0",
      flowDirection: "unknown",
      confidence: "confirmed",
    };
  }

  if (action === "pay_send" || action === "pay_receive") {
    return {
      category: "transfer",
      supplyDelta: "0",
      flowDirection: "player_to_player",
      confidence: "confirmed",
    };
  }

  if (action === "auction_buyer_pay" || action === "auction_seller_receive") {
    return {
      category: "transfer",
      supplyDelta: "0",
      flowDirection: "buyer_to_seller",
      confidence: "confirmed",
    };
  }

  if (action === "auction_seller_pending") {
    return {
      category: "pending",
      supplyDelta: "0",
      flowDirection: "unknown",
      confidence: "confirmed",
    };
  }

  if (action === "auction_tax_burn" || action === "auction_listing_tax_burn") {
    return {
      category: "sink",
      supplyDelta: rawDelta,
      flowDirection: "player_to_external",
      confidence: "confirmed",
    };
  }

  if (action === "unknown_delta") {
    if (deltaPositive) {
      return {
        category: "faucet",
        supplyDelta: rawDelta,
        flowDirection: "external_to_player",
        confidence: "inferred",
      };
    }
    if (deltaNegative) {
      return {
        category: "sink",
        supplyDelta: rawDelta,
        flowDirection: "player_to_external",
        confidence: "inferred",
      };
    }
    return {
      category: "unknown",
      supplyDelta: "0",
      flowDirection: "unknown",
      confidence: "inferred",
    };
  }

  return {
    category: "unknown",
    supplyDelta: "0",
    flowDirection: "unknown",
    confidence: source || action ? "confirmed" : "confirmed",
  };
}

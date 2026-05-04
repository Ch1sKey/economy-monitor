import type { OverviewResponse, PlayerRow, SankeyResponse, TimeframePreset, TimeframeQuery } from "./types";
import type { EventDTO } from "./types";

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function buildTimeframeParams(t: TimeframeQuery): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = { timezone: t.timezone };
  if (t.from) out.from = t.from;
  if (t.to) out.to = t.to;
  if (t.preset) out.preset = t.preset;
  if (t.includeInferred !== undefined) out.includeInferred = t.includeInferred;
  return out;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => getJson<{ status: string; db: { connected: boolean; message?: string }; eventCount: number }>("/api/health"),
  meta: () =>
    getJson<{
      sources: string[];
      actions: string[];
      players: { uuid: string; name: string | null }[];
      minEventTime: string | null;
      maxEventTime: string | null;
    }>("/api/meta"),
  overview: (t: TimeframeQuery) => getJson<OverviewResponse>(`/api/overview${qs(buildTimeframeParams(t))}`),
  players: (t: TimeframeQuery & { search?: string; sort?: string }) =>
    getJson<{ timeframe: unknown; players: PlayerRow[] }>(
      `/api/players${qs({ ...buildTimeframeParams(t), search: t.search, sort: t.sort })}`,
    ),
  playerSummary: (uuid: string, t: TimeframeQuery) =>
    getJson<{
      timeframe: unknown;
      player: PlayerRow;
      income: Record<string, string>;
      expense: Record<string, string>;
    }>(`/api/players/${encodeURIComponent(uuid)}/summary${qs(buildTimeframeParams(t))}`),
  playerEvents: (uuid: string, t: TimeframeQuery & { limit?: number; offset?: number }) =>
    getJson<{ total: number; events: EventDTO[] }>(
      `/api/players/${encodeURIComponent(uuid)}/events${qs({ ...buildTimeframeParams(t), limit: t.limit, offset: t.offset })}`,
    ),
  events: (
    p: TimeframeQuery & {
      source?: string;
      action?: string;
      player?: string;
      confidence?: string;
      item?: string;
      transaction_id?: string;
      min_delta?: string;
      max_delta?: string;
      limit?: number;
      offset?: number;
    },
  ) =>
    getJson<{ total: number; events: EventDTO[] }>(
      `/api/events${qs({
        ...buildTimeframeParams(p),
        source: p.source,
        action: p.action,
        player: p.player,
        confidence: p.confidence,
        item: p.item,
        transaction_id: p.transaction_id,
        min_delta: p.min_delta,
        max_delta: p.max_delta,
        limit: p.limit,
        offset: p.offset,
      })}`,
    ),
  sankeyOverall: (
    t: TimeframeQuery & {
      mode?: "collapsed" | "top_n" | "expanded";
      topPlayers?: number;
      includeAuctionPending?: boolean;
      minFlow?: string;
      groupBy?: string;
    },
  ) =>
    getJson<SankeyResponse>(
      `/api/sankey/overall${qs({
        ...buildTimeframeParams(t),
        mode: t.mode,
        topPlayers: t.topPlayers,
        includeAuctionPending: t.includeAuctionPending,
        minFlow: t.minFlow,
        groupBy: t.groupBy,
      })}`,
    ),
  sankeyPlayer: (uuid: string, t: TimeframeQuery & { minFlow?: string; groupBy?: string }) =>
    getJson<SankeyResponse>(
      `/api/sankey/player/${encodeURIComponent(uuid)}${qs({
        ...buildTimeframeParams(t),
        minFlow: t.minFlow,
        groupBy: t.groupBy,
      })}`,
    ),
  moneySupply: (t: TimeframeQuery & { bucket?: "hour" | "day" }) =>
    getJson<{ points: { t: string; total: string }[] }>(
      `/api/timeseries/money-supply${qs({ ...buildTimeframeParams(t), bucket: t.bucket })}`,
    ),
  playerBalanceSeries: (uuid: string, t: TimeframeQuery & { bucket?: "hour" | "day" }) =>
    getJson<{ points: { t: string; balance: string }[] }>(
      `/api/timeseries/player-balance/${encodeURIComponent(uuid)}${qs({
        ...buildTimeframeParams(t),
        bucket: t.bucket,
      })}`,
    ),
  breakdownActions: (t: TimeframeQuery) =>
    getJson<{ rows: { source: string | null; action: string | null; count: number; sum_delta: string }[] }>(
      `/api/breakdown/actions${qs(buildTimeframeParams(t))}`,
    ),
  diagnostics: (t: { preset?: TimeframePreset; timezone?: string }) =>
    getJson<unknown>(`/api/diagnostics${qs({ preset: t.preset, timezone: t.timezone })}`),
};

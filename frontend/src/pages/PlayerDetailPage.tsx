import { useQuery } from "@tanstack/react-query";
import type { EventDTO, PlayerRow, SankeyResponse } from "@/api/types";
import { Link, useParams } from "react-router-dom";
import ReactEcharts from "echarts-for-react";
import { api } from "@/api/client";
import { EventsTable } from "@/components/EventsTable";
import { SankeyChart } from "@/components/SankeyChart";
import { useTimeframeApi } from "@/hooks/useTimeframeApi";
import { formatMoney, num } from "@/utils/formatMoney";
import { chartPalette } from "@/utils/colors";

export function PlayerDetailPage() {
  const { uuid = "" } = useParams();
  const { params, refetchInterval } = useTimeframeApi();

  const summary = useQuery<{ timeframe: unknown; player: PlayerRow; income: Record<string, string>; expense: Record<string, string> }>({
    queryKey: ["player-summary", uuid, params],
    queryFn: () => api.playerSummary(uuid, params),
    enabled: Boolean(uuid),
    refetchInterval,
  });

  const events = useQuery<{ total: number; events: EventDTO[] }>({
    queryKey: ["player-events", uuid, params],
    queryFn: () => api.playerEvents(uuid, { ...params, limit: 50, offset: 0 }),
    enabled: Boolean(uuid),
    refetchInterval,
  });

  const sankey = useQuery<SankeyResponse>({
    queryKey: ["player-sankey", uuid, params],
    queryFn: () => api.sankeyPlayer(uuid, { ...params, minFlow: "0" }),
    enabled: Boolean(uuid),
    refetchInterval,
  });

  const series = useQuery<{ points: { t: string; balance: string }[] }>({
    queryKey: ["player-balance-series", uuid, params],
    queryFn: () => api.playerBalanceSeries(uuid, { ...params, bucket: "day" }),
    enabled: Boolean(uuid),
    refetchInterval,
  });

  const lineOption = {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: (series.data?.points ?? []).map((p) => p.t), axisLabel: { color: "#8b9bb8" } },
    yAxis: { type: "value", axisLabel: { color: "#8b9bb8" } },
    series: [{ type: "line", smooth: true, data: (series.data?.points ?? []).map((p) => num(p.balance)), itemStyle: { color: chartPalette[0] } }],
  };

  if (!uuid) return <p className="error">Missing player UUID.</p>;

  return (
    <>
      <p>
        <Link to="/players">← Players</Link>
      </p>
      <h1 className="page-title">{summary.data?.player.player_name ?? "Player"}</h1>
      <p className="page-sub">{uuid}</p>

      {summary.isLoading ? <p className="muted">Loading…</p> : null}
      {summary.isError ? <p className="error">{(summary.error as Error).message}</p> : null}

      {summary.data ? (
        <div className="grid cols-4" style={{ marginTop: 12 }}>
          <div className="card">
            <h3>Latest balance</h3>
            <div className="metric-value">{formatMoney(summary.data.player.latest_balance)}</div>
          </div>
          <div className="card">
            <h3>Window balance change</h3>
            <div className="metric-value">{formatMoney(summary.data.player.balance_change)}</div>
          </div>
          <div className="card">
            <h3>Net transfers est.</h3>
            <div className="metric-value">{formatMoney(summary.data.player.transfer_volume)}</div>
          </div>
          <div className="card">
            <h3>Unknown / inferred</h3>
            <div className="metric-value">{formatMoney(summary.data.player.unknown_delta)}</div>
          </div>
        </div>
      ) : null}

      {summary.data ? (
        <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "1fr 1fr" }}>
          <div className="card">
            <h3>Income breakdown</h3>
            <ul className="muted" style={{ paddingLeft: 18 }}>
              {Object.entries(summary.data.income).map(([k, v]) => (
                <li key={k}>
                  {k}: {formatMoney(v)}
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h3>Expense breakdown</h3>
            <ul className="muted" style={{ paddingLeft: 18 }}>
              {Object.entries(summary.data.expense).map(([k, v]) => (
                <li key={k}>
                  {k}: {formatMoney(v)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Balance over time (snapshots)</h3>
        {(series.data?.points.length ?? 0) === 0 ? <p className="muted">No points.</p> : <ReactEcharts option={lineOption} className="chart" />}
      </div>

      <div className="card card--sankey" style={{ marginTop: 16 }}>
        <h3>Player Sankey</h3>
        {sankey.isLoading ? <p className="muted">Loading…</p> : null}
        {sankey.data && sankey.data.links.length ? <SankeyChart data={sankey.data} /> : <p className="muted">No Sankey links for this player/range.</p>}
      </div>

      <h2 style={{ marginTop: 24 }}>Raw events</h2>
      {events.data ? <EventsTable rows={events.data.events} /> : null}
    </>
  );
}

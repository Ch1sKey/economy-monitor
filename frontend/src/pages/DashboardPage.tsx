import { useQuery } from "@tanstack/react-query";
import type { OverviewResponse, SankeyResponse } from "@/api/types";
import ReactEcharts from "echarts-for-react";
import { api } from "@/api/client";
import { MetricCard } from "@/components/MetricCard";
import { SankeyChart } from "@/components/SankeyChart";
import { useTimeframeApi } from "@/hooks/useTimeframeApi";
import { formatMoney, num } from "@/utils/formatMoney";
import { chartPalette } from "@/utils/colors";

export function DashboardPage() {
  const { params, refetchInterval } = useTimeframeApi();

  const overview = useQuery<OverviewResponse>({
    queryKey: ["overview", params],
    queryFn: () => api.overview(params),
    refetchInterval,
  });

  const breakdown = useQuery<{ rows: { source: string | null; action: string | null; count: number; sum_delta: string }[] }>({
    queryKey: ["breakdown", params],
    queryFn: () => api.breakdownActions(params),
    refetchInterval,
  });

  const supply = useQuery<{ points: { t: string; total: string }[]; note?: string }>({
    queryKey: ["money-supply", params],
    queryFn: () => api.moneySupply({ ...params, bucket: "day" }),
    refetchInterval,
  });

  const sankey = useQuery<SankeyResponse>({
    queryKey: ["sankey-overall-dash", params],
    queryFn: () => api.sankeyOverall({ ...params, mode: "collapsed", minFlow: "0" }),
    refetchInterval,
  });

  if (overview.isLoading) return <p className="muted">Loading dashboard…</p>;
  if (overview.isError) return <p className="error">{(overview.error as Error).message}</p>;
  const d = overview.data!;

  const topActions = breakdown.data?.rows.slice(0, 12) ?? [];
  const barOption = {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: topActions.map((r) => `${r.source}/${r.action}`), axisLabel: { rotate: 35, color: "#8b9bb8" } },
    yAxis: { type: "value", axisLabel: { color: "#8b9bb8" } },
    series: [
      {
        type: "bar",
        data: topActions.map((r) => num(r.sum_delta)),
        itemStyle: { color: chartPalette[0] },
      },
    ],
  };

  const linePoints = supply.data?.points ?? [];
  const lineOption = {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: linePoints.map((p) => p.t), axisLabel: { color: "#8b9bb8" } },
    yAxis: { type: "value", axisLabel: { color: "#8b9bb8" } },
    series: [{ type: "line", smooth: true, data: linePoints.map((p) => num(p.total)), areaStyle: {}, itemStyle: { color: chartPalette[1] } }],
  };

  const pieOption = {
    backgroundColor: "transparent",
    tooltip: { trigger: "item" },
    series: [
      {
        type: "pie",
        radius: ["35%", "65%"],
        data: [
          { name: "Emitted", value: num(d.totalEmitted) },
          { name: "Burned", value: num(d.totalBurned) },
          { name: "Transfers", value: num(d.transferVolume) },
        ],
        itemStyle: { borderColor: "#131b28", borderWidth: 2 },
      },
    ],
  };

  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Overall economy health for the selected timeframe.</p>

      <div className="grid cols-4">
        <MetricCard title="Money on hands (latest)" value={formatMoney(d.totalMoneyOnHands)} />
        <MetricCard title="Emitted" value={formatMoney(d.totalEmitted)} />
        <MetricCard title="Burned" value={formatMoney(d.totalBurned)} />
        <MetricCard title="Net supply change" value={formatMoney(d.netSupplyChange)} />
        <MetricCard title="Transfer volume" value={formatMoney(d.transferVolume)} />
        <MetricCard title="Auction volume" value={formatMoney(d.auctionVolume)} />
        <MetricCard title="Events" value={String(d.eventCount)} />
        <MetricCard title="Active players" value={String(d.activePlayerCount)} />
      </div>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h3>Money supply snapshots (sum per bucket)</h3>
          {linePoints.length === 0 ? (
            <p className="muted">No snapshot points in this range.</p>
          ) : (
            <ReactEcharts option={lineOption} className="chart" />
          )}
          <p className="muted" style={{ fontSize: 12 }}>
            {supply.data && "note" in supply.data ? String((supply.data as { note?: string }).note ?? "") : ""}
          </p>
        </div>
        <div className="card">
          <h3>Emitted / burned / transfers (rough)</h3>
          <ReactEcharts option={pieOption} className="chart" />
        </div>
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <h3>Top source/action by signed delta magnitude</h3>
          {topActions.length === 0 ? <p className="muted">No events.</p> : <ReactEcharts option={barOption} className="chart" />}
        </div>
      </div>

      <div className="card card--sankey" style={{ marginTop: 16 }}>
        <h3>Overall Sankey (collapsed players)</h3>
        {sankey.isLoading ? (
          <p className="muted">Loading Sankey…</p>
        ) : sankey.isError ? (
          <p className="error">{(sankey.error as Error).message}</p>
        ) : sankey.data && sankey.data.links.length ? (
          <SankeyChart data={sankey.data} />
        ) : (
          <p className="muted">Not enough linked flows to render a Sankey for this range.</p>
        )}
      </div>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="card">
          <h3>Top faucets</h3>
          <ul className="muted" style={{ paddingLeft: 18 }}>
            {d.topFaucets.map((x) => (
              <li key={x.key}>
                {x.source}/{x.action}: {formatMoney(x.amount)} ({x.count})
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Top sinks</h3>
          <ul className="muted" style={{ paddingLeft: 18 }}>
            {d.topSinks.map((x) => (
              <li key={x.key}>
                {x.source}/{x.action}: {formatMoney(x.amount)} ({x.count})
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Richest players</h3>
          <ul className="muted" style={{ paddingLeft: 18 }}>
            {d.topPlayersByBalance.map((p) => (
              <li key={p.player_uuid}>
                {p.player_name ?? p.player_uuid}: {formatMoney(p.balance)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {d.suspicious.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Recent suspicious / unexplained</h3>
          <p className="muted">Heuristic flags from classification; verify in raw events.</p>
          <ul style={{ paddingLeft: 18 }}>
            {d.suspicious.slice(0, 10).map((x) => (
              <li key={x.id}>
                {x.created_at} — {x.action ?? ""} — {formatMoney(x.money_delta)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

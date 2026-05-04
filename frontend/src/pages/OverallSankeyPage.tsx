import { useQuery } from "@tanstack/react-query";
import type { SankeyResponse } from "@/api/types";
import { useState } from "react";
import { api } from "@/api/client";
import { SankeyChart } from "@/components/SankeyChart";
import { useTimeframeApi } from "@/hooks/useTimeframeApi";

export function OverallSankeyPage() {
  const { params, refetchInterval } = useTimeframeApi();
  const [mode, setMode] = useState<"collapsed" | "top_n" | "expanded">("collapsed");
  const [topPlayers, setTopPlayers] = useState(8);
  const [minFlow, setMinFlow] = useState("0");
  const [groupBy, setGroupBy] = useState<"default" | "source" | "action" | "player" | "item">("default");
  const [includeAuctionPending, setIncludeAuctionPending] = useState(false);

  const q = useQuery<SankeyResponse>({
    queryKey: ["sankey-overall", params, mode, topPlayers, minFlow, groupBy, includeAuctionPending],
    queryFn: () =>
      api.sankeyOverall({
        ...params,
        mode,
        topPlayers,
        minFlow,
        groupBy,
        includeAuctionPending,
      }),
    refetchInterval,
  });

  return (
    <>
      <h1 className="page-title">Overall Sankey</h1>
      <p className="page-sub">Economy-wide flows for the selected timeframe.</p>

      <div className="toolbar">
        <label className="muted">
          Mode
          <select style={{ marginLeft: 8 }} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="collapsed">Collapsed players</option>
            <option value="top_n">Top N + other</option>
            <option value="expanded">All players expanded</option>
          </select>
        </label>
        <label className="muted">
          Top N
          <input
            type="number"
            style={{ marginLeft: 8, width: 80 }}
            value={topPlayers}
            min={1}
            max={100}
            onChange={(e) => setTopPlayers(Number(e.target.value))}
          />
        </label>
        <label className="muted">
          Min flow
          <input style={{ marginLeft: 8, width: 120 }} value={minFlow} onChange={(e) => setMinFlow(e.target.value)} />
        </label>
        <label className="muted">
          Group by
          <select style={{ marginLeft: 8 }} value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}>
            <option value="default">Default</option>
            <option value="source">Source</option>
            <option value="action">Action</option>
            <option value="player">Player</option>
            <option value="item">Item</option>
          </select>
        </label>
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={includeAuctionPending} onChange={(e) => setIncludeAuctionPending(e.target.checked)} />
          Include auction pending
        </label>
      </div>

      {q.isLoading ? <p className="muted">Loading…</p> : null}
      {q.isError ? <p className="error">{(q.error as Error).message}</p> : null}
      {q.data && q.data.links.length ? <SankeyChart data={q.data} /> : !q.isLoading ? <p className="muted">No links (try lowering min flow or widening the range).</p> : null}
    </>
  );
}

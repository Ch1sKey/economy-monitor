import { useQuery } from "@tanstack/react-query";
import type { EventDTO } from "@/api/types";
import { useState } from "react";
import { api } from "@/api/client";
import { EventsTable } from "@/components/EventsTable";
import { useTimeframeApi } from "@/hooks/useTimeframeApi";
export function RawEventsPage() {
  const { params, refetchInterval } = useTimeframeApi();
  const [source, setSource] = useState("");
  const [action, setAction] = useState("");
  const [player, setPlayer] = useState("");
  const [confidence, setConfidence] = useState("");
  const [item, setItem] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [minDelta, setMinDelta] = useState("");
  const [maxDelta, setMaxDelta] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const q = useQuery<{ total: number; events: EventDTO[] }>({
    queryKey: ["events", params, source, action, player, confidence, item, transactionId, minDelta, maxDelta, offset],
    queryFn: () =>
      api.events({
        ...params,
        source: source || undefined,
        action: action || undefined,
        player: player || undefined,
        confidence: confidence || undefined,
        item: item || undefined,
        transaction_id: transactionId || undefined,
        min_delta: minDelta || undefined,
        max_delta: maxDelta || undefined,
        limit,
        offset,
      }),
    refetchInterval,
  });

  return (
    <>
      <h1 className="page-title">Raw events</h1>
      <p className="page-sub">Paginated `economy_events` with filters.</p>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="toolbar" style={{ flexWrap: "wrap" }}>
          <input placeholder="Source" value={source} onChange={(e) => setSource(e.target.value)} />
          <input placeholder="Action" value={action} onChange={(e) => setAction(e.target.value)} />
          <input placeholder="Player UUID/name" value={player} onChange={(e) => setPlayer(e.target.value)} />
          <input placeholder="Confidence" value={confidence} onChange={(e) => setConfidence(e.target.value)} />
          <input placeholder="Item material" value={item} onChange={(e) => setItem(e.target.value)} />
          <input placeholder="transaction_id" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
          <input placeholder="min money_delta" value={minDelta} onChange={(e) => setMinDelta(e.target.value)} />
          <input placeholder="max money_delta" value={maxDelta} onChange={(e) => setMaxDelta(e.target.value)} />
        </div>
      </div>

      {q.isLoading ? <p className="muted">Loading…</p> : null}
      {q.isError ? <p className="error">{(q.error as Error).message}</p> : null}

      {q.data ? (
        <>
          <p className="muted">
            Showing {q.data.events.length} of {q.data.total}
          </p>
          <EventsTable rows={q.data.events} />
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button type="button" className="primary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
              Prev
            </button>
            <button
              type="button"
              className="primary"
              disabled={offset + limit >= q.data.total}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}

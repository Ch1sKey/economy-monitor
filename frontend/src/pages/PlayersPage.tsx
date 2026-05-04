import { useQuery } from "@tanstack/react-query";
import type { PlayerRow } from "@/api/types";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { PlayerTable } from "@/components/PlayerTable";
import { useTimeframeApi } from "@/hooks/useTimeframeApi";

export function PlayersPage() {
  const { params, refetchInterval } = useTimeframeApi();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState("balance");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery<{ timeframe: unknown; players: PlayerRow[] }>({
    queryKey: ["players", params, debounced, sort],
    queryFn: () => api.players({ ...params, search: debounced || undefined, sort }),
    refetchInterval,
  });

  return (
    <>
      <h1 className="page-title">Players</h1>
      <p className="page-sub">Balances and flows for the selected timeframe.</p>
      <div className="toolbar">
        <input placeholder="Search name or UUID" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 260 }} />
      </div>
      {q.isLoading ? <p className="muted">Loading…</p> : null}
      {q.isError ? <p className="error">{(q.error as Error).message}</p> : null}
      {q.data ? <PlayerTable rows={q.data.players} sort={sort} onSort={setSort} /> : null}
    </>
  );
}

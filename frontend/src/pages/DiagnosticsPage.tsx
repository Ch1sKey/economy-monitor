import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useTimeframeStore } from "@/state/timeframeStore";

export function DiagnosticsPage() {
  const timezone = useTimeframeStore((s) => s.timezone);
  const q = useQuery({
    queryKey: ["diagnostics", timezone],
    queryFn: () => api.diagnostics({ preset: "last_7d", timezone }),
  });

  if (q.isLoading) return <p className="muted">Loading diagnostics…</p>;
  if (q.isError) return <p className="error">{(q.error as Error).message}</p>;

  const d = q.data as Record<string, unknown>;

  return (
    <>
      <h1 className="page-title">Diagnostics</h1>
      <p className="page-sub">Database connectivity, coverage, and heuristic warnings.</p>

      <div className="card">
        <h3>Connection</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(d.db, null, 2)}</pre>
        <p className="muted">Database: {String(d.databaseName ?? "")}</p>
      </div>

      <div className="grid cols-4" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Events</h3>
          <div className="metric-value">{String(d.eventCount ?? 0)}</div>
        </div>
        <div className="card">
          <h3>Snapshots</h3>
          <div className="metric-value">{String(d.snapshotCount ?? 0)}</div>
        </div>
        <div className="card">
          <h3>Players</h3>
          <div className="metric-value">{String(d.playersCount ?? 0)}</div>
        </div>
        <div className="card">
          <h3>Dup-ish tx ids</h3>
          <div className="metric-value">{String(d.duplicateTransactionPatternCount ?? 0)}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Warnings</h3>
        {Array.isArray(d.warnings) && d.warnings.length ? (
          <ul>
            {(d.warnings as string[]).map((w) => (
              <li key={w} className="error">
                {w}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No warnings.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Events by source/action (top)</h3>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Source</th>
                <th>Action</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(d.eventsBySourceAction)
                ? (d.eventsBySourceAction as { source: string; action: string; c: number }[]).slice(0, 40).map((r) => (
                    <tr key={`${r.source}-${r.action}`}>
                      <td>{r.source}</td>
                      <td>{r.action}</td>
                      <td>{r.c}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
